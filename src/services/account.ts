import { ref } from 'vue'
import type { PartOption } from '../types/hardware'

export const accountUser = ref<{ id: string; email: string } | null>(null)
export interface AccountConfig { id: string; name: string; createdAt: number; snapshot: { budget: number; usage: string; parts: Record<string, PartOption> } }
const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
let sessionVersion = 0
async function accountRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const requestSession = sessionVersion
  if (import.meta.env.MODE === 'pages') throw new Error('当前是静态展示版，注册登录需启动项目后端。')
  let response: Response
  try {
    response = await fetch(`${base}/auth${path}`, { method, credentials: 'include',
      headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body) })
  } catch { throw new Error('无法连接后端，请先启动 npm run dev。') }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && path !== '/login' && path !== '/me' && requestSession === sessionVersion) accountUser.value = null
    throw new Error(typeof data.detail === 'string' ? data.detail : '输入内容无效，请检查邮箱、验证码和密码。')
  }
  return data as T
}
export async function refreshAccount() {
  if (import.meta.env.MODE === 'pages') return
  const version = sessionVersion
  try { const result = await accountRequest<{ user: NonNullable<typeof accountUser.value> }>('/me'); if (version === sessionVersion) accountUser.value = result.user }
  catch { if (version === sessionVersion) accountUser.value = null }
}
export const sendRegistrationCode = (email: string) => accountRequest<{ message: string; retryAfter: number }>('/code', 'POST', { email })
export async function authenticate(email: string, password: string, code?: string) {
  const result = await accountRequest<{ user: NonNullable<typeof accountUser.value> }>(code === undefined ? '/login' : '/register', 'POST', { email, password, ...(code === undefined ? {} : { code }) })
  accountUser.value = result.user
  sessionVersion++
}
export async function logoutAccount() { await accountRequest('/logout', 'POST', {}); sessionVersion++; accountUser.value = null }
export const getAccountConfigs = () => accountRequest<{ configs: AccountConfig[] }>('/configs')
export const deleteAccountConfig = (id: string) => accountRequest(`/configs/${encodeURIComponent(id)}`, 'DELETE')
export const saveAccountConfig = (name: string, budget: number, usage: string, parts: Record<string, PartOption>) => accountRequest('/configs', 'POST', { name, budget, usage, parts })
