// Audit the whole local catalog against the running generic discovery endpoint.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require = createRequire(import.meta.url)
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file)
const { demoParts } = require('../src/data/mock/catalog.ts')
const { browseHardware } = require('../src/services/hardwareBrowse.ts')
const { selectComparisonCandidates } = require('../src/services/candidateSelection.ts')
const model = (category, part) => ({ id: part.id, category, brand: part.brand, modelName: part.name, specs: part.specs })
const results = []
for (const group of demoParts) {
  const catalog = browseHardware(group).map(part => model(group.id, part))
  for (const part of browseHardware(group)) {
    const response = await fetch('http://127.0.0.1:8000/api/market/alternatives/discover', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected: model(group.id, part), catalog, collect: false }), signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error(`${group.id}/${part.id}: HTTP ${response.status}`)
    const data = await response.json()
    const combined = { ...group, options: [...group.options, ...data.options] }
    const all = selectComparisonCandidates(combined, part, new Set())
    const nearby = selectComparisonCandidates(combined, part, new Set(), { priceRange: 0.15 })
    results.push({ category: group.id, id: part.id, name: part.name, total: all.length, inRange: nearby.length,
      discovered: data.options.length, collection: data.collection })
  }
}
fs.mkdirSync('.tmp', { recursive: true })
fs.writeFileSync('.tmp/candidate-discovery-audit.json', JSON.stringify(results, null, 2))
console.log(JSON.stringify({ checked: results.length, withoutCandidates: results.filter(item => !item.total),
  withoutInRange: results.filter(item => !item.inRange).length,
  insufficientSpecs: results.filter(item => item.collection === 'insufficient_specs').map(item => item.name) }, null, 2))
