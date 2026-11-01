type SceneModule = typeof import('./pcScene')
interface TransferParts { prefix: string; count: number; size: number; bytes: number }
interface TransferManifest {
  module: string; compressedModule?: string; compressedModel: string
  parts?: TransferParts
  moduleParts?: TransferParts
  decoder?: { js: TransferParts; wasm: TransferParts }
}
let sceneModule: SceneModule | undefined
let modelBytes: ArrayBuffer | undefined
let decoderBytes: [ArrayBuffer, ArrayBuffer] | undefined
const modelCacheName = 'nexbuild-graduate-model-v1'

/** Start independent downloads before the renderer module has finished loading.
 * Capture failures immediately, then propagate them to the scene's normal retry. */
export function prefetchPCResource<T>(load: (() => Promise<T>) | undefined) {
  if (!load) return undefined
  const pending = load().then(value => ({ ok: true as const, value }), error => ({ ok: false as const, error }))
  return async () => {
    const result = await pending
    if (!result.ok) throw result.error
    return result.value
  }
}

function validModel(data: ArrayBuffer) {
  if (data.byteLength < 12) return false
  const view = new DataView(data)
  return view.getUint32(0, true) === 0x46546c67 && view.getUint32(8, true) === data.byteLength
}

async function storedModel(transfer: TransferManifest) {
  if (!transfer.parts || !('caches' in window)) return
  try {
    const cache = await caches.open(modelCacheName)
    const response = await cache.match(new URL(`${transfer.parts.prefix}decoded.glb`, location.href).href)
    if (response) {
      const data = await response.arrayBuffer()
      if (validModel(data)) return data
    }
  } catch { /* Private mode/quota restrictions must never prevent animation. */ }
}

async function storeModel(transfer: TransferManifest, data: ArrayBuffer) {
  if (!transfer.parts || !('caches' in window)) return
  try {
    const cache = await caches.open(modelCacheName)
    const key = new URL(`${transfer.parts.prefix}decoded.glb`, location.href).href
    await cache.put(key, new Response(data, { headers: { 'Content-Type': 'model/gltf-binary' } }))
    // The content-derived key invalidates old models without accumulating them.
    for (const request of await cache.keys()) if (request.url !== key) await cache.delete(request)
  } catch { /* Best-effort cache, unrelated to login or private user data. */ }
}

function manifest(): TransferManifest | undefined {
  const text = document.getElementById('nexbuild-3d-transfer')?.textContent
  if (!text || typeof DecompressionStream === 'undefined') return
  try { return JSON.parse(text) as TransferManifest } catch { return }
}

/** Abort stalled transfers as well as fetch headers, so retries can recover. */
async function download(url: string, signal: AbortSignal): Promise<Blob> {
  const request = new AbortController()
  const abort = () => request.abort(signal.reason)
  signal.addEventListener('abort', abort, { once: true })
  let timer: ReturnType<typeof setTimeout>
  const touch = () => { clearTimeout(timer); timer = setTimeout(() => request.abort(), 25000) }
  touch()
  try {
    if (signal.aborted) abort()
    const response = await fetch(url, { signal: request.signal, credentials: 'omit' })
    if (!response.ok || !response.body) throw new Error('3D transfer unavailable')
    const reader = response.body.getReader()
    const chunks: Uint8Array<ArrayBuffer>[] = []
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      touch(); chunks.push(value)
    }
    return new Blob(chunks)
  } finally { clearTimeout(timer!); signal.removeEventListener('abort', abort) }
}

async function decode(blob: Blob): Promise<ArrayBuffer> {
  const signature = new Uint8Array(await blob.slice(0, 2).arrayBuffer())
  // fetch may already have decoded a host's Content-Encoding: gzip response.
  if (signature[0] !== 31 || signature[1] !== 139) return blob.arrayBuffer()
  return new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
}

async function unpack(url: string, signal: AbortSignal) { return decode(await download(url, signal)) }

async function modelParts(parts: TransferParts, signal: AbortSignal,
  progress?: (fraction: number) => void) {
  const controller = new AbortController()
  const abort = () => controller.abort(signal.reason)
  signal.addEventListener('abort', abort, { once: true })
  const buffers: Blob[] = new Array(parts.count)
  let next = 0, finished = 0
  try {
    if (signal.aborted) abort()
    await Promise.all(Array.from({ length: Math.min(4, parts.count) }, async () => {
      for (;;) {
        const index = next++
        if (index >= parts.count) return
        const piece = await download(`${parts.prefix}${index}.bin`, controller.signal)
        const expected = Math.min(parts.size, parts.bytes - index * parts.size)
        if (piece.size !== expected) throw new Error('Incomplete model transfer')
        buffers[index] = piece; progress?.(++finished / parts.count)
      }
    }))
    return await decode(new Blob(buffers))
  } finally { controller.abort(); signal.removeEventListener('abort', abort) }
}

export async function loadPCModule(fallback: () => Promise<SceneModule>, signal: AbortSignal) {
  if (sceneModule) return sceneModule
  const transfer = manifest()
  if (transfer?.compressedModule) {
    let objectURL: string | undefined
    try {
      const binary = transfer.moduleParts ? await modelParts(transfer.moduleParts, signal) : await unpack(transfer.compressedModule, signal)
      const originalURL = new URL(transfer.module, location.href).href
      // Vite only enables this path for a self-contained chunk. Preserve its
      // original URL for decoder assets resolved through import.meta.url.
      const source = new TextDecoder().decode(binary).replaceAll('import.meta.url', JSON.stringify(originalURL))
      objectURL = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
      sceneModule = await import(/* @vite-ignore */ objectURL) as SceneModule
      return sceneModule
    } catch (error) {
      if (signal.aborted) throw error
    } finally { if (objectURL) URL.revokeObjectURL(objectURL) }
  }
  sceneModule = await fallback()
  return sceneModule
}

export function compressedPCDecoder(signal: AbortSignal) {
  const transfer = manifest()?.decoder
  const pending = transfer ? prefetchPCResource(async () => decoderBytes ?? await Promise.all([
    modelParts(transfer.js, signal), modelParts(transfer.wasm, signal),
  ])) : undefined
  return transfer ? async () => {
    try {
      const [js, wasm] = await pending!()
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      decoderBytes = [js, wasm]
      const urls = { js: URL.createObjectURL(new Blob([js], { type: 'text/javascript' })),
        wasm: URL.createObjectURL(new Blob([wasm], { type: 'application/wasm' })) }
      return { ...urls, dispose: () => { URL.revokeObjectURL(urls.js); URL.revokeObjectURL(urls.wasm) } }
    } catch (error) {
      if (signal.aborted) throw error
      return undefined // Older deployments can still use the normal decoder.
    }
  } : undefined
}

export function compressedPCModel(signal: AbortSignal, progress?: (fraction: number) => void): (() => Promise<ArrayBuffer>) | undefined {
  const transfer = manifest()
  return transfer ? async () => {
    const cached = modelBytes ?? await storedModel(transfer)
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    if (cached) { modelBytes = cached; progress?.(1); return cached.slice(0) }
    const remember = (data: ArrayBuffer) => {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      if (validModel(data)) { modelBytes = data; void storeModel(transfer, data) }
      return data.slice(0)
    }
    if (transfer.parts) {
      try { return remember(await modelParts(transfer.parts, signal, progress)) }
      catch (error) { if (signal.aborted) throw error }
    }
    try { return remember(await unpack(transfer.compressedModel, signal)) }
    catch (error) {
      if (signal.aborted) throw error
      return remember(await unpack(transfer.compressedModel.replace(/\.gz$/, ''), signal))
    }
  } : undefined
}
