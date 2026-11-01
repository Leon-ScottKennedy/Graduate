import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const loader = createRequire(import.meta.url)
loader.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8').replaceAll('import.meta.env.VITE_API_BASE_URL', "'/api'").replaceAll('import.meta.env.MODE', "'test'")
  module._compile(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, filename)
}
const access = loader('../src/services/siteAccess.ts')
const { postJson } = loader('../src/services/apiClient.ts')
const originalFetch = globalThis.fetch
const originalNow = Date.now
let sessionRequests = 0
let authorized = 0
globalThis.fetch = async (url, options) => {
  assert.equal(options.credentials, 'omit')
  if (url.endsWith('/access/session')) {
    sessionRequests++
    assert.deepEqual(JSON.parse(options.body), { code: 'test-visitor-code' })
    return Response.json({ accessToken: 'limited-visitor-token', expiresIn: 60 })
  }
  if (options.headers.get('Authorization') === 'Bearer limited-visitor-token') {
    authorized++
    return Response.json({ ok: true })
  }
  return Response.json({ detail: { code: 'access_required', message: 'unlock' } }, { status: 401 })
}
try {
  const first = postJson('/ai/chat', {})
  const second = postJson('/ai/recommendations', {})
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(access.accessOpen.value, true)
  await access.unlockAccess('test-visitor-code')
  assert.deepEqual(await first, { ok: true })
  assert.deepEqual(await second, { ok: true })
  assert.equal(sessionRequests, 1, 'Concurrent API requests share one access-code dialog')
  assert.equal(authorized, 2)
  assert.equal(access.accessOpen.value, false)
  Date.now = () => originalNow() + 61000
  assert.equal(access.getAccessToken(), '', 'Expired visitor tokens are not sent')
  Date.now = originalNow
  access.invalidateAccessToken('limited-visitor-token')
  const abort = new AbortController()
  const aborted = assert.rejects(access.requestAccess(abort.signal), { name: 'AbortError' })
  abort.abort()
  await aborted
  assert.equal(access.accessOpen.value, false)
  const canceled = assert.rejects(access.requestAccess(), /尚未解锁/)
  access.cancelAccess()
  await canceled
  console.log('PASS: single shared access prompt, authenticated retries, memory token expiry, abort and cancel cleanup')
} finally {
  access.cancelAccess()
  globalThis.fetch = originalFetch
  Date.now = originalNow
}
