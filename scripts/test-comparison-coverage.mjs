import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require = createRequire(import.meta.url)
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file)
const { demoParts } = require('../src/data/mock/catalog.ts')
const { browseHardware } = require('../src/services/hardwareBrowse.ts')
const { hardwareExpansion } = require('../src/data/hardwareExpansion.ts')
const { comparisonCatalog } = require('../src/data/comparisonCatalog.ts')
const { withReferencePrice } = require('../src/data/referencePriceBook.ts')
const { selectComparisonCandidates, diversifyCandidates } = require('../src/services/candidateSelection.ts')
let checked = 0
const missing = []
for (const category of ['gpu', 'board', 'ram', 'ssd']) {
  const group = demoParts.find(group => group.id === category)
  const before = JSON.stringify(group)
  const selectedParts = [...group.options, ...(hardwareExpansion[category] ?? [])].map(withReferencePrice)
  for (const selected of selectedParts) {
    const all = selectComparisonCandidates(group, selected, new Set())
    const nearby = selectComparisonCandidates(group, selected, new Set(), { priceRange: 0.15 })
    if (!all.some(part => part.brand !== selected.brand)) missing.push(selected.name)
    assert.ok(all.every(part => part.id !== selected.id && part.price > 0 && !part.requiresQuote), selected.id)
    assert.equal(new Set(all.map(part => part.name)).size, all.length)
    assert.ok(nearby.every(part => part.price <= Math.round(selected.price * 1.15)), selected.id)
    for (const alternative of all) {
      assert.ok(selectComparisonCandidates(group, alternative, new Set()).length > 0, `Dead end: ${alternative.id}`)
    }
    const diverse = diversifyCandidates(all)
    const brandCount = new Set(all.map(part => part.brand)).size
    assert.equal(new Set(diverse.slice(0, brandCount).map(part => part.brand)).size, brandCount)
    checked++
  }
  assert.equal(JSON.stringify(group), before)
  for (const part of comparisonCatalog[category]) {
    assert.equal(part.price, part.referencePrice.amount)
    assert.equal(part.referencePrice.basis, 'public')
    assert.equal(new URL(part.referencePrice.sourceUrl).protocol, 'https:')
    assert.ok(!part.marketOffer && !part.requiresQuote)
    assert.ok(browseHardware(group).some(item => item.id === part.id))
  }
}
const gpu = demoParts.find(group => group.id === 'gpu')
const selected = withReferencePrice(hardwareExpansion.gpu.find(part => part.name.includes('5070 Ti')))
const alternatives = selectComparisonCandidates(gpu, selected, new Set(), { priceRange: 0.15 })
for (const brand of ['华硕', '技嘉', '七彩虹']) assert.ok(alternatives.some(part => part.brand.includes(brand)), brand)
assert.deepEqual(missing, [], 'Every selectable GPU/board/RAM/SSD family needs another brand (not necessarily in-range)')
console.log(`PASS: ${checked} selected-model audits; 5070 Ti has ${alternatives.length} in-range alternatives; cross-brand coverage gaps: ${missing.join(', ') || 'none'}`)
