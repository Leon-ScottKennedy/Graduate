import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require = createRequire(import.meta.url)
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file)
const { initialDemandWeights, adjustDemandWeight, demandAxes, dominantDemand } = require('../src/services/demandWeights.ts')
for (const usage of [...demandAxes.map(axis => axis.label), 'unknown']) {
  let weights = initialDemandWeights(usage)
  assert.equal(Object.values(weights).reduce((sum, value) => sum + value, 0), 100)
  for (const axis of demandAxes) {
    for (const amount of [0, 1, 33, 50, 99, 100, -20, 150]) {
      const before = JSON.stringify(weights)
      const next = adjustDemandWeight(weights, axis.id, amount)
      assert.equal(JSON.stringify(weights), before, 'Slider adjustment must not mutate the previous state')
      assert.equal(Object.values(next).reduce((sum, value) => sum + value, 0), 100)
      assert.equal(next[axis.id], Math.max(0, Math.min(100, amount)))
      assert.ok(Object.values(next).every(value => Number.isInteger(value) && value >= 0 && value <= 100))
      weights = next
    }
  }
}
assert.deepEqual(adjustDemandWeight({ gaming: 100, creation: 0, office: 0, ai: 0 }, 'gaming', 0), { gaming: 0, creation: 34, office: 33, ai: 33 })
assert.equal(dominantDemand({ gaming: 10, creation: 20, office: 0, ai: 70 }).id, 'ai')
assert.equal(initialDemandWeights('办公学习').office, 70)
console.log('PASS: demand sliders preserve an exact 100% total, boundaries, zero-share redistribution, dominant usage and immutability.')
