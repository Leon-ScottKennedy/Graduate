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
const { demoParts } = loader('../src/data/mock/catalog.ts')
const { hardwareExpansion } = loader('../src/data/hardwareExpansion.ts')
const { browseHardware } = loader('../src/services/hardwareBrowse.ts')
const { checkReplacement } = loader('../src/services/buildCompatibility.ts')
const { selectBuild } = loader('../src/services/buildSelection.ts')
const before = JSON.stringify(demoParts)
let total = 0
for (const group of demoParts) {
  const options = browseHardware(group)
  assert.equal(new Set(options.map(o => o.name)).size, options.length)
  assert.equal(new Set(options.map(o => o.id)).size, options.length)
  total += options.length
}
assert.equal(total, 115)
assert.equal(Object.values(hardwareExpansion).flat().length, 30)
for (const option of Object.values(hardwareExpansion).flat()) {
  assert.equal(option.price, 0)
  assert.equal(option.requiresQuote, true)
  assert.ok(option.specSource.startsWith('https://'))
  assert.equal(option.priceSource, undefined)
}
const build = selectBuild(demoParts, 9000, '游戏电竞', '均衡搭配').chosen
const intel = hardwareExpansion.cpu.find(o => o.name.includes('14600K'))
assert.ok(checkReplacement(build, 'cpu', intel).errors.some(e => e.code === 'socket'))
assert.equal(JSON.stringify(demoParts), before)
console.log('PASS: 115 unique browse models; 30 sourced, unpriced additions; socket conflicts and unchanged auto-build catalog.')
