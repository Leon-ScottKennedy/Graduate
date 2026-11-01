import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require = createRequire(import.meta.url)
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8').replaceAll('import.meta.env', '({ MODE: "development", VITE_API_BASE_URL: "" })')
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename)
}
const account = require('../src/services/account.ts')
const originalFetch = globalThis.fetch
const calls = []
let result = {}, status = 200
globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return new Response(JSON.stringify(result), { status }) }
try {
  result = { message: 'Sent', retryAfter: 60 }
  await account.sendRegistrationCode('student@example.com')
  assert.equal(calls.at(-1).url, '/api/auth/code')
  assert.equal(calls.at(-1).credentials, 'include')
  assert.equal(JSON.parse(calls.at(-1).body).email, 'student@example.com')
  result = { user: { id: 'student', email: 'student@example.com' } }
  await account.authenticate('student@example.com', 'long-password', '123456')
  assert.equal(calls.at(-1).url, '/api/auth/register')
  assert.equal(account.accountUser.value.id, 'student')
  assert.equal(JSON.parse(calls.at(-1).body).code, '123456')
  result = { detail: 'Wrong password' }; status = 401
  await assert.rejects(account.authenticate('student@example.com', 'incorrect'), /Wrong password/)
  assert.equal(account.accountUser.value.id, 'student', 'Failed login cannot erase an existing session')
  await assert.rejects(account.getAccountConfigs(), /Wrong password/)
  assert.equal(account.accountUser.value, null, 'Expired personal requests clear the login state')
  status = 200; result = { user: { id: 'student', email: 'student@example.com' } }
  await account.authenticate('student@example.com', 'long-password')
  assert.equal(calls.at(-1).url, '/api/auth/login')
  assert.equal(JSON.parse(calls.at(-1).body).code, undefined)
  result = { configs: [] }
  assert.deepEqual(await account.getAccountConfigs(), { configs: [] })
  await account.deleteAccountConfig('some/id')
  assert.equal(calls.at(-1).url, '/api/auth/configs/some%2Fid')
  assert.equal(calls.at(-1).method, 'DELETE')
  result = {}
  await account.logoutAccount()
  assert.equal(account.accountUser.value, null)
  // A stale initial /me response must not override a newly logged-in account.
  let finishRefresh
  globalThis.fetch = async url => url.endsWith('/me') ? new Promise(resolve => { finishRefresh = resolve }) : new Response(JSON.stringify({ user: { id: 'new-user', email: 'new@example.com' } }))
  const refresh = account.refreshAccount()
  await account.authenticate('new@example.com', 'long-password')
  finishRefresh(new Response(JSON.stringify({ detail: 'Not signed in' }), { status: 401 }))
  await refresh
  assert.equal(account.accountUser.value.id, 'new-user')
  globalThis.fetch = async () => { throw new Error('offline') }
  await assert.rejects(account.sendRegistrationCode('student@example.com'), /无法连接后端/)
  console.log('PASS: email-code registration, login/logout, cookie credentials, expiry, private requests and stale session restoration.')
} finally { globalThis.fetch = originalFetch }
