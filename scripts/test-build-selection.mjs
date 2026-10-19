import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const loadTypeScript = createRequire(import.meta.url)

// Load the pure TypeScript selector using the project's existing compiler.
loadTypeScript.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  module._compile(outputText, filename)
}
const { demoParts } = loadTypeScript('../src/data/mock/catalog.ts')
const { selectBuild } = loadTypeScript('../src/services/buildSelection.ts')
const before = JSON.stringify(demoParts)
const budgets = [3000, 3500, 5000, 7000, 9000, 11000, 14200, 18000, 22000, 26000, 28600, 30000]
const usages = ['游戏电竞', '内容创作', '办公学习', 'AI 计算']
const preferences = ['均衡搭配', '控制预算', '静音优先']
let checks = 0
for (const budget of budgets) {
  for (const usage of usages) {
    for (const preference of preferences) {
      const result = selectBuild(demoParts, budget, usage, preference)
      const context = JSON.stringify({ budget, usage, preference })
      assert.ok(result, context)
      assert.equal(Object.keys(result.chosen).length, 8, context)
      const sum = Object.values(result.chosen).reduce((total, item) => total + item.price, 0)
      assert.equal(result.total, sum, context)
      assert.ok(sum <= budget, context)
      for (const group of demoParts)
        assert.ok(group.options.includes(result.chosen[group.id]), context)
      const { cpu, gpu, power, board, cooler, case: enclosure } = result.chosen
      assert.ok(power.psuWatts >= (gpu.minPsuWatts ?? (gpu.id === 'gpu-b' ? 650 : 550)), context)
      assert.ok((board.boardTier ?? 1) >= (cpu.minBoardTier ?? 0), context)
      assert.ok((cooler.coolingTier ?? 0) >= (cpu.minCoolingTier ?? 0), context)
      if (['case-a', 'case-entry'].includes(enclosure.id)) {
        assert.ok(!board.specs.includes('· ATX'), context)
        if (enclosure.id === 'case-entry') assert.notEqual(cooler.id, 'cooler-d', context)
      }
      if (usage === '游戏电竞' && preference === '均衡搭配') assert.ok(sum >= budget * 0.9, context)
      checks++
    }
  }
}
const high = selectBuild(demoParts, 28600, '游戏电竞', '均衡搭配')
assert.ok(high.total >= 27000 && high.total <= 28600)
const gaming = selectBuild(demoParts, 14200, '游戏电竞', '均衡搭配')
const office = selectBuild(demoParts, 14200, '办公学习', '均衡搭配')
assert.notDeepEqual(gaming.chosen, office.chosen)
const saving = selectBuild(demoParts, 14200, '游戏电竞', '控制预算')
assert.ok(saving.total < gaming.total)
assert.equal(selectBuild(demoParts, 1000, '游戏电竞', '均衡搭配'), null)
assert.equal(
  JSON.stringify(demoParts),
  before,
  'Selection must not mutate shared reference options',
)
console.log(
  `PASS: ${checks} budget/usage/preference combinations, exact totals, budget limits, prototype component constraints, high-budget regression, no catalog mutation.`,
)
console.log(`¥28,600 gaming budget → reference total ¥${high.total.toLocaleString('en-US')}`)
