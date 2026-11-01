import { getAccessToken, invalidateAccessToken, requestAccess } from './siteAccess'

const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
export const frontendOnly = import.meta.env.MODE === 'pages'

async function requestJson<T>(path: string, options: RequestInit, retried = false): Promise<T> {
  if (frontendOnly) throw new Error('当前为前端展示版，暂未连接在线 AI 和商品采集服务；本地选配、对比和拖动可正常使用。')
  let response: Response
  const token = getAccessToken()
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
      credentials: 'omit',
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('无法连接后端，请确认后端已启动。')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    if (response.status === 401 && body?.detail?.code === 'access_required' && !retried) {
      invalidateAccessToken(token)
      await requestAccess(options.signal ?? undefined)
      return requestJson<T>(path, options, true)
    }
    const message = typeof body?.detail === 'string' ? body.detail : body?.detail?.message
    const code = body?.detail?.code
    throw new Error(
      message ? `${message}${code ? `（${code}）` : ''}` : `请求失败：HTTP ${response.status}`,
    )
  }
  return response.json() as Promise<T>
}

export function getJson<T>(path: string, signal?: AbortSignal) {
  return requestJson<T>(path, { signal })
}
export function postJson<T>(path: string, body: unknown, signal?: AbortSignal) {
  return requestJson<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    signal,
  })
}
