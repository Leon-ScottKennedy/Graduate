<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import type { PartGroup, PartOption } from '../../types/hardware'
import { buildSignature, type OptimizationPlan } from '../../services/buildOptimization'
import { demandAxes, initialDemandWeights, adjustDemandWeight, dominantDemand, type DemandKey } from '../../services/demandWeights'
import { postJson } from '../../services/apiClient'
import { money } from '../../utils/format'
import { checkBuildCompatibility } from '../../services/buildCompatibility'
import { workloadCatalog, workloadLocalCatalog, workloadFacts, workloadChoices, validateWorkloadPlan, proposalFromBuild, type WorkloadAdvice, type WorkloadProposal } from '../../services/workloadOptimization'

const props = defineProps<{ catalog: PartGroup[]; build: Record<string, PartOption>; budget: number; usage: string }>()
const emit = defineEmits<{ apply: [plan: OptimizationPlan] }>()
const weights = ref(initialDemandWeights(props.usage))
const result = ref<WorkloadAdvice | null>(null)
const source = ref<'doubao' | 'local'>('doubao')
const invalidReasons = ref<string[]>([])
const busy = ref(false)
const message = ref('')
const aiFailure = ref('')
const appliedPlans = ref<{ proposal: WorkloadProposal; plan: OptimizationPlan }[]>([])
let applyingBuild = false
let appliedBuildSignature = ''
let appliedContext = ''
const contextSignature = computed(() => JSON.stringify([props.budget, props.usage, weights.value]))
const mainDemand = computed(() => dominantDemand(weights.value))
const resolved = computed(() => workloadCatalog(props.catalog, props.build))
const verified = computed(() => appliedPlans.value.length ? appliedPlans.value : result.value?.plans.flatMap(proposal => {
  const checked = validateWorkloadPlan(proposal, resolved.value, props.build, props.budget, weights.value)
  return checked.plan ? [{ proposal, plan: checked.plan }] : []
}) ?? [])
const signature = computed(() => JSON.stringify([buildSignature(props.build), props.budget, props.usage, weights.value]))
let reader: AbortController | undefined
let applyingWeights = false
let analyzedSignature = ''
function adjust(key: DemandKey, event: Event) {
  weights.value = adjustDemandWeight(weights.value, key, Number((event.target as HTMLInputElement).value))
}
watch(() => props.usage, usage => { weights.value = initialDemandWeights(usage) })
watch(signature, () => {
  if (applyingWeights || applyingBuild) return
  if (appliedBuildSignature === buildSignature(props.build) && appliedContext === contextSignature.value) return
  reader?.abort()
  busy.value = false
  result.value = null
  invalidReasons.value = []
  appliedPlans.value = []
  appliedBuildSignature = ''
  message.value = '需求或配置已调整，请重新分析。'
}, { flush: 'sync' })
async function analyze() {
  if (busy.value) return
  reader?.abort()
  const request = new AbortController()
  reader = request
  const snapshot = signature.value
  busy.value = true
  result.value = null
  invalidReasons.value = []
  appliedPlans.value = []
  appliedBuildSignature = ''
  source.value = 'doubao'
  aiFailure.value = ''
  message.value = 'AI 正在理解需求并优化整机…'
  try {
    const body = { question: '', budget: props.budget, demandWeights: { ...weights.value },
      choices: workloadChoices(resolved.value), facts: workloadFacts(props.build, props.budget, weights.value), rules: checkBuildCompatibility(props.build) }
    let data: WorkloadAdvice
    let repaired = false
    try {
      data = await postJson<WorkloadAdvice>('/ai/workload', body, request.signal)
    } catch (error) {
      const reason = error instanceof Error ? error.message : ''
      if (request.signal.aborted || snapshot !== signature.value || !/^AI (方案|输出被|擅自修改|同时返回|选择了)/.test(reason)) throw error
      repaired = true
      message.value = 'AI 方案未通过校验，正在自动修正…'
      data = await postJson<WorkloadAdvice>('/ai/workload', { ...body, feedback: [reason.slice(0, 600)] }, request.signal)
    }
    const issues = (advice: WorkloadAdvice) => advice.plans.flatMap(proposal => validateWorkloadPlan(proposal, resolved.value, props.build, props.budget, advice.demandWeights).errors)
    if (!repaired && !request.signal.aborted && snapshot === signature.value && issues(data).length) {
      message.value = '程序发现方案冲突，正在让 AI 修正…'
      data = await postJson<WorkloadAdvice>('/ai/workload', { ...body, feedback: [
        `上次未通过校验的方案：${JSON.stringify(data.plans.map(plan => plan.parts))}`.slice(0, 600),
        ...[...new Set(issues(data))].slice(0, 7),
      ] }, request.signal)
    }
    if (request.signal.aborted || snapshot !== signature.value) return
    invalidReasons.value = [...new Set(issues(data))]
    applyingWeights = true
    weights.value = { ...data.demandWeights }
    applyingWeights = false
    result.value = data
    analyzedSignature = signature.value
    message.value = ''
    await applyFirstVerified()
  } catch (error) {
    if (!request.signal.aborted && snapshot === signature.value) {
      aiFailure.value = error instanceof Error ? error.message : '请稍后重试'
      message.value = `AI 分析失败：${aiFailure.value}。正在使用本地规则计算…`
      source.value = 'local'
      try { await localAnalysis(request, snapshot) }
      catch { if (!request.signal.aborted) message.value += ' 本地计算未完成，请重试。' }
    }
  } finally {
    if (reader === request) busy.value = false
  }
}
async function localAnalysis(request: AbortController, snapshot: string) {
  const selection = await new Promise<{ chosen: Record<string, PartOption> } | null>((resolve, reject) => {
    const worker = new Worker(new URL('../../services/buildSelection.worker.ts', import.meta.url), { type: 'module' })
    const finish = () => { worker.terminate(); clearTimeout(timer); request.signal.removeEventListener('abort', abort) }
    const abort = () => { finish(); reject(new DOMException('已取消', 'AbortError')) }
    const timer = setTimeout(() => { finish(); reject(new Error('本地计算超时')) }, 20000)
    worker.onmessage = event => { finish(); if (event.data.error) reject(new Error('本地计算失败')); else resolve(event.data.selection) }
    worker.onerror = () => { finish(); reject(new Error('本地计算失败')) }
    request.signal.addEventListener('abort', abort, { once: true })
    worker.postMessage({ catalog: JSON.parse(JSON.stringify(workloadLocalCatalog(resolved.value, props.build, weights.value))), budget: props.budget, usage: mainDemand.value.label, preference: '均衡搭配', demandWeights: { ...weights.value } })
  })
  if (request.signal.aborted || snapshot !== signature.value) return
  const proposals = selection ? [proposalFromBuild(selection.chosen)] : []
  const keep = proposalFromBuild(props.build)
  if ((!proposals.length || (weights.value.office >= 50 && props.build.gpu?.price === 0)) && validateWorkloadPlan(keep, resolved.value, props.build, props.budget, weights.value).plan) {
    keep.title = '保留当前配置'
    proposals.splice(0, proposals.length, keep)
  }
  const checked = proposals.flatMap(proposal => validateWorkloadPlan(proposal, resolved.value, props.build, props.budget, weights.value).errors)
  invalidReasons.value = checked
  result.value = { provider: 'local', summary: '按四项用途权重、预算和已知兼容规则计算，不是 AI 模型结论。自然语言中的软件、安静等偏好需在线 AI 理解。', demandWeights: { ...weights.value }, questions: [], plans: proposals }
  analyzedSignature = signature.value
  if (!aiFailure.value) message.value = ''
  await applyFirstVerified()
}
async function applyFirstVerified() {
  if (result.value?.questions.length || analyzedSignature !== signature.value) return
  const selected = verified.value[0]
  if (!selected || selected.plan.baseline !== buildSignature(props.build)) return
  const excess = Math.max(0, Math.round((selected.plan.total ?? 0) * 100) - Math.round(props.budget * 100)) / 100
  const prefix = (source.value === 'local' ? `AI 分析失败：${aiFailure.value}。已使用本地规则。` : '') + (excess > 0 ? `方案超出预算 ${money(excess)}。` : '')
  if (!selected.plan.changes.length) { message.value = `${prefix}当前配置已适合这组需求，无需更换。`; return }
  applyingBuild = true
  const context = contextSignature.value
  appliedPlans.value = [selected]
  try {
    emit('apply', selected.plan)
    await nextTick()
    if (buildSignature(props.build) === buildSignature(selected.plan.chosen) && context === contextSignature.value) {
      appliedBuildSignature = buildSignature(props.build)
      appliedContext = context
      message.value = `${prefix}分析完成，已更新配置单中的 ${selected.plan.changes.length} 项配件。`
    } else {
      appliedPlans.value = []
      result.value = null
      message.value = '配置或预算已变化，未自动更换，请重新分析。'
    }
  } finally { applyingBuild = false }
}
onUnmounted(() => reader?.abort())
</script>

<template>
  <div class="demand-optimizer">
    <div class="demand-heading"><h3>这台电脑主要用来做什么？</h3><span>合计 100%</span></div>
    <p class="demand-note">拖动调整需求占比，其余项目会自动平衡。</p>
    <div class="demand-bars">
      <label v-for="axis in demandAxes" :key="axis.id" class="demand-axis" :for="`demand-${axis.id}`">
        <span class="axis-heading"><span>{{ axis.label }}</span><b>{{ weights[axis.id] }}<small>%</small></b></span>
        <input :id="`demand-${axis.id}`" :value="weights[axis.id]" type="range" min="0" max="100" step="1"
          :style="{ '--fill': `${weights[axis.id]}%` }" :aria-valuetext="`${axis.label}占比${weights[axis.id]}%`" @input="adjust(axis.id, $event)" />
        <span class="axis-hint">{{ axis.hint }}</span>
      </label>
    </div>
    <div class="analysis-action">
      <div class="analysis-guidance"><span>分析后自动更新配置单</span><small>方案可能超预算，届时会提示超出金额</small></div>
      <button type="button" :disabled="busy" @click="analyze">{{ busy ? '正在分析并优化…' : '分析并优化' }}</button>
    </div>
    <div v-if="message" class="analysis-feedback" :class="{ 'is-busy': busy }" role="status" aria-live="polite">
      <span class="feedback-marker" aria-hidden="true"></span><p>{{ message }}</p>
    </div>
    <section v-if="result?.questions.length" class="workload-clarification" aria-label="补充需求">
      <ul class="workload-questions"><li v-for="question in result.questions" :key="question">{{ question }}</li></ul>
      <p class="analysis-status">请调整用途占比或预算后重新分析。</p>
    </section>
    <p v-else-if="result && !verified.length" class="analysis-status">本次没有通过校验的完整方案，当前配置已保留。</p>
  </div>
</template>

<style scoped>
.demand-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 8px; }
h3 { margin: 0; font-size: 14px; color: #ddd; font-weight: 600; }
.demand-heading > span { color: #888; font-size: 11px; white-space: nowrap; }
.demand-note { color: #888; font-size: 12px; line-height: 1.7; margin: 8px 0 22px; }
.workload-questions { padding-left: 18px; font-size: 12px; line-height: 1.8; }
.demand-bars { display: grid; gap: 20px; }
.demand-axis { display: grid; gap: 8px; }
.axis-heading { display: flex; align-items: baseline; justify-content: space-between; color: #c5c5c5; font-size: 13px; }
.axis-heading b { color: #ddd; font-size: 17px; font-variant-numeric: tabular-nums; }
.axis-heading small { font-size: 11px; color: #888; margin-left: 3px; font-weight: 400; }
.axis-hint { color: #777; font-size: 11px; }
input[type='range'] { appearance: none; width: 100%; height: 8px; margin: 3px 0; border: 0; border-radius: 3px; background: linear-gradient(to right, #a6cab9 0%, #a6cab9 var(--fill), #252525 var(--fill), #252525 100%); cursor: pointer; }
input[type='range']::-webkit-slider-thumb { appearance: none; height: 14px; width: 14px; border-radius: 50%; background: #ddd; border: 2px solid #101010; box-shadow: 0 0 0 1px #666; }
input[type='range']::-moz-range-thumb { height: 12px; width: 12px; border-radius: 50%; background: #ddd; border: 2px solid #101010; }
input:focus-visible, button:focus-visible { outline: 2px solid #aaa; outline-offset: 5px; }
.analysis-action { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-top: 24px; padding-top: 18px; border-top: 1px solid light-dark(#d8dde5, #292929); }
.analysis-guidance { display: grid; gap: 6px; line-height: 1.6; }
.analysis-guidance > span { color: light-dark(#475569, #bbbbbb); font-size: 12px; }
.analysis-guidance > small { color: light-dark(#64748b, #888888); font-size: 11px; }
.analysis-action button { flex-shrink: 0; }
.analysis-feedback { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; margin-top: 16px; background: light-dark(#eef1f5, #151515); border-left: 2px solid light-dark(#8793a4, #626262); }
.analysis-feedback p { margin: 0; color: light-dark(#374151, #cccccc); font-size: 12px; line-height: 1.8; overflow-wrap: anywhere; }
.feedback-marker { flex: 0 0 5px; height: 5px; margin-top: 8px; background: light-dark(#64748b, #a6cab9); }
.is-busy .feedback-marker { background: light-dark(#64748b, #aaaaaa); }
button { padding: 9px 15px; border: 1px solid #444; color: #ddd; background: #181818; border-radius: 3px; cursor: pointer; font-size: 12px; }
button:hover { background: #222; border-color: #666; }
button:disabled { opacity: .5; cursor: wait; }
button { transition: background-color .16s ease, border-color .16s ease, transform .16s ease; }
button:not(:disabled):active { transform: scale(.98); }
input[type='range']::-webkit-slider-thumb { transition: transform .16s ease; }
input[type='range']::-moz-range-thumb { transition: transform .16s ease; }
input[type='range']:hover::-webkit-slider-thumb { transform: scale(1.15); }
input[type='range']:active::-webkit-slider-thumb { transform: scale(1.25); }
input[type='range']:hover::-moz-range-thumb { transform: scale(1.15); }
input[type='range']:active::-moz-range-thumb { transform: scale(1.25); }
@media (prefers-reduced-motion: reduce) {
  button { transition: none; transform: none !important; }
  input[type='range']::-webkit-slider-thumb { transition: none; transform: none !important; }
  input[type='range']::-moz-range-thumb { transition: none; transform: none !important; }
}
.analysis-status { color: #aaa; font-size: 12px; line-height: 1.9; }
</style>
