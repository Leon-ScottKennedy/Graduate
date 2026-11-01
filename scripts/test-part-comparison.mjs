import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file)
const { comparePartSpecifications } = require('../src/services/partComparison.ts')
const { partSpecifications } = require('../src/services/partSpecifications.ts')
const { demoParts } = require('../src/data/mock/catalog.ts')
const current = { id: 'left', name: 'Fixture A', brand: 'Fixture', specs: '', tag: '', price: 100,
  parameters: { 共同参数: '相同', 差异参数: 'A', 左侧独有: '已登记' } }
const candidate = { ...current, id: 'right', name: 'Fixture B', parameters: { 共同参数: '相同', 差异参数: 'B', 右侧独有: '已登记' } }
const before = JSON.stringify([current, candidate])
const rows = comparePartSpecifications(current, candidate, 'case')
const row = label => rows.find(item => item.label === label)
assert.equal(row('共同参数').different, false)
assert.equal(row('差异参数').different, true)
assert.equal(row('差异参数').current, 'A')
assert.equal(row('差异参数').candidate, 'B')
assert.equal(row('左侧独有').candidate, '待补充')
assert.equal(row('左侧独有').candidateUnknown, true)
assert.equal(row('右侧独有').currentUnknown, true)
assert.equal(row('支持主板').different, false, 'Two unknown fields must not count as a difference')
assert.equal(JSON.stringify([current, candidate]), before, 'Comparison must not change the selected build or candidate')
for (const group of demoParts) {
  const [left, right] = group.options
  const compared = comparePartSpecifications(left, right, group.id)
  const labels = new Set([...partSpecifications(left, group.id), ...partSpecifications(right, group.id)].map(item => item.label))
  assert.deepEqual(new Set(compared.map(item => item.label)), labels, `${group.id}: include every field from both parts`)
  assert.equal(compared.length, labels.size, 'Parameter labels must be unique')
  assert.ok(comparePartSpecifications(left, left, group.id).every(item => !item.different))
}
console.log('PASS: aligned fields across all 8 categories, differences, missing values, identical parts and no mutation.')
