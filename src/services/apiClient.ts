const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`请求失败：HTTP ${response.status}`)
  return response.json() as Promise<T>
}
