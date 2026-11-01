<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { currentTheme } from '../../services/theme'
import { compressedPCDecoder, compressedPCModel, loadPCModule, prefetchPCResource } from './pcStartup'

const host = ref<HTMLElement>()
const ready = ref(false)
const loading = ref(false)
const failed = ref(false)
const modelProgress = ref<number>()
const poster = computed(() => `${import.meta.env.BASE_URL}models/nexbuild/pc-half${currentTheme.value === 'light' ? '-light' : ''}.webp`)
let dead = false
let engine: { dispose: () => void; resize: () => void } | undefined
let motion: MediaQueryList | undefined
let starting = false
let attempts = 0
let retry: ReturnType<typeof setTimeout> | undefined
let request: AbortController | undefined
function failure(signal: AbortSignal) {
  if (dead || signal.aborted || request?.signal !== signal) return
  starting = false; ready.value = false; loading.value = false; failed.value = true
  if (++attempts < 3) retry = setTimeout(() => { void start() }, 1200 * attempts)
}
async function start() {
  if (starting || dead || !host.value) return
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (motion?.matches || connection?.saveData || (memory !== undefined && memory < 4)) return
  clearTimeout(retry)
  request?.abort(); engine?.dispose(); engine = undefined
  const pending = new AbortController()
  request = pending
  starting = true; loading.value = true; failed.value = false
  modelProgress.value = undefined
  try {
    const model = prefetchPCResource(compressedPCModel(pending.signal, fraction => {
      if (!dead && !pending.signal.aborted) modelProgress.value = Math.round(fraction * 100)
    }))
    // Decoder URLs are created only when the scene requests them, so cancelled
    // navigation cannot leave prefetched Blob URLs behind.
    const decoder = compressedPCDecoder(pending.signal)
    const { createPCScene } = await loadPCModule(() => import('./pcScene'), pending.signal)
    if (dead || pending.signal.aborted || !host.value) return
    const instance = await createPCScene(host.value, {
      model,
      decoder,
      ready: () => { if (!dead && !pending.signal.aborted) { ready.value = true; loading.value = false; failed.value = false; attempts = 0 } },
      failed: () => failure(pending.signal),
    })
    if (dead || pending.signal.aborted) instance.dispose()
    else engine = instance
  } catch { failure(pending.signal) }
}
function preference() {
  if (motion?.matches) {
    clearTimeout(retry); request?.abort(); loading.value = false; failed.value = false
    engine?.dispose(); engine = undefined; starting = false; ready.value = false
  } else { starting = false; void start() }
}
onMounted(() => {
  motion = matchMedia('(prefers-reduced-motion: reduce)')
  motion.addEventListener('change', preference)
  // Hero is above the fold: begin fetching immediately instead of waiting
  // for another visibility callback after the entry animation.
  void start()
})
onUnmounted(() => {
  dead = true; clearTimeout(retry); request?.abort(); motion?.removeEventListener('change', preference); engine?.dispose()
})
</script>

<template>
  <figure class="pc-exploded" :class="{ 'is-ready': ready }" aria-label="自动循环拆解与组装的 RGB 水冷电脑">
    <img class="pc-poster" :src="poster" width="880" height="1000" alt="半展开的 NexBuild 水冷电脑" fetchpriority="high" :aria-hidden="ready" />
    <div ref="host" class="pc-canvas" :class="{ 'is-visible': ready }"></div>
    <figcaption v-if="!ready && (loading || failed)" class="pc-loading" aria-live="polite">
      <span v-if="loading">{{ modelProgress === 100 ? '正在初始化 3D 动画…' : `正在加载 3D 动画${modelProgress === undefined ? '…' : ` ${modelProgress}%`}` }}</span>
      <button v-else type="button" @click="attempts = 0; start()">动画加载失败，点击重试</button>
    </figcaption>
  </figure>
</template>

<style scoped>
.pc-exploded { position: relative; width: 100%; height: min(78svh,920px); min-height: 420px; margin: 0; isolation: isolate;
  animation: pc-hero-reveal 2.2s cubic-bezier(.4,0,.2,1) 650ms both; }
/* One entrance for both the poster and WebGL. Loading only crossfades them,
   so a cached poster cannot appear before the title or replay the entrance. */
@keyframes pc-hero-reveal {
  from { opacity: 0; translate: 0 16px; }
  to { opacity: 1; translate: 0 0; }
}
.pc-canvas { position: absolute; inset: 0; opacity: 0;
  transition: opacity .7s ease; touch-action: pan-y; }
.pc-canvas.is-visible { opacity: 1; }
.pc-canvas :deep(canvas) { display: block; width: 100%; height: 100%; }
.pc-poster { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; transition: opacity .7s; pointer-events: none; }
.is-ready .pc-poster { opacity: 0; }
.pc-loading { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); font-size: 12px; color: var(--color-text-secondary, #999); white-space: nowrap; }
.pc-loading button { font: inherit; color: inherit; background: transparent; border: 0; padding: 6px 0; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
@media(max-width:900px) { .pc-exploded { height: min(50svh,560px); min-height: 260px; } }
@media(prefers-reduced-motion:reduce) { .pc-exploded { animation: none; } .pc-canvas,.pc-poster { transition: none; } }
</style>
