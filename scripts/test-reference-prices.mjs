import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require = createRequire(import.meta.url)
require.extensions['.ts'] = (module, file) => {
  let source = fs.readFileSync(file, 'utf8')
  source = source.replace(/import \{[^}]*\} from '\.\/apiClient'/g, 'const frontendOnly = false; const postJson = () => { throw new Error("network disabled") }')
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file)
}
const { demoParts } = require('../src/data/mock/catalog.ts')
const { candidateOptions } = require('../src/data/mock/candidateOptions.ts')
const { hardwareExpansion } = require('../src/data/hardwareExpansion.ts')
const { crossBrandCandidates } = require('../src/data/crossBrandCandidates.ts')
const { referencePriceBook, withReferencePrice } = require('../src/data/referencePriceBook.ts')
const { resolveDiscoveryCatalog } = require('../src/services/recommendationDiscovery.ts')
const { getBuildCatalog, getConfigPlans, getConfigPlanSelection } = require('../src/services/catalogService.ts')
const { checkBuildCompatibility } = require('../src/services/buildCompatibility.ts')
const { money } = require('../src/utils/format.ts')
const planCatalog = getBuildCatalog()
const plans = getConfigPlans()
assert.equal(plans.length, 4)
for (const plan of plans) {
  const imported = getConfigPlanSelection(plan.name)
  assert.ok(imported)
  assert.deepEqual(Object.values(imported.chosen).map(part => part.id), plan.detail.map(part => part.hardwareId))
  assert.equal(money(Object.values(imported.chosen).reduce((sum, part) => sum + part.price, 0)), plan.price)
  assert.ok(imported.budget >= Object.values(imported.chosen).reduce((sum, part) => sum + part.price, 0))
  assert.equal(plan.price, money(plan.detail.reduce((sum, part) => sum + part.price, 0)))
  assert.equal(plan.detail.length, 8)
  const build = Object.fromEntries(plan.detail.map(part => {
    const group = planCatalog.find(group => group.label === part.part)
    const option = group.options.find(option => option.id === part.hardwareId)
    if (option) return [group.id, option]
    assert.equal(part.hardwareId, 'integrated-9600x')
    assert.equal(part.price, 0)
    return [group.id, { id: part.hardwareId, name: part.name, price: 0, specs: '集成显卡', minPsuWatts: 300 }]
  }))
  assert.deepEqual(checkBuildCompatibility(build).errors, [], plan.name)
  assert.deepEqual(checkBuildCompatibility(build).warnings, [], plan.name)
  assert.match(build.cpu.name, /9600X|9700X|9900X/)
  if (plan.name !== '办公影音') assert.match(build.gpu.name, /RTX 50/)
  console.log(`${plan.name}: ${plan.price}`)
}
assert.match(plans.find(plan => plan.name === 'AI 工作站').specs.join(' '), /16G.*96GB/s)
assert.equal(getConfigPlanSelection('missing-plan'), undefined)
assert.equal(getConfigPlanSelection(['办公影音']), undefined)
assert.equal(getConfigPlanSelection('办公影音').chosen.gpu.price, 0)
const { selectBuild } = require('../src/services/buildSelection.ts')
const raw = demoParts.flatMap(group => [...group.options, ...(candidateOptions[group.id] ?? []), ...(hardwareExpansion[group.id] ?? []), ...(crossBrandCandidates[group.id] ?? [])])
const before = JSON.stringify(raw)
const missing = raw.filter(part => part.requiresQuote || part.price <= 0)
assert.equal(missing.length, 57)
for (const part of missing) {
  const priced = withReferencePrice(part)
  assert.ok(Number.isFinite(priced.price) && priced.price > 0 && !priced.requiresQuote, part.id)
  assert.equal(priced.referencePrice.amount, priced.price)
  assert.equal(priced.referencePrice.currency, 'CNY')
  assert.ok(priced.referencePrice.note.length > 10)
  assert.equal(new URL(priced.referencePrice.sourceUrl).protocol, 'https:')
  assert.match(priced.referencePrice.checkedAt, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(priced.marketOffer, undefined, 'Public reference must never fabricate a merchant quote')
  assert.equal(priced.priceSource, undefined, 'Public reference must not become a user-confirmed quote')
  if (priced.referencePrice.basis === 'estimated') assert.match(priced.tag, /估算/)
}
assert.equal(JSON.stringify(raw), before)
const target = missing.find(part => part.id === 'cross-msi-5060ti-ventus-8')
const selected = withReferencePrice(target)
const catalog = [{ id: 'gpu', options: [selected, selected] }]
const result = resolveDiscoveryCatalog(catalog, { recommendations: [{ category: 'gpu', optionIds: [target.id], offer: {
  id: 'quote-test', price: 11312, platform: 'taobao', productUrl: 'https://detail.tmall.com/item.htm?id=test', shop: 'Test', collectedAt: '2026-10-24',
} }] })
assert.equal(result[0].options[0].price, 3199, 'Public reference comparison should not be replaced by an unrelated price basis')
assert.equal(result[0].options[0].observedMarketOffer.price, 11312, 'Observed price remains available for inspection')
const manual = { ...target, price: 3500, requiresQuote: false, priceSource: { basis: 'manual' } }
assert.equal(withReferencePrice(manual), manual)
const groups = getBuildCatalog()
for (const budget of [3000, 9000, 18000, 30000]) {
  const chosen = selectBuild(groups, budget, '游戏电竞', '均衡搭配').chosen
  assert.ok(Object.values(chosen).every(part => part.price > 0 && !part.requiresQuote))
  assert.ok(Object.values(chosen).reduce((sum, part) => sum + part.price, 0) <= budget + 0.001)
}
console.log(`PASS: ${missing.length} missing prices covered, ${Object.values(referencePriceBook).filter(price => price.basis === 'estimated').length} estimates labeled; source provenance, quote separation, no mutation, budget checks.`)
