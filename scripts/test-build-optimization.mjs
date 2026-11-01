import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require = createRequire(import.meta.url)
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file)
const { demoParts } = require('../src/data/mock/catalog.ts')
const { selectBuild } = require('../src/services/buildSelection.ts')
const { optimizeGamingBuild, buildSignature } = require('../src/services/buildOptimization.ts')
const { checkBuildCompatibility } = require('../src/services/buildCompatibility.ts')
const current = selectBuild(demoParts, 9000, '游戏电竞', '均衡搭配').chosen
current.gpu = { ...current.gpu, id: 'fixture-5060ti', name: '影驰 RTX 5060 Ti 8GB', specs: '8GB', price: 3999, minPsuWatts: 600 }
const target = { ...current.gpu, id: 'fixture-5070', name: '微星 RTX 5070 12GB', specs: '12GB', price: 5500, minPsuWatts: 650 }
const groups = demoParts.map(group => group.id === 'gpu' ? { ...group, options: [current.gpu, target] } : group)
const before = JSON.stringify([groups, current])
const plan = optimizeGamingBuild(groups, current, 9000, '游戏电竞')[0]
assert.ok(plan)
assert.equal(plan.status, 'ready')
assert.ok(plan.total <= 9000)
assert.equal(plan.chosen.gpu.id, target.id)
assert.ok(plan.changes.some(change => change.category !== 'gpu' && change.delta < 0))
assert.ok(plan.chosen.ram.name.includes('32GB'))
assert.ok(plan.chosen.ssd.name.includes('1TB') || plan.chosen.ssd.name.includes('2TB'))
assert.ok(plan.chosen.power.psuWatts >= Math.max(current.power.psuWatts, target.minPsuWatts))
assert.equal(checkBuildCompatibility(plan.chosen).errors.length, 0)
assert.equal(plan.baseline, buildSignature(current))
assert.equal(JSON.stringify([groups, current]), before, 'Planning must not change the current build/catalog')
const unquoted = groups.map(group => group.id === 'gpu' ? { ...group, options: [current.gpu, { ...target, price: 0, requiresQuote: true }] } : group)
const conditional = optimizeGamingBuild(unquoted, current, 9000, '游戏电竞')[0]
assert.equal(conditional.status, 'needs_quote')
assert.equal(conditional.total, null)
assert.ok(conditional.maxGpuPrice >= 5500)
const trial = optimizeGamingBuild(unquoted, current, 9000, '游戏电竞', { [target.id]: 5500 })[0]
assert.equal(trial.status, 'ready')
assert.equal(trial.trialPrice, true)
assert.equal(trial.target.marketOffer, undefined)
const expensive = optimizeGamingBuild(unquoted, current, 9000, '游戏电竞', { [target.id]: conditional.maxGpuPrice + 100 })[0]
assert.equal(expensive.status, 'over_budget')
assert.ok(expensive.total > 9000)
assert.deepEqual(optimizeGamingBuild(groups, current, 9000, '办公学习'), [])
const aiPlan = optimizeGamingBuild(groups, current, 9000, '游戏电竞', {}, {
  category: 'gpu', targets: [{id: target.id, reduceCategories: ['cpu', 'cooler', 'ssd']}],
})[0]
assert.ok(aiPlan)
assert.ok(aiPlan.changes.every(change => ['gpu','cpu','cooler','ssd','power'].includes(change.category)))
const memoryHeavy = { ...current, ram: { ...current.ram, id: 'fixture-64gb', name: 'DDR5 6000 64GB', specs: '32GB × 2', price: 1099 } }
assert.deepEqual(optimizeGamingBuild(groups, memoryHeavy, 12000, '游戏电竞', {}, {
  category: 'ram', targets: [{ id: current.ram.id, reduceCategories: [] }], preserveCapacity: true,
}), [], 'Mixed creation/AI demand must not silently reduce the target memory capacity')
const aiGpu = { ...current, gpu: { ...current.gpu, name: 'RTX 5060 Ti 16GB', specs: '16GB' } }
assert.deepEqual(optimizeGamingBuild(groups, aiGpu, 12000, '游戏电竞', {}, {
  category: 'gpu', targets: [{ id: target.id, reduceCategories: ['cpu'] }], preserveGpuMemory: true,
}), [], 'An AI-heavy mixed workload must not silently lose VRAM for a gaming upgrade')
const fixedSupports = optimizeGamingBuild(groups, current, 9000, '游戏电竞', {}, {
  category: 'gpu', targets: [{id: target.id, reduceCategories: []}],
})[0]
assert.equal(fixedSupports.status, 'over_budget', 'AI did not permit funding from other parts')
const cpuTarget = { ...current.cpu, id: 'fixture-upgraded-cpu', name: 'AMD Ryzen 7 9700X', price: current.cpu.price + 200 }
const cpuGroups = groups.map(group => group.id === 'cpu' ? { ...group, options: [...group.options, cpuTarget] } : group)
const cpuPlan = optimizeGamingBuild(cpuGroups, current, 12000, '内容创作', {}, {
  category: 'cpu', targets: [{ id: cpuTarget.id, reduceCategories: [] }],
})[0]
assert.equal(cpuPlan.status, 'ready')
assert.equal(cpuPlan.targetCategory, 'cpu')
assert.equal(cpuPlan.chosen.gpu.id, current.gpu.id)
console.log('PASS: 5060 Ti → 5070 with multi-part funding, budget, capacity/power floors, compatibility, conditional/trial prices, over-budget rejection, no mutation.')
