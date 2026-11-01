import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file)
const { demoParts } = require('../src/data/mock/catalog.ts')
const { browseHardware } = require('../src/services/hardwareBrowse.ts')
const { partSpecifications } = require('../src/services/partSpecifications.ts')
let total = 0
let missingCount = 0
for (const group of demoParts) {
  const parts = browseHardware(group)
  const missing = parts.flatMap(part => {
    const fields = partSpecifications(part, group.id).filter(row => /待补充|待核验|待确认/.test(row.value)).map(row => row.label)
    return fields.length ? [{ name: part.name, fields }] : []
  })
  const count = missing.reduce((sum, part) => sum + part.fields.length, 0)
  console.log(`${group.label}: ${parts.length} models; ${missing.length} with missing fields; ${count} missing values`)
  for (const part of missing) console.log(`  ${part.name}: ${part.fields.join(' / ')}`)
  total += parts.length
  missingCount += count
}
console.log(`Inspected ${total} models across ${demoParts.length} categories; ${missingCount} missing values remain. Counts cover the currently defined comparison fields, not every possible manufacturer parameter.`)
