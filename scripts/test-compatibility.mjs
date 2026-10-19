import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
const load = createRequire(import.meta.url)
load.extensions['.ts'] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  )
const { checkBuildCompatibility, checkReplacement } = load('../src/services/buildCompatibility.ts')
const { selectBuild } = load('../src/services/buildSelection.ts')
const { demoParts } = load('../src/data/mock/catalog.ts')
const build = selectBuild(demoParts, 9000, '游戏电竞', '均衡搭配').chosen
const before = JSON.stringify(build)
const codes = (result) => result.errors.map((issue) => issue.code)
const warningCodes = (result) => result.warnings.map((issue) => issue.code)
assert.deepEqual(codes(checkBuildCompatibility(build)), [])
assert.ok(checkBuildCompatibility(build).pending.some((issue) => issue.code === 'bios'))
assert.ok(
  warningCodes(checkReplacement(build, 'gpu', { ...build.gpu, minPsuWatts: 850 })).includes(
    'power',
  ),
)
assert.ok(
  warningCodes(checkReplacement(build, 'power', { ...build.power, psuWatts: 300 })).includes(
    'power',
  ),
)
assert.ok(codes(checkReplacement(build, 'cpu', { ...build.cpu, specs: 'AM4' })).includes('socket'))
assert.ok(
  codes(
    checkReplacement(build, 'ram', { ...build.ram, name: 'DDR4', specs: 'DDR4 32GB' }),
  ).includes('memory'),
)
assert.ok(
  codes(checkReplacement(build, 'board', { ...build.board, specs: 'AM5 · DDR5 · ATX' })).includes(
    'board-case',
  ),
)
assert.ok(
  codes(
    checkReplacement(build, 'cooler', {
      ...build.cooler,
      compatibility: { coolerSockets: ['AM4'] },
    }),
  ).includes('cooler-socket'),
)
assert.ok(
  codes(
    checkReplacement(build, 'cooler', { ...build.cooler, compatibility: { coolerHeightMm: 180 } }),
  ).length === 0,
)
const dimensioned = {
  ...build,
  case: { ...build.case, compatibility: { maxGpuLengthMm: 300, maxCoolerHeightMm: 155 } },
}
assert.ok(
  codes(
    checkReplacement(dimensioned, 'gpu', { ...build.gpu, compatibility: { gpuLengthMm: 320 } }),
  ).includes('gpu-length'),
)
assert.ok(
  codes(
    checkReplacement(dimensioned, 'cooler', {
      ...build.cooler,
      compatibility: { coolerHeightMm: 160 },
    }),
  ).includes('cooler-height'),
)
const radiator = { ...build.cooler, specs: '360 水冷 · AM5', coolingTier: 2 }
assert.ok(
  !codes(checkReplacement(build, 'cooler', radiator)).includes('radiator'),
  'CH370 supports 360mm',
)
assert.ok(
  checkReplacement(build, 'cooler', radiator).pending.some(
    (issue) => issue.code === 'radiator-space',
  ),
)
const small = { ...build, cooler: radiator, case: { ...build.case, id: 'candidate-case-entry' } }
assert.ok(codes(checkBuildCompatibility(small)).includes('radiator'))
assert.ok(
  warningCodes(checkReplacement(build, 'cpu', { ...build.cpu, minCoolingTier: 2 })).includes(
    'cooling-tier',
  ),
)
assert.ok(
  warningCodes(checkReplacement(build, 'cpu', { ...build.cpu, minBoardTier: 2 })).includes(
    'board-tier',
  ),
)
assert.deepEqual(checkBuildCompatibility({}).errors, [])
assert.ok(checkBuildCompatibility({}).pending.length > 0)
assert.equal(JSON.stringify(build), before)
let checked = 0
for (const budget of [3000, 5000, 9000, 14200, 28600, 30000]) {
  for (const usage of ['游戏电竞', '内容创作', '办公学习', 'AI 计算']) {
    const selected = selectBuild(demoParts, budget, usage, '均衡搭配').chosen
    assert.deepEqual(codes(checkBuildCompatibility(selected)), [], `${budget}/${usage}`)
    checked++
  }
}
console.log(
  `Compatibility checks passed: conflict directions, unknown metadata, CH370 regression, ${checked} builds`,
)
