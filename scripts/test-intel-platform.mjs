import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require = createRequire(import.meta.url)
require.extensions['.ts'] = (module, file) => {
  const source = fs.readFileSync(file, 'utf8').replace(/import \{[^}]*\} from '\.\/apiClient'/g,
    'const frontendOnly = false; const postJson = () => { throw new Error("network disabled") }')
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file)
}
const { getBuildCatalog } = require('../src/services/catalogService.ts')
const { selectBuild } = require('../src/services/buildSelection.ts')
const { hardwareSocket, checkBuildCompatibility } = require('../src/services/buildCompatibility.ts')
const { planCpuReplacement } = require('../src/services/platformReplacement.ts')
const { selectComparisonCandidates } = require('../src/services/candidateSelection.ts')
const catalog = getBuildCatalog()
const before = JSON.stringify(catalog)
for (const platform of ['AMD', 'Intel']) {
  for (const budget of [9000, 18000]) {
    for (const usage of ['游戏电竞', '内容创作']) {
      const result = selectBuild(catalog, budget, usage, '均衡搭配', platform)
      assert.ok(result, `${platform} ${budget} ${usage}: build should be available`)
      assert.ok(result.chosen.cpu.brand.includes(platform))
      assert.equal(hardwareSocket(result.chosen.cpu), hardwareSocket(result.chosen.board))
      assert.ok(result.total <= budget)
      assert.equal(checkBuildCompatibility(result.chosen).errors.length, 0)
    }
  }
}
const original = selectBuild(catalog, 9000, '游戏电竞', '均衡搭配', 'AMD').chosen
const intel = catalog.find(group => group.id === 'cpu').options.find(part => part.name.includes('14600K'))
assert.ok(selectComparisonCandidates(catalog.find(group => group.id === 'cpu'), original.cpu, new Set()).some(part => part.id === intel.id), 'Intel must appear in CPU comparisons without a socket filter')
const snapshot = JSON.stringify(original)
const plan = planCpuReplacement(original, intel, catalog, 18000)
assert.ok(plan)
assert.equal(hardwareSocket(plan.chosen.board), 'LGA1700')
assert.ok(plan.chosen.cooler.compatibility.coolerSockets.includes('LGA1700'))
assert.equal(checkBuildCompatibility(plan.chosen).errors.length, 0)
assert.ok(plan.changes.includes('board'))
for (const category of ['gpu', 'ram', 'ssd', 'power', 'case']) assert.equal(plan.chosen[category], original[category], 'Platform switch must keep unrelated parts')
assert.equal(planCpuReplacement(original, intel, catalog, 1), null, 'Never apply an over-budget platform switch')
const withoutIntelBoards = catalog.map(group => group.id === 'board' ? { ...group, options: group.options.filter(part => hardwareSocket(part) !== 'LGA1700') } : group)
assert.equal(planCpuReplacement(original, intel, withoutIntelBoards, 18000), null)
assert.equal(selectBuild(withoutIntelBoards, 9000, '游戏电竞', '均衡搭配', 'Intel'), null)
const reverse = planCpuReplacement(plan.chosen, original.cpu, catalog, 18000)
assert.ok(reverse)
assert.equal(hardwareSocket(reverse.chosen.board), 'AM5')
assert.equal(JSON.stringify(original), snapshot)
assert.equal(JSON.stringify(catalog), before)
console.log('PASS: AMD/Intel selection, CPU comparisons, atomic cross-platform swaps, reverse swaps, budget/availability guards and no mutation.')
