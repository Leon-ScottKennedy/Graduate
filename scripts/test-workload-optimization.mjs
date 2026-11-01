import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require = createRequire(import.meta.url)
require.extensions['.ts'] = (module, file) => {
  const source = fs.readFileSync(file, 'utf8').replace(/import \{[^}]*\} from '\.\/apiClient'/g, 'const frontendOnly = false; const postJson = () => { throw new Error("network disabled") }')
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file)
}
const { getBuildCatalog, getConfigPlanSelection } = require('../src/services/catalogService.ts')
const { selectBuild } = require('../src/services/buildSelection.ts')
const { workloadCatalog, workloadLocalCatalog, workloadChoices, workloadFacts, validateWorkloadPlan, proposalFromBuild } = require('../src/services/workloadOptimization.ts')
const { buildSignature } = require('../src/services/buildOptimization.ts')
const current = getConfigPlanSelection('主流游戏').chosen
const before = JSON.stringify(current)
const catalog = workloadCatalog(getBuildCatalog(), current)
const weights = { gaming: 56, creation: 24, office: 10, ai: 10 }
const keep = proposalFromBuild(current)
const checked = validateWorkloadPlan(keep, catalog, current, 20000, weights)
assert.ok(checked.plan)
assert.equal(checked.plan.changes.length, 0)
assert.equal(checked.plan.baseline, buildSignature(current))
assert.equal(checked.plan.total, Object.values(current).reduce((sum, part) => sum + part.price, 0))
const unknown = { ...keep, parts: { ...keep.parts, cpu: 'invented-cpu' } }
assert.equal(validateWorkloadPlan(unknown, catalog, current, 20000, weights).plan, null)
const overBudget = validateWorkloadPlan(keep, catalog, current, 3000, weights).plan
assert.ok(overBudget && overBudget.total > 3000 && overBudget.allowOverBudget)
const conflict = { ...keep, parts: { ...keep.parts, cpu: 'library-cpu-core i5-14600k' } }
assert.ok(validateWorkloadPlan(conflict, catalog, current, 30000, weights).errors.some(message => message.includes('接口')))
const smaller = { ...keep, parts: { ...keep.parts, ram: 'ram-entry' } }
assert.ok(validateWorkloadPlan(smaller, catalog, current, 20000, { gaming: 10, creation: 20, office: 10, ai: 60 }).errors.some(message => message.includes('容量')))
const office = getConfigPlanSelection('办公影音').chosen
const officeCatalog = workloadCatalog(getBuildCatalog(), office)
assert.ok(validateWorkloadPlan(proposalFromBuild(office), officeCatalog, office, 5000, { gaming: 5, creation: 5, office: 85, ai: 5 }).plan)
const noGraphics = proposalFromBuild({ ...office, cpu: catalog.find(group => group.id === 'cpu').options.find(part => part.id === 'cpu-a') })
assert.ok(validateWorkloadPlan(noGraphics, officeCatalog, office, 5000, weights).errors.some(message => message.includes('集成显卡')))
const choices = workloadChoices(catalog)
assert.equal(new Set(choices.map(part => `${part.category}:${part.id}`)).size, choices.length)
assert.ok(choices.every(part => part.specs.length <= 600 && part.price >= 0))
assert.equal(workloadFacts(current, 20000, weights)['context.demandWeights'], JSON.stringify(weights))
const gpuWeights = { gaming: 85, creation: 5, office: 5, ai: 5 }
const officeWeights = { gaming: 5, creation: 5, office: 85, ai: 5 }
const game = selectBuild(catalog, 9000, '游戏电竞', '均衡搭配', 'all', gpuWeights)
const work = selectBuild(catalog, 9000, '游戏电竞', '均衡搭配', 'all', officeWeights)
assert.ok(game && work)
assert.ok(game.total <= 9000 && work.total <= 9000)
assert.notEqual(buildSignature(game.chosen), buildSignature(work.chosen), 'All four weights must influence the chosen complete build, independent of the usage label')
const aiWeights = { gaming: 10, creation: 10, office: 10, ai: 70 }
const aiCatalog = workloadLocalCatalog(catalog, current, aiWeights)
assert.ok(!aiCatalog.find(group => group.id === 'ram').options.some(part => part.id === 'ram-entry'))
assert.equal(JSON.stringify(current), before)
console.log('PASS: complete weighted builds, exact totals, capacity floors, unknown IDs, platform conflicts, integrated graphics, no mutation and model provenance.')
