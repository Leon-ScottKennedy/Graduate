import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const children = new Set()
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (!child.pid) continue
    if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    else child.kill('SIGTERM')
  }
  process.exitCode = code
}
function start(command, args) {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', windowsHide: true })
  children.add(child)
  child.on('error', error => { console.error(`启动失败：${error.message}`); stop(1) })
  child.on('exit', code => { children.delete(child); stop(code ?? 0) })
  return child
}
async function healthy() {
  try {
    const response = await fetch('http://127.0.0.1:8000/api/health', { signal: AbortSignal.timeout(800) })
    return response.ok && (await response.json()).status === 'ok'
  } catch { return false }
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
if (!await healthy()) {
  const localPython = path.join(root, 'server', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
  start(existsSync(localPython) ? localPython : 'python', ['-m', 'uvicorn', 'app.main:app', '--app-dir', 'server', '--host', '127.0.0.1', '--port', '8000', '--reload', '--reload-dir', 'server/app'])
  const deadline = Date.now() + 20000
  while (!stopping && !await healthy() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 250))
  if (!stopping && !await healthy()) { console.error('后端未能启动，请检查 Python 依赖和端口 8000。'); stop(1) }
}
if (!stopping) {
  console.log('后端已就绪：http://127.0.0.1:8000')
  if (!process.argv.includes('--backend-only'))
    start(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), ...process.argv.slice(2)])
}
