<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import LoginDialog from '../components/LoginDialog.vue'
import { accountUser, getAccountConfigs, saveAccountConfig } from '../services/account'
import BuildPartInspector from '../components/build/BuildPartInspector.vue'
import BuildAssistant from '../components/build/BuildAssistant.vue'
import BuildAssistantMascot from '../components/build/BuildAssistantMascot.vue'
import BuildBudgetSlider from '../components/build/BuildBudgetSlider.vue'
import { getBuildCatalog, loadBuildCatalog, getConfigPlanSelection } from '../services/catalogService'
import { selectBuild, type CpuPlatform } from '../services/buildSelection'
import { planCpuReplacement } from '../services/platformReplacement'
import { checkBuildCompatibility, checkReplacement, hardwareSocket } from '../services/buildCompatibility'
import { buildSignature, type OptimizationPlan } from '../services/buildOptimization'
import type { PartOption } from '../types/hardware'
import { money } from '../utils/format'
import { previewPartDrop } from '../services/buildDrag'
import '../assets/styles/build-workspace.css'
import '../assets/styles/build-pixel.css'

const demoParts = reactive(getBuildCatalog())
const route = useRoute()
const initialPlan = getConfigPlanSelection(route.query.plan)
const loginOpen = ref(false)
const savingConfig = ref(false)
async function saveCurrentConfig() {
  if (!accountUser.value) { loginOpen.value = true; return }
  if (savingConfig.value) return
  savingConfig.value = true
  try {
    await saveAccountConfig(`${usage.value} · ${money(total.value)}`, budget.value, usage.value, chosen.value)
    notice.value = '配置已保存，可在“配置方案 → 我的配置”中查看。'
  } catch (issue) { notice.value = issue instanceof Error ? issue.message : '保存失败，请重试' }
  finally { savingConfig.value = false }
}
let preserveImportedBuild = !!initialPlan
const catalogReader = new AbortController()
const budget = ref(initialPlan?.budget ?? 9000)
const assistant = ref<InstanceType<typeof BuildAssistant> | null>(null)
const budgetInput = ref<number | string>(budget.value)
const budgetNumber = ref<HTMLInputElement | null>(null)
let budgetNudge: Animation | undefined
let budgetNudgeDirection = 0

function animateBudget(amount: number, previous: number) {
  const element = budgetNumber.value
  if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const strength = Math.min(1, Math.max(0, (amount - 3000) / 27000))
  const direction = Math.sign(amount - previous)
  if (!direction) return
  const x = direction * (2 + strength * 3)
  const y = -direction * (3 + strength * 5)
  // Finish a brief nudge during continuous dragging; respond immediately to reversals.
  if (budgetNudge?.playState === 'running' && budgetNudgeDirection === direction) return
  const currentTransform = getComputedStyle(element).transform
  budgetNudge?.cancel()
  budgetNudgeDirection = direction
  budgetNudge = element.animate(
    [
      { transform: currentTransform === 'none' ? 'translate(0, 0)' : currentTransform, offset: 0 },
      { transform: `translate(${x}px, ${y}px)`, offset: 0.35 },
      { transform: 'translate(0, 0)', offset: 1 },
    ],
    { duration: 240, easing: 'ease-in-out' },
  )
}
const usage = ref(initialPlan?.usage ?? '游戏电竞')
const preference = ref('均衡搭配')
const platform = ref<CpuPlatform>('all')
const platformOptions = [{ id: 'all', label: '不限平台' }, { id: 'AMD', label: 'AMD' }, { id: 'Intel', label: 'Intel' }] as const
const generatedPlatform = ref<CpuPlatform>('all')
const generatedFor = ref(`${usage.value} · 均衡搭配`)
const usageOptions = ['游戏电竞', '内容创作', '办公学习', 'AI 计算']
const preferences = ['均衡搭配', '性价比优先', '性能优先']
const preferenceDescriptions: Record<string, string> = {
  均衡搭配: '兼顾性能、容量与预算',
  性价比优先: '适当节省预算，够用为主',
  性能优先: '更多预算分给处理器和显卡',
}
const chosen = ref<Record<string, PartOption>>(
  initialPlan?.chosen ?? selectBuild(demoParts, budget.value, usage.value, preference.value)?.chosen ??
    Object.fromEntries(demoParts.map((part) => [part.id, part.options[0]])),
)
const generatedBudget = ref(budget.value)
const buildResult = ref<HTMLElement | null>(null)
let rowAnimations: Animation[] = []
function revealBuildRows() {
  rowAnimations.forEach(animation => animation.cancel())
  rowAnimations = []
  if (!buildResult.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  rowAnimations = Array.from(buildResult.value.querySelectorAll<HTMLElement>('.nb-part-row')).map((element, index) => {
    const animation = element.animate([
      { opacity: 0, transform: 'translateY(14px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 360, delay: index * 60, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' })
    animation.onfinish = () => animation.cancel()
    return animation
  })
}
watch(chosen, revealBuildRows, { flush: 'post' })
const changedParts = ref<string[]>([])
let changedPartsTimer: ReturnType<typeof setTimeout> | undefined
watch(chosen, (next, previous) => {
  clearTimeout(changedPartsTimer)
  changedParts.value = Object.keys(next).filter(id => next[id]?.id !== previous[id]?.id || next[id]?.price !== previous[id]?.price)
  changedPartsTimer = setTimeout(() => { changedParts.value = [] }, 1100)
})
const selectedId = ref(initialPlan?.name === '办公影音' ? 'cpu' : 'gpu')
const selectedGroup = computed(
  () => demoParts.find((part) => part.id === selectedId.value) ?? demoParts[0]!,
)
const selectedOption = computed(
  () => chosen.value[selectedGroup.value.id] ?? selectedGroup.value.options[0],
)
const rows = computed(() =>
  demoParts.map((group) => ({ ...group, selected: chosen.value[group.id] ?? group.options[0] })),
)
const total = computed(() => rows.value.reduce((sum, row) => sum + row.selected.price, 0))
const totalNumber = ref<HTMLElement | null>(null)
let totalAnimation: Animation | undefined
watch(total, () => {
  totalAnimation?.cancel()
  if (!totalNumber.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  totalAnimation = totalNumber.value.animate([
    { opacity: .45, transform: 'translateY(4px)' },
    { opacity: 1, transform: 'translateY(0)' },
  ], { duration: 300, easing: 'cubic-bezier(.22, 1, .36, 1)' })
}, { flush: 'post' })
const quotedCount = computed(() => rows.value.filter((row) => row.selected.priceSource || row.selected.marketOffer).length)
const hoveredAllocation = ref<string | null>(null)
const focusedAllocation = ref<string | null>(null)
const activeAllocation = computed(() =>
  rows.value.find((row) => row.id === (hoveredAllocation.value ?? focusedAllocation.value)),
)
function allocationPercent(price: number) {
  return `${((price / total.value) * 100).toFixed(1)}%`
}
const remaining = computed(() => budget.value - total.value)
const draggedPart = ref<{ category: string; option: PartOption; baseline: string } | null>(null)
const dropCategory = ref('')
const dropPreview = computed(() => draggedPart.value
  ? previewPartDrop(chosen.value, draggedPart.value.category, draggedPart.value.category, draggedPart.value.option, budget.value)
  : null)
function clearDrag() { draggedPart.value = null; dropCategory.value = '' }
function startPartDrag(category: string, option: PartOption) {
  rowAnimations.forEach(animation => animation.cancel())
  draggedPart.value = { category, option, baseline: buildSignature(chosen.value) }
}
function dragOverBuild(event: DragEvent) {
  if (!draggedPart.value) return
  event.preventDefault()
  dropCategory.value = draggedPart.value.category
  if (event.dataTransfer) event.dataTransfer.dropEffect = dropPreview.value?.allowed ? 'copy' : 'none'
}
function leaveBuild(event: DragEvent) {
  if (event.currentTarget instanceof Node && event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
  dropCategory.value = ''
}
function dropPart(event: DragEvent) {
  const dragged = draggedPart.value
  if (!dragged) return
  const category = dragged.category
  event.preventDefault()
  clearDrag()
  if (dragged.baseline !== buildSignature(chosen.value)) {
    notice.value = '配置已变化，请重新拖动候选配件。'
    return
  }
  const preview = previewPartDrop(chosen.value, dragged.category, category, dragged.option, budget.value)
  if (!preview?.allowed) {
    notice.value = `无法替换：${preview?.compatibility.errors[0]?.message ?? '该配件暂无有效报价'}`
    return
  }
  selectedId.value = category
  replace(dragged.option, category)
  notice.value = `已替换为 ${dragged.option.name}。${preview.remaining < 0 ? `超出预算 ${money(-preview.remaining)}。` : `预算余量 ${money(preview.remaining)}。`}${preview.compatibility.warnings[0]?.message ?? ''}`
}
watch(chosen, clearDrag)
const notice = ref(initialPlan ? `已载入「${initialPlan.name}」完整配置，可继续调整配件。` : '')
const calculating = ref(false)
const calculationStatus = ref('')
let selectionWorker: Worker | undefined
let statusTimer: ReturnType<typeof setTimeout> | undefined
let completedTimer: ReturnType<typeof setTimeout> | undefined
function cancelCalculation() {
  selectionWorker?.terminate()
  selectionWorker = undefined
  clearTimeout(statusTimer)
  clearTimeout(completedTimer)
  calculating.value = false
  calculationStatus.value = ''
}
let budgetTimer: ReturnType<typeof setTimeout> | undefined
const requests = ['预算怎么分配？', '报价从哪里来？', '这套配置兼容吗？']

function selectUsage(value: string) {
  usage.value = value
}
function selectPreference(value: string) {
  preference.value = value
}
function updateConfiguration(force = false) {
  clearTimeout(budgetTimer)
  const amount = Number(budgetInput.value)
  budget.value =
    String(budgetInput.value).trim() && Number.isFinite(amount)
      ? Math.min(30000, Math.max(3000, Math.round(amount)))
      : budget.value
  budgetInput.value = budget.value
  if (
    !force && budget.value === generatedBudget.value && platform.value === generatedPlatform.value &&
    generatedFor.value === `${usage.value} · ${preference.value}`
  ) {
    cancelCalculation()
    return
  }
  cancelCalculation()
  preserveImportedBuild = false
  calculating.value = true
  statusTimer = setTimeout(() => { calculationStatus.value = '正在重新搭配…' }, 200)
  const description = `${usage.value} · ${preference.value}`
  const requestedBudget = budget.value
  const requestedPlatform = platform.value
  const worker = new Worker(new URL('../services/buildSelection.worker.ts', import.meta.url), { type: 'module' })
  selectionWorker = worker
  const finish = () => {
    clearTimeout(statusTimer)
    calculating.value = false
    worker.terminate()
    selectionWorker = undefined
  }
  const fail = () => {
    if (selectionWorker !== worker) return
    finish()
    calculationStatus.value = '搭配未完成'
    notice.value = '重新搭配暂未完成，请切换用途重试；当前配置已保留。'
  }
  worker.onmessage = (event: MessageEvent<{ selection?: ReturnType<typeof selectBuild>; error?: boolean }>) => {
    if (selectionWorker !== worker) return
    if (event.data.error) { fail(); return }
    finish()
    const selection = event.data.selection
    if (!selection) {
      calculationStatus.value = '暂无合适配置'
      notice.value = '当前候选无法组成预算内的完整配置，请调整预算。'
      return
    }
    chosen.value = selection.chosen
    generatedBudget.value = requestedBudget
    generatedPlatform.value = requestedPlatform
    generatedFor.value = description
    calculationStatus.value = '配置已更新'
    completedTimer = setTimeout(() => { calculationStatus.value = '' }, 1800)
    notice.value = quotedCount.value === rows.value.length
      ? '配置已按预算和用途更新，价格采用已记录报价'
      : '配置已按预算和用途更新；未关联店铺的配件采用预设参考价，购买前需核价'
  }
  worker.onerror = fail
  try {
    worker.postMessage({ catalog: JSON.parse(JSON.stringify(demoParts)), budget: budget.value, usage: usage.value, preference: preference.value, platform: platform.value })
  } catch { fail() }
}
watch([usage, preference, platform], () => updateConfiguration())
onMounted(async () => {
  window.addEventListener('dragend', clearDrag)
  revealBuildRows()
  if (typeof route.query.saved === 'string') {
    try {
      const result = await getAccountConfigs()
      if (catalogReader.signal.aborted) return
      const saved = result.configs.find(item => item.id === route.query.saved)
      if (!saved) throw new Error('未找到该配置，或当前账号无权查看。')
      cancelCalculation()
      preserveImportedBuild = true
      budget.value = saved.snapshot.budget
      budgetInput.value = budget.value
      generatedBudget.value = budget.value
      usage.value = saved.snapshot.usage
      generatedFor.value = `${usage.value} · ${preference.value}`
      chosen.value = saved.snapshot.parts
      selectedId.value = chosen.value.gpu?.price === 0 ? 'cpu' : 'gpu'
      notice.value = `已载入「${saved.name}」，可继续调整并保存。`
    } catch (issue) { notice.value = issue instanceof Error ? issue.message : '个人配置加载失败' }
  }
  try {
    const catalog = await loadBuildCatalog(catalogReader.signal)
    if (catalogReader.signal.aborted) return
    demoParts.splice(0, demoParts.length, ...catalog)
    if (!preserveImportedBuild) updateConfiguration(true)
  } catch {
    if (!catalogReader.signal.aborted) notice.value = '商品报价暂时无法同步，当前使用预设参考价'
  }
})
watch(budgetInput, (value, previous) => {
  clearTimeout(budgetTimer)
  const amount = Number(value)
  if (amount !== budget.value) cancelCalculation()
  if (String(value).trim() && Number.isFinite(amount) && Number.isFinite(Number(previous))) {
    animateBudget(amount, Number(previous))
  }
  if (
    String(value).trim() &&
    Number.isFinite(amount) &&
    amount >= 3000 &&
    amount <= 30000 &&
    amount !== budget.value
  ) {
    budgetTimer = setTimeout(updateConfiguration, 300)
  }
})
onUnmounted(() => {
  window.removeEventListener('dragend', clearDrag)
  rowAnimations.forEach(animation => animation.cancel())
  cancelCalculation()
  catalogReader.abort()
  clearTimeout(budgetTimer)
  budgetNudge?.cancel()
  clearTimeout(changedPartsTimer)
  totalAnimation?.cancel()
})
function replace(option: PartOption, category = selectedGroup.value.id) {
  cancelCalculation()
  if (option.requiresQuote || option.price <= 0) {
    notice.value = '该型号尚无有效报价，请先录入并采用店铺报价。'
    return
  }
  if (category === 'cpu' && hardwareSocket(option) !== hardwareSocket(chosen.value.board)) {
    const plan = planCpuReplacement(chosen.value, option, demoParts, budget.value)
    if (!plan) { notice.value = '预算内暂无兼容的换平台方案，当前配置已保留。'; return }
    chosen.value = plan.chosen
    notice.value = `已联动更换 ${plan.changes.map(id => demoParts.find(group => group.id === id)?.label ?? id).join('、')}，整机 ${money(plan.total)}。请核对主板 BIOS 和散热扣具。`
    return
  }
  const check = checkReplacement(chosen.value, category, option)
  if (check.errors.length) {
    notice.value = `无法替换：${check.errors[0]!.message}`
    return
  }
  chosen.value = { ...chosen.value, [category]: option }
  notice.value = ''
}
function applyOptimization(plan: OptimizationPlan) {
  cancelCalculation()
  if (plan.baseline !== buildSignature(chosen.value) || Number(budgetInput.value) !== budget.value) {
    notice.value = '配置或预算已变化，请使用重新计算后的优化方案'
    return
  }
  const parts = demoParts.map(group => plan.chosen[group.id])
  if (plan.status !== 'ready' || demoParts.some(group => {
    const part = plan.chosen[group.id]
    return !part || part.requiresQuote || part.price < 0 || (part.price === 0 && !(group.id === 'gpu' && part.id.startsWith('integrated-')))
  })) return
  const amount = parts.reduce((sum, part) => sum + Math.round(part!.price * 100), 0)
  if ((!plan.allowOverBudget && amount > Math.round(budget.value * 100)) || checkBuildCompatibility(plan.chosen).errors.length) {
    notice.value = '该方案超出预算或存在明确兼容冲突，未应用'
    return
  }
  chosen.value = { ...plan.chosen }
  selectedId.value = plan.targetCategory
  if (amount > Math.round(budget.value * 100)) {
    notice.value = `已应用整机优化方案，超出预算 ${money((amount - Math.round(budget.value * 100)) / 100)}，请留意总价。`
    return
  }
  notice.value = plan.trialPrice ? '已应用整机优化方案，目标配件采用用户输入试算价，购买前请核价' : '已应用整机优化方案，整机未超预算，仍需核验待确认项'
}
</script>

<template>
  <div class="nb-workspace">
    <BuildAssistant
      ref="assistant"
      :build="chosen"
      :budget="budget"
      :usage="usage"
      :total="total"
      :questions="requests"
    />
    <div class="nb-workbench">
      <aside class="nb-requirements nb-card">
        <div class="nb-card-head">
          <div>
            <h2>装机需求</h2>
          </div>
        </div>
        <form @submit.prevent="updateConfiguration()">
          <label class="nb-label" for="build-budget">整机预算 <span>不含显示器与外设</span></label>
          <div class="nb-budget-input">
            <span>¥</span
            ><input
              id="build-budget"
              ref="budgetNumber"
              v-model.number="budgetInput"
              type="number"
              min="3000"
              max="30000"
              step="100"
              required
              @blur="updateConfiguration()"
              @keydown.enter.prevent="updateConfiguration()"
            /><small>元</small>
          </div>
          <BuildBudgetSlider
            v-model.number="budgetInput"
            @change="updateConfiguration()"
          />
          <div class="nb-range-labels"><span>¥3,000</span><span>¥30,000</span></div>
          <fieldset>
            <legend class="nb-label">CPU 平台</legend>
            <div class="nb-choice-grid">
              <button v-for="item in platformOptions" :key="item.id" type="button" :aria-pressed="platform === item.id"
                :class="{ active: platform === item.id }" @click="platform = item.id">{{ item.label }}</button>
            </div>
          </fieldset>
          <fieldset>
            <legend class="nb-label">主要用途</legend>
            <div class="nb-choice-grid">
              <button
                v-for="item in usageOptions"
                :key="item"
                type="button"
                :aria-pressed="usage === item"
                :class="{ active: usage === item }"
                @click="selectUsage(item)"
              >
                {{ item }}

              </button>
            </div>
          </fieldset>
          <fieldset>
            <legend class="nb-label">搭配偏好</legend>
            <div class="nb-choice-stack">
              <button
                v-for="item in preferences"
                :key="item"
                type="button"
                :aria-pressed="preference === item"
                :class="{ active: preference === item }"
                @click="selectPreference(item)"
              >
                <span>{{ item }}</span
                ><span>{{ preference === item ? '●' : '○' }}</span>
              </button>
            </div>
          </fieldset>
          <p class="nb-preference-description">{{ preferenceDescriptions[preference] }}</p>
        </form>
      </aside>
      <div class="nb-main-column">
        <BuildAssistantMascot :expanded="assistant?.isOpen ?? false" @activate="assistant?.show()" />
        <section ref="buildResult" class="nb-result nb-card" aria-labelledby="build-list-title" :aria-busy="calculating"
          @dragover="dragOverBuild" @dragleave="leaveBuild" @drop="dropPart">
          <div class="nb-card-head">
            <div>
              <div class="nb-result-heading">
                <h2 id="build-list-title">配置清单</h2>
                <span class="nb-calculation-status" role="status" aria-live="polite">
                  <i v-if="calculating && calculationStatus" class="nb-calculation-spinner" aria-hidden="true"></i>
                  {{ calculationStatus }}
                </span>
              </div>
              <p>
                {{ generatedFor }}
              </p>
            </div>
            <div class="nb-result-tools"><button type="button" class="nb-save-build" :disabled="savingConfig" @click="saveCurrentConfig">{{ savingConfig ? '保存中…' : '保存配置' }}</button><span class="nb-badge">{{ rows.length }} 项配置</span></div>
          </div>
          <div class="nb-total-row">
            <div>
              <span
                >整机总价 ·
                {{
                  quotedCount ? `${quotedCount}/8 项采用已记录报价，其余参考价` : '预设参考价'
                }}</span
              ><strong ref="totalNumber">{{ money(total) }}</strong>
            </div>
            <div class="nb-budget-state" :class="{ over: remaining < 0 }">
              <span>{{ remaining >= 0 ? '预算余量' : '超出预算' }}</span
              ><b>{{ money(Math.abs(remaining)) }}</b>
            </div>
          </div>
          <div class="nb-allocation-detail" aria-live="polite">
            <span>预算分配</span>
            <span v-if="activeAllocation" class="nb-allocation-value">
              <i :style="{ '--part-color': activeAllocation.color }"></i>
              {{ activeAllocation.label }} · {{ money(activeAllocation.selected.price) }} ·
              {{ allocationPercent(activeAllocation.selected.price) }}
            </span>
          </div>
          <div class="nb-allocation" role="group" aria-label="配件预算占比">
            <button
              v-for="row in rows"
              :key="row.id"
              type="button"
              :class="{
                active: activeAllocation?.id === row.id,
                dimmed: activeAllocation && activeAllocation.id !== row.id,
              }"
              :style="{ flexGrow: row.selected.price, '--part-color': row.color }"
              :aria-label="`${row.label} · ${money(row.selected.price)} · ${allocationPercent(row.selected.price)}`"
              @mouseenter="hoveredAllocation = row.id"
              @mouseleave="hoveredAllocation = null"
              @focus="focusedAllocation = row.id"
              @blur="focusedAllocation = null"
              @click="selectedId = row.id"
            ></button>
          </div>
          <button
            v-for="row in rows"
            :key="row.id"
            class="nb-part-row"
            :class="{ active: selectedId === row.id, 'is-updated': changedParts.includes(row.id), 'is-drop-target': draggedPart?.category === row.id,
              'is-drop-over': dropCategory === row.id, 'is-drop-muted': draggedPart && draggedPart.category !== row.id }"
            type="button"
            :aria-pressed="selectedId === row.id"
            @mouseenter="hoveredAllocation = row.id"
            @mouseleave="hoveredAllocation = null"
            @focus="focusedAllocation = row.id"
            @blur="focusedAllocation = null"
            @click="selectedId = row.id"
          >
            <span class="nb-part-icon" :style="{ '--part-color': row.color }">{{
              row.symbol
            }}</span
            ><span class="nb-part-name"
              ><small>{{ row.label }}</small
              ><strong :title="row.selected.name">{{ row.selected.name }}</strong></span
            ><span class="nb-part-price"
              >{{ money(row.selected.price)
              }}</span
            >
            <span v-if="draggedPart?.category === row.id && dropPreview" class="nb-drop-preview" :class="{ over: dropPreview.remaining < 0 }" aria-live="polite">
              {{ !dropPreview.allowed ? '该配件不兼容，无法替换' : `${dropCategory === row.id ? '松开自动替换此项' : '拖入配置单即可替换此项'} · 整机 ${money(dropPreview.total)} · ${dropPreview.remaining < 0 ? '超预算' : '余量'} ${money(Math.abs(dropPreview.remaining))}` }}
            </span>
          </button>
        </section>
        <p v-if="notice" class="nb-live-message" role="status" aria-live="polite">{{ notice }}</p>
        <BuildPartInspector
          :group="selectedGroup"
          :selected="selectedOption"
          :build="chosen"
          :catalog="demoParts"
          :budget="budget"
          :usage="usage"
          @replace="replace"
          @drag-start="startPartDrag"
          @drag-end="clearDrag"
          @optimize="applyOptimization"
        />
      </div>
    </div>
  </div>
  <LoginDialog v-if="loginOpen" @close="loginOpen = false" />
</template>

<style scoped>
.nb-result-tools { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: 10px; }
.nb-save-build { padding: 7px 12px; border: 1px solid light-dark(#9aa5b5, #666666); border-radius: 0; color: light-dark(#293341, #eeeeee); background: light-dark(#edf0f4, #252525); font-size: 12px; }
</style>
