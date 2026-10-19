const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

async function requestJson<T>(path: string, options: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: { Accept: 'application/json', ...options.headers },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('无法连接后端，请确认后端已启动。')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
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
export function deleteJson<T>(path: string, signal?: AbortSignal) {
  return requestJson<T>(path, { method: 'DELETE', signal })
}

export function postJson<T>(path: string, body: unknown, signal?: AbortSignal) {
  return requestJson<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    signal,
  })
}
