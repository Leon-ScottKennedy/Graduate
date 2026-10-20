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
const { selectSpecificationCandidates: selectCandidates, selectCandidates: selectPriceCandidates } = loader('../src/services/candidateSelection.ts')
const { demoParts } = loader('../src/data/mock/catalog.ts')
const { selectBuild } = loader('../src/services/buildSelection.ts')
const { candidateOptions } = loader('../src/data/mock/candidateOptions.ts')
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
    .every((item) => item.tag === '预设参考价'),
)
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
      assert.ok(Math.abs(priced[index].price-selected.price) >= Math.abs(priced[index-1].price-selected.price))
    }
  }
}
const widerGpu = selectPriceCandidates(gpu, gpu.options.find((item) => item.id === 'gpu-d'), { priceRange: 0.35 })
assert.ok(widerGpu.some((item) => item.name.includes('4070 Ti SUPER')))
assert.ok(selectPriceCandidates(gpu, current).some((item) => item.requiresQuote && item.name.includes('5070')))
const nearCpu = selectPriceCandidates(cpu, cpu.options[1], { priceRange: 0.5 })
assert.ok(nearCpu.some((item) => item.name.includes('7600')))
assert.ok(nearCpu.some((item) => item.name.includes('7800X3D')))
const power = demoParts.find((item) => item.id === 'power')
assert.ok(selectPriceCandidates(power, power.options[0], { priceRange: 0.5 }).some((item) => item.psuWatts !== power.options[0].psuWatts))
assert.ok(selectPriceCandidates(gpu, current, {brand: '华硕 ASUS'}).every((item) => item.brand === '华硕 ASUS'))
assert.ok(selectPriceCandidates(gpu, current, {query: '5070'}).every((item) => item.name.includes('5070')))
assert.equal(JSON.stringify(demoParts), catalogBefore)
console.log('Price alternatives passed: cross-chip/core/wattage choices, filters, missing prices, stable price ordering')
