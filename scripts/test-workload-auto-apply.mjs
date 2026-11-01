import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import Module, { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { effectScope, reactive } from 'vue'
const require = createRequire(import.meta.url)
require.extensions['.ts'] = (module, file) => {
  const source = fs.readFileSync(file, 'utf8').replace(/import \{[^}]*\} from '\.\/apiClient'/g, 'const frontendOnly = false; const postJson = () => { throw new Error("network disabled") }')
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file)
}
const { getBuildCatalog, getConfigPlanSelection } = require('../src/services/catalogService.ts')
const { proposalFromBuild } = require('../src/services/workloadOptimization.ts')
const { buildSignature } = require('../src/services/buildOptimization.ts')
const file = fileURLToPath(new URL('../src/components/build/BuildDemandOptimizer.vue', import.meta.url))
const script = fs.readFileSync(file, 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const weights = { gaming: 56, creation: 24, office: 10, ai: 10 }
async function scenario({ keep = false, reject = false, stale = false, questions = [] } = {}) {
  const scope = effectScope()
  const current = getConfigPlanSelection('主流游戏').chosen
  const props = reactive({ build: current, catalog: getBuildCatalog(), budget: 20000, usage: '游戏电竞' })
  const after = { ...current, cpu: props.catalog.find(group => group.id === 'cpu').options.find(part => part.id === 'library-cpu-ryzen 7 9700x') }
  const proposal = proposalFromBuild(keep ? current : after)
  let release
  let calls = 0
  globalThis.__workloadProps = props
  globalThis.__workloadEmit = (event, plan) => { assert.equal(event, 'apply'); calls++; if (!reject) props.build = plan.chosen }
  globalThis.__workloadPost = () => stale ? new Promise(resolve => { release = resolve }) : Promise.resolve({ provider: 'doubao', summary: 'AI result', demandWeights: weights, questions, plans: questions.length ? [] : [proposal] })
  const source = script
    .replace(/import \{[^}]*\} from 'vue'/, "const { computed, nextTick, ref, watch } = require('vue'); const onUnmounted = () => {}")
    .replace(/import \{ postJson \} from '\.\.\/\.\.\/services\/apiClient'/, 'const postJson = globalThis.__workloadPost')
    .replace(/defineProps<[^\n]+>\(\)/, 'globalThis.__workloadProps')
    .replace(/defineEmits<[^\n]+>\(\)/, 'globalThis.__workloadEmit')
    .replaceAll('import.meta.url', JSON.stringify(new URL('../src/components/build/BuildDemandOptimizer.vue', import.meta.url).href))
    + '\nmodule.exports = { analyze, message, result, appliedPlans, busy };'
  const module = new Module(file, require.cache[file])
  module.filename = file
  module.paths = Module._nodeModulePaths(path.dirname(file))
  let component
  try {
    scope.run(() => module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file))
    component = module.exports
    const request = component.analyze()
    if (stale) {
      props.budget = 19000
      release({ provider: 'doubao', summary: 'stale', demandWeights: weights, questions: [], plans: [proposal] })
    }
    await request
    assert.equal(component.busy.value, false)
    if (stale || questions.length || keep) assert.equal(calls, 0)
    else assert.equal(calls, 1, 'A valid changed build is applied automatically exactly once')
    if (!stale && !reject && !questions.length && !keep) {
      assert.equal(buildSignature(props.build), buildSignature(after))
      assert.equal(component.appliedPlans.value.length, 1, 'Applying our own result must not clear its report')
      assert.match(component.message.value, /已更新配置单/)
    }
    if (reject) {
      assert.equal(buildSignature(props.build), buildSignature(current))
      assert.match(component.message.value, /未自动更换/)
    }
    if (keep) assert.match(component.message.value, /无需更换/)
  } finally { scope.stop() }
}
try {
  await scenario()
  await scenario({ keep: true })
  await scenario({ reject: true })
  await scenario({ stale: true })
  await scenario({ questions: ['请补充用途'] })
  console.log('PASS: automatic whole-build replacement, preserved result report, no-op retention, parent rejection, stale requests and clarification guards.')
} finally {
  delete globalThis.__workloadProps
  delete globalThis.__workloadEmit
  delete globalThis.__workloadPost
}
