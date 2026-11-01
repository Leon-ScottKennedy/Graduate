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
const { candidateOptions } = loader('../src/data/mock/candidateOptions.ts')
const { crossBrandCandidates } = loader('../src/data/crossBrandCandidates.ts')
const { comparisonCatalog } = loader('../src/data/comparisonCatalog.ts')
const { withReferencePrice } = loader('../src/data/referencePriceBook.ts')
const { browseHardware } = loader('../src/services/hardwareBrowse.ts')
const { checkReplacement } = loader('../src/services/buildCompatibility.ts')
const { selectBuild } = loader('../src/services/buildSelection.ts')
const before = JSON.stringify(demoParts)
let total = 0
for (const group of demoParts) {
  const options = browseHardware(group)
  assert.equal(new Set(options.map(o => o.name)).size, options.length)
  assert.equal(new Set(options.map(o => o.id)).size, options.length)
  const expectedNames = new Set([
    ...group.options, ...(candidateOptions[group.id] ?? []),
    ...(hardwareExpansion[group.id] ?? []), ...(crossBrandCandidates[group.id] ?? []),
    ...(comparisonCatalog[group.id] ?? []),
  ].map(option => option.name.toUpperCase().replace(/\s+/g, '')))
  assert.deepEqual(new Set(options.map(option => option.name.toUpperCase().replace(/\s+/g, ''))), expectedNames)
  total += options.length
}
const additions = Object.values(hardwareExpansion).flat()
assert.ok(additions.length > 0)
for (const option of Object.values(hardwareExpansion).flat()) {
  assert.equal(option.price, 0)
  assert.equal(option.requiresQuote, true)
  assert.ok(option.specSource.startsWith('https://'))
  assert.equal(option.priceSource, undefined)
  const priced = withReferencePrice(option)
  assert.ok(priced.price > 0 && !priced.requiresQuote)
  assert.equal(priced.marketOffer, undefined)
}
const build = selectBuild(demoParts, 9000, '游戏电竞', '均衡搭配').chosen
const intel = hardwareExpansion.cpu.find(o => o.name.includes('14600K'))
assert.ok(checkReplacement(build, 'cpu', intel).errors.some(e => e.code === 'socket'))
assert.equal(JSON.stringify(demoParts), before)
console.log(`PASS: ${total} unique browse models; ${additions.length} sourced additions with separate reference prices; socket conflicts and unchanged auto-build catalog.`)
