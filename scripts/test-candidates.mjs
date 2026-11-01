import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const loader = createRequire(import.meta.url)
loader.extensions['.ts'] = (module, filename) => {
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  )
}
const { selectSpecificationCandidates: selectCandidates, selectCandidates: selectPriceCandidates, selectComparisonCandidates } = loader('../src/services/candidateSelection.ts')
const { demoParts } = loader('../src/data/mock/catalog.ts')
const { selectBuild } = loader('../src/services/buildSelection.ts')
const { hardwareGeneration } = loader('../src/services/hardwareGeneration.ts')
const { candidateOptions } = loader('../src/data/mock/candidateOptions.ts')
const { sameGpuModel } = loader('../src/services/candidateSelection.ts')
const { candidatePriceCeiling } = loader('../src/services/candidateSelection.ts')
assert.equal(candidatePriceCeiling(599, .15), 689, 'A 599-yuan base admits the 689-yuan rounded boundary')
const graphics = name => ({ id: name, name, specs: '16GB', price: 5000, brand: 'Test' })
assert.ok(!sameGpuModel(graphics('RX 9070'), graphics('RX 9070 XT')))
assert.ok(!sameGpuModel(graphics('RX 7900 XT'), graphics('RX 7900 XTX')))
assert.ok(sameGpuModel(graphics('ARC 770'), graphics('ARC 770')))
const catalogBefore = JSON.stringify(demoParts)
let covered = 0
for (const category of demoParts) {
  for (const selected of category.options) {
    const alternatives = selectCandidates(category, selected)
    assert.ok(alternatives.length > 0, `No alternatives: ${selected.id}`)
    assert.ok(
      alternatives.every((item) => item.id !== selected.id),
      selected.id,
    )
    assert.ok(
      alternatives.every(
        (item) => item.price >= selected.price * 0.8 && item.price <= selected.price * 1.2,
      ),
      selected.id,
    )
    assert.equal(new Set(alternatives.map((item) => item.name)).size, alternatives.length)
    for (const alternative of alternatives) {
      assert.ok(
        selectCandidates(category, alternative).length > 0,
        `Replacement dead end: ${alternative.id}`,
      )
    }
    covered++
  }
}
for (const budget of [3000, 5000, 9000, 14200, 28600, 30000]) {
  for (const usage of ['游戏电竞', '内容创作', '办公学习', 'AI 计算']) {
    const build = selectBuild(demoParts, budget, usage, '均衡搭配')
    for (const category of demoParts) {
      assert.ok(
        selectCandidates(category, build.chosen[category.id]).length > 0,
        `${budget}/${usage}/${category.id}`,
      )
    }
  }
}
assert.equal(JSON.stringify(demoParts), catalogBefore)
// Unknown models must never acquire a performance cohort just because they share a price.
for (const category of demoParts) {
  assert.deepEqual(selectCandidates(category, { ...category.options[0], id: 'unknown' }), [])
}
const gpu = demoParts.find((group) => group.id === 'gpu')
const current = gpu.options[1]
const before = JSON.stringify(gpu)
const result = selectCandidates(gpu, current)
assert.equal(result.length, 2)
assert.ok(result.every((item) => item.name.includes('4070 SUPER')))
assert.ok(result.every((item) => item.id !== current.id))
assert.ok(result.every((item) => Math.abs(item.price / current.price - 1) <= 0.2))
assert.equal(JSON.stringify(gpu), before)
for (const item of result) {
  assert.ok(selectCandidates(gpu, item).some((option) => option.id === current.id))
  assert.ok(!selectCandidates(gpu, item).some((option) => option.id === item.id))
}
const impostors = gpu.options.map((item) => ({ ...item, price: current.price }))
assert.ok(
  selectCandidates({ ...gpu, options: impostors }, current).every((item) =>
    item.name.includes('4070 SUPER'),
  ),
)
const expensive = { ...result[0], price: current.price * 1.21 }
const group = { ...gpu, options: [current, expensive] }
assert.ok(!selectCandidates(group, current).some((item) => item.id === expensive.id))
const wrongCapacity = { ...result[0], specs: 'RTX 4070 SUPER · 24GB', name: 'RTX 4070 SUPER 24GB' }
assert.ok(
  !selectCandidates({ ...gpu, options: [current, wrongCapacity] }, current).some(
    (item) => item.id === wrongCapacity.id,
  ),
)
const cpu = demoParts.find((group) => group.id === 'cpu')
assert.equal(selectCandidates(cpu, cpu.options[1])[0].id, 'candidate-cpu-7700x')
assert.ok(!selectCandidates(cpu, cpu.options[1]).some((item) => /7800X3D|7500F/.test(item.name)))
const ram = demoParts.find((group) => group.id === 'ram')
assert.ok(!selectCandidates(ram, ram.options[0]).some((item) => item.name.includes('64GB')))
assert.ok(
  Object.values(candidateOptions)
    .flat()
    .every((item) => item.requiresQuote ? item.price === 0 && !!item.specSource : item.tag === '预设参考价'),
)
const screenshotGpu = gpu.options.find(part => /4070 Ti SUPER/.test(part.name))
const offlineAlternatives = selectComparisonCandidates(gpu, screenshotGpu, new Set(), { priceRange: 0.1 })
assert.ok(offlineAlternatives.some(part => part.brand.includes('华硕') && part.price > 0))
assert.ok(offlineAlternatives.some(part => part.brand.includes('七彩虹') && !part.requiresQuote && part.referencePrice))
assert.ok(offlineAlternatives.some(part => part.brand.includes('技嘉') && !part.requiresQuote && part.referencePrice))
assert.ok(offlineAlternatives.every(part => part.id !== screenshotGpu.id && /4070 Ti SUPER/.test(part.name)))
assert.ok(!offlineAlternatives.some(part => /RTX 4070 SUPER|RTX 4070 ·/.test(part.specs)))
assert.ok(offlineAlternatives.filter(part => part.price > 0).every(part => part.price / screenshotGpu.price - 1 <= 0.100000001))
assert.deepEqual(selectComparisonCandidates(gpu, screenshotGpu, new Set(), { priceRange: 0.1, brand: '七彩虹 Colorful' }).map(part => part.id), ['candidate-gpu-colorful-4070tis'])
const gpu5060 = { ...current, id: 'screenshot-5060ti', brand: '影驰 GALAX', name: '影驰 GeForce RTX 5060 Ti 圣刃 OC 8GB', specs: 'RTX 5060 Ti · 8GB GDDR7', price: 3999 }
const alternatives5060 = selectComparisonCandidates(gpu, gpu5060, new Set(), { priceRange: 0.15 })
assert.ok(alternatives5060.length >= 5)
const all5060 = selectComparisonCandidates(gpu, gpu5060, new Set())
for (const brand of ['华硕','微星','技嘉','七彩虹']) assert.ok(all5060.some(part => part.brand.includes(brand) && part.price > 0 && !part.requiresQuote), brand)
assert.ok(alternatives5060.some(part => part.id === 'cross-msi-5060ti-ventus-8' && part.price === 3199), 'A cheaper same-chip model remains visible without changing its price')
for (const series of ['Dual','PRIME','TUF Gaming']) assert.ok(alternatives5060.some(part => part.name.includes(series)), series)
assert.ok(alternatives5060.every(part => /5060 Ti/.test(part.name) && /8GB/.test(part.specs)))
for (const id of ['board','ram','ssd']) {
  const category = demoParts.find(group => group.id === id)
  const selected = category.options.find(part => ['board-a','ram-a','ssd-a'].includes(part.id))
  const candidates = selectComparisonCandidates(category, selected, new Set(), { priceRange: 0.15 })
  const allModels = selectComparisonCandidates(category, selected, new Set())
  assert.ok(allModels.length >= 3 && allModels.every(part => part.price > 0 && !part.requiresQuote), `${id} priced cross-brand alternatives`)
  assert.ok(candidates.length > 0)
  assert.ok(allModels.some(part => part.brand !== selected.brand), `${id} needs another brand`)
  assert.ok(candidates.filter(part => !part.requiresQuote && part.price > 0).every(part => part.price <= Math.round(selected.price * 1.15)))
}
// Apply the saving policy to every category, with the positive boundary intact.
for (const category of demoParts) {
  const selected = category.options[0]
  const variant = (id, price) => ({ ...selected, id, name: `${selected.name} ${id}`, price })
  const cheap = variant('discount-fixture', selected.price * 0.4)
  const edge = variant('premium-edge-fixture', Math.round(selected.price * 1.15))
  const over = variant('premium-over-fixture', Math.round(selected.price * 1.15) + .01)
  const fixture = { ...category, options: [...category.options, cheap, edge, over] }
  const result = selectComparisonCandidates(fixture, selected, new Set(), { priceRange: 0.15 })
  assert.ok(result.some(part => part.id === cheap.id), `${category.id}: 60% saving must remain visible`)
  assert.ok(result.some(part => part.id === edge.id), `${category.id}: exact +15% remains visible`)
  assert.ok(!result.some(part => part.id === over.id), `${category.id}: above +15% remains excluded`)
  assert.ok(!result.some(part => part.id === selected.id))
}
const wrongCheapGpu = { ...gpu5060, id: 'wrong-cheap-gpu', name: 'RTX 5060 8GB', price: 100 }
assert.ok(!selectComparisonCandidates({ ...gpu, options: [...gpu.options, wrongCheapGpu] }, gpu5060, new Set(), { priceRange: 0.15 }).some(part => part.id === wrongCheapGpu.id), 'A cheaper different chip does not become a same-chip alternative')
console.log(
  `Candidate regression checks passed: ${covered} base models; 192 budget/usage/category combinations`,
)

// Real shopping alternatives need not share a chipset, core count, capacity or wattage.
for (const category of demoParts) {
  for (const selected of category.options) {
    const all = selectPriceCandidates(category, selected)
    assert.ok(all.length >= selectCandidates(category, selected).length)
    assert.ok(all.every((item) => item.id !== selected.id))
    const nearby = selectPriceCandidates(category, selected, { priceRange: 0.35 })
    assert.ok(nearby.every((item) => item.price > 0 && !item.requiresQuote && Math.abs(item.price / selected.price - 1) <= 0.350000001))
    const priced = all.filter((item) => item.price > 0 && !item.requiresQuote)
    for (let index = 1; index < priced.length; index++) {
      const previousGeneration = hardwareGeneration(category.id, priced[index-1])
      const nextGeneration = hardwareGeneration(category.id, priced[index])
      assert.ok(previousGeneration >= nextGeneration)
      if (previousGeneration === nextGeneration)
        assert.ok(Math.abs(priced[index].price-selected.price) >= Math.abs(priced[index-1].price-selected.price))
    }
  }
}
const widerGpu = selectPriceCandidates(gpu, gpu.options.find((item) => item.id === 'gpu-d'), { priceRange: 0.35 })
assert.ok(widerGpu.some((item) => item.name.includes('4070 Ti SUPER')))
assert.ok(selectPriceCandidates(gpu, current).some((item) => !item.requiresQuote && item.price > 0 && item.referencePrice && item.name.includes('5070')))
const nearCpu = selectPriceCandidates(cpu, cpu.options[1], { priceRange: 0.5 })
assert.ok(nearCpu.some((item) => item.name.includes('7600')))
assert.ok(nearCpu.some((item) => item.name.includes('7800X3D')))
const power = demoParts.find((item) => item.id === 'power')
assert.ok(selectPriceCandidates(power, power.options[0], { priceRange: 0.5 }).some((item) => item.psuWatts !== power.options[0].psuWatts))
assert.ok(selectPriceCandidates(gpu, current, {brand: '华硕 ASUS'}).every((item) => item.brand === '华硕 ASUS'))
assert.ok(selectPriceCandidates(gpu, current, {query: '5070'}).every((item) => item.name.includes('5070')))
assert.equal(JSON.stringify(demoParts), catalogBefore)
console.log('Price alternatives passed: cross-chip/core/wattage choices, filters, missing prices, stable price ordering')
