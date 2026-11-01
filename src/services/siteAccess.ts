import { ref } from 'vue'

const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
export const accessOpen = ref(false)
export const accessBusy = ref(false)
export const accessError = ref('')
let sessionToken = ''
let sessionExpires = 0
let loginReader: AbortController | undefined
const waiting = new Set<{ resolve: (token: string) => void; reject: (error: Error) => void }>()

// The token is a limited visitor session, kept only in memory, never a vendor/admin key.
export function getAccessToken() {
  return Date.now() < sessionExpires ? sessionToken : ''
}
export function invalidateAccessToken(rejected: string) {
  if (sessionToken === rejected) { sessionToken = ''; sessionExpires = 0 }
}
export function requestAccess(signal?: AbortSignal): Promise<string> {
  const token = getAccessToken()
  if (token) return Promise.resolve(token)
  if (signal?.aborted) return Promise.reject(new DOMException('请求已取消', 'AbortError'))
  accessOpen.value = true
  return new Promise((resolve, reject) => {
    const finish = () => { waiting.delete(entry); signal?.removeEventListener('abort', abort) }
    const entry = {
      resolve: (value: string) => { finish(); resolve(value) },
      reject: (error: Error) => { finish(); reject(error) },
    }
    const abort = () => {
      entry.reject(new DOMException('请求已取消', 'AbortError'))
      if (!waiting.size) cancelAccess()
    }
    waiting.add(entry)
    signal?.addEventListener('abort', abort, { once: true })
  })
}
export function cancelAccess() {
  loginReader?.abort()
  loginReader = undefined
  accessOpen.value = false
  accessBusy.value = false
  accessError.value = ''
  for (const entry of waiting) entry.reject(new Error('在线功能尚未解锁，已有配置和本地对比仍可使用'))
}
export async function unlockAccess(code: string) {
  if (accessBusy.value) return
  accessBusy.value = true
  accessError.value = ''
  const reader = new AbortController()
  loginReader = reader
  try {
    const response = await fetch(`${apiBase}/access/session`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ code }), signal: reader.signal, credentials: 'omit' })
    const data = await response.json()
    if (!response.ok) throw new Error(response.status === 429 ? '尝试次数较多，请稍后重试' : '访问码不正确或服务暂不可用')
    if (typeof data.accessToken !== 'string' || typeof data.expiresIn !== 'number') throw new Error('访问验证暂不可用')
    sessionToken = data.accessToken
    sessionExpires = Date.now() + data.expiresIn * 1000
    accessOpen.value = false
    for (const entry of waiting) entry.resolve(sessionToken)
  } catch (error) {
    if (!reader.signal.aborted) accessError.value = error instanceof Error ? error.message : '访问验证暂不可用'
  } finally {
    if (loginReader === reader) { accessBusy.value = false; loginReader = undefined }
  }
}
