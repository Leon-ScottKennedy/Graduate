import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const loader = createRequire(import.meta.url)
loader.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename)
}
const { previewPartDrop } = loader('../src/services/buildDrag.ts')
const { demoParts } = loader('../src/data/mock/catalog.ts')
const { selectBuild } = loader('../src/services/buildSelection.ts')
const build = selectBuild(demoParts, 9000, '游戏电竞', '均衡搭配').chosen
const before = JSON.stringify(build)
const total = Object.values(build).reduce((sum, part) => sum + Math.round(part.price * 100), 0) / 100
const ram = { ...build.ram, id: 'drag-ram', price: build.ram.price + 100.25 }
const preview = previewPartDrop(build, 'ram', 'ram', ram, total + 50)
assert.equal(preview.allowed, true)
assert.equal(preview.total, total + 100.25)
assert.equal(preview.remaining, -50.25, 'Manual over-budget replacement stays possible with an explicit preview')
assert.equal(previewPartDrop(build, 'ram', 'gpu', ram, 9000), null)
assert.equal(previewPartDrop(build, 'unknown', 'unknown', ram, 9000), null)
for (const option of [{ ...ram, price: 0 }, { ...ram, price: NaN }, { ...ram, requiresQuote: true }]) {
  assert.equal(previewPartDrop(build, 'ram', 'ram', option, 9000), null)
}
const mismatched = { ...ram, compatibility: { ...ram.compatibility, memoryType: 'DDR4' } }
const ddr5Build = { ...build, board: { ...build.board, compatibility: { ...build.board.compatibility, memoryType: 'DDR5' } } }
assert.equal(previewPartDrop(ddr5Build, 'ram', 'ram', mismatched, 9000).allowed, false)
assert.equal(JSON.stringify(build), before, 'A hover preview must never modify the current build')
console.log('PASS: drag preview category guard, missing prices, compatibility rejection, exact totals, over-budget preview and no mutation')
