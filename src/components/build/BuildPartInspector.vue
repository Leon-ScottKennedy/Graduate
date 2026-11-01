<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import BuildCandidateRow from './BuildCandidateRow.vue'
import BuildPartComparison from './BuildPartComparison.vue'
import BuildDemandOptimizer from './BuildDemandOptimizer.vue'
import type { OptimizationPlan } from '../../services/buildOptimization'
import { resolveDiscoveryCatalog, type DiscoveryResult } from '../../services/recommendationDiscovery'
import type { PartGroup, PartOption } from '../../types/hardware'
import { candidatePriceCeiling, selectComparisonCandidates } from '../../services/candidateSelection'
import { frontendOnly, postJson } from '../../services/apiClient'
import { checkReplacement, hardwareSocket } from '../../services/buildCompatibility'
import { planCpuReplacement } from '../../services/platformReplacement'
import { browseHardware } from '../../services/hardwareBrowse'
import { discoverCandidates } from '../../services/candidateDiscovery'

const props = defineProps<{
  group: PartGroup
  selected: PartOption
  build: Record<string, PartOption>
  catalog: PartGroup[]
  budget: number
  usage: string
}>()
const priceRange = ref('0.15')
const mode = ref('compare')
const brandFilter = ref('')
const query = ref('')
const comparison = ref<PartOption | null>(null)
const needsPlatformSwitch = (part: PartOption) => props.group.id === 'cpu' && hardwareSocket(part) !== hardwareSocket(props.build.board)
const platformPlan = computed(() => comparison.value && needsPlatformSwitch(comparison.value)
  ? planCpuReplacement(props.build, comparison.value, props.catalog, props.budget) : null)
const platformChanges = computed(() => platformPlan.value?.changes.map(category => ({
  label: props.catalog.find(group => group.id === category)?.label ?? category,
  name: platformPlan.value!.chosen[category]!.name, price: platformPlan.value!.chosen[category]!.price,
})))
function replaceCandidate(option: PartOption) {
  if (needsPlatformSwitch(option)) comparison.value = option
  else emit('replace', option)
}
watch(() => [props.group.id, props.selected], () => { comparison.value = null })
function applyComparison(option: PartOption) {
  if (needsPlatformSwitch(option) ? !platformPlan.value : checkReplacement(props.build, props.group.id, option).errors.length) return
  emit('replace', option)
  comparison.value = null
}
const brands = computed(() => [...new Set(browseHardware(resolvedGroup.value).map((item) => item.brand))])
const localOffers = ref<DiscoveryResult>({ summary: '', recommendations: [] })
const discoveredOptions = ref<PartOption[]>([])
const discoveredCatalog = computed(() => props.catalog.map(group => {
  if (group.id !== props.group.id) return group
  const updates = new Map(discoveredOptions.value.map(part => [part.id, part]))
  const existing = browseHardware(group).map(part => {
    const update = updates.get(part.id)
    updates.delete(part.id)
    return update ? { ...part, ...update } : part
  })
  return { ...group, options: [...existing, ...updates.values()] as PartGroup['options'] }
}))
const resolvedCatalog = computed(() => resolveDiscoveryCatalog(discoveredCatalog.value, localOffers.value))
const resolvedGroup = computed(() => resolvedCatalog.value.find(group => group.id === props.group.id) ?? props.group)
const recommendedIds = computed(() => new Set<string>())
const candidates = computed(() =>
  selectComparisonCandidates(resolvedGroup.value, props.selected, recommendedIds.value, {
    priceRange: priceRange.value === 'all' ? undefined : Number(priceRange.value),
    brand: brandFilter.value,
    query: query.value,
  }).filter(part => props.group.id === 'cpu' || !checkReplacement(props.build, props.group.id, part).errors.length)
    .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name, 'zh-CN')),
)
const unpricedNearbyCount = computed(() => resolvedGroup.value.options.filter(item => recommendedIds.value.has(item.id) && (item.requiresQuote || item.price <= 0)).length)
const visibleLimit = ref(8)
const displayedCandidates = computed(() => candidates.value.slice(0, visibleLimit.value))
const outsideRange = computed(() => priceRange.value === 'all' ? [] : selectComparisonCandidates(resolvedGroup.value, props.selected, new Set(), {
  brand: brandFilter.value, query: query.value,
}).filter(part => part.price > 0 && !part.requiresQuote && props.selected.price > 0
  && part.price > candidatePriceCeiling(props.selected.price, Number(priceRange.value)) + 1e-9
  && (props.group.id === 'cpu' || !checkReplacement(props.build, props.group.id, part).errors.length))
  .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name, 'zh-CN')))
const priceCeiling = computed(() => priceRange.value === 'all' ? null : candidatePriceCeiling(props.selected.price, Number(priceRange.value)))
const closestOutside = computed(() => outsideRange.value.reduce<PartOption | null>((closest, part) => !closest || part.price < closest.price ? part : closest, null))
const money = (value: number) => `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
const quoteState = ref('正在查询已有报价…')
const revision = ref(0)
const replacementChecks = computed(() =>
  Object.fromEntries(
    candidates.value.map((option) => [
      option.id,
      checkReplacement(props.build, props.group.id, option),
    ]),
  ),
)
const emit = defineEmits<{ replace: [option: PartOption]; optimize: [plan: OptimizationPlan]; 'drag-start': [category: string, option: PartOption]; 'drag-end': [] }>()
const panel = ref<HTMLElement | null>(null)
const candidateList = ref<HTMLElement | null>(null)
let listSizeObserver: ResizeObserver | undefined
function alignCandidateWindow() {
  const list = candidateList.value
  if (!list) return
  const cards = [...list.querySelectorAll<HTMLElement>(':scope > .candidate-row')]
  if (!cards.length) return
  let index = 0
  for (let i = 1; i <= cards.length - 3; i++) {
    if (Math.abs(cards[i]!.offsetTop - list.scrollTop) < Math.abs(cards[index]!.offsetTop - list.scrollTop)) index = i
  }
  const height = cards.slice(index, index + 3).reduce((sum, card) => sum + card.offsetHeight + parseFloat(getComputedStyle(card).marginBottom || '0'), 0)
  list.style.setProperty('--three-card-height', `${height}px`)
  const top = cards[index]!.offsetTop
  if (Math.abs(list.scrollTop - top) > 1) list.scrollTo({ top, behavior: 'instant' })
}
watch(() => [displayedCandidates.value, mode.value], async () => {
  await nextTick()
  listSizeObserver?.disconnect()
  const list = candidateList.value
  if (!list) return
  list.scrollTop = 0
  const cards = [...list.querySelectorAll<HTMLElement>(':scope > .candidate-row')]
  const measure = () => {
    if (!cards.length) { list.style.removeProperty('--three-card-height'); return }
    alignCandidateWindow()
  }
  listSizeObserver = new ResizeObserver(measure)
  cards.forEach(card => listSizeObserver?.observe(card))
  measure()
}, { flush: 'post', immediate: true })
onUnmounted(() => listSizeObserver?.disconnect())
watch(() => [props.selected.id, mode.value], async () => {
  visibleLimit.value = 8
  brandFilter.value = ''
  query.value = ''
  await nextTick()
  if (panel.value) panel.value.scrollTop = 0
})
watch(
  () => props.group.id,
  () => {
    priceRange.value = '0.15'
    visibleLimit.value = 8
    brandFilter.value = ''
    query.value = ''
  },
)
let candidateReader: AbortController | undefined
const candidateState = ref('')
const snapshots = new Map<string, { at: number; options: PartOption[]; offers: DiscoveryResult; candidateState: string; quoteState: string }>()
let activeSnapshotKey = ''
watch(() => [props.group, props.selected, revision.value] as const, async (current, previous) => {
  if (frontendOnly) {
    candidateState.value = '展示本地已登记型号，不进行在线采集。'
    quoteState.value = '所列价格为参考价，购买前请前往平台核价。'
    return
  }
  candidateReader?.abort()
  const request = new AbortController()
  candidateReader = request
  const key = JSON.stringify([props.group.id, props.selected.id, props.group.options])
  const refresh = previous !== undefined && current[2] !== previous[2]
  const cached = snapshots.get(key)
  const sameSnapshot = activeSnapshotKey === key
  activeSnapshotKey = key
  // Restore a complete snapshot, never replay intermediate database/collection results.
  if (cached) {
    discoveredOptions.value = cached.options
    localOffers.value = cached.offers
    candidateState.value = cached.candidateState
    quoteState.value = cached.quoteState
    if (!refresh && Date.now() - cached.at < 600000) return
  } else if (!sameSnapshot) {
    discoveredOptions.value = []
    localOffers.value = { summary: '', recommendations: [] }
  }
  candidateState.value = '正在后台查询所有品牌，已有候选可继续比较…'
  const options = selectComparisonCandidates(props.group, props.selected, new Set())
  // Rotate brands before extra editions, so one vendor cannot consume the collection budget.
  const seen = new Set<string>()
  const firstBrands = options.filter(part => { if (seen.has(part.brand)) return false; seen.add(part.brand); return true })
  const ordered = [...firstBrands, ...options.filter(part => !firstBrands.some(first => first.id === part.id))]
  const unique = [...new Map(ordered.map(part => [part.id, part])).values()].slice(0, 40)
  const models = unique.map(part => ({ id: part.id, category: props.group.id, brand: part.brand, modelName: part.name, specs: part.specs }))
  quoteState.value = '正在查询同规格型号的数据库报价…'
  const [discovery, quotes] = await Promise.allSettled([
    discoverCandidates(props.group, props.selected, true, request.signal, refresh),
    models.length ? postJson<DiscoveryResult>('/market/alternatives', { models, collect: false }, request.signal)
      : Promise.resolve<DiscoveryResult>({ summary: '当前规格尚无已登记的其他型号', recommendations: [] }),
  ])
  if (request.signal.aborted) return
  // Vue batches these assignments: prices and discovered models appear together.
  if (discovery.status === 'fulfilled') {
    const collected = discovery.value
    discoveredOptions.value = collected.options
    const status = collected.collection === 'not_configured' ? '采集接口未配置'
      : collected.collection === 'cooldown' ? '该规格近期已补查，使用数据库结果' : ''
    candidateState.value = [collected.summary, status, ...collected.errors].filter(Boolean).join('；')
  } else {
    candidateState.value = '跨品牌补查暂不可用，已有候选继续展示。'
  }
  if (quotes.status === 'fulfilled') {
    localOffers.value = quotes.value
    quoteState.value = quotes.value.summary
  } else {
    quoteState.value = '报价查询暂不可用，已登记型号仍可查看。'
  }
  if (discovery.status === 'fulfilled' && quotes.status === 'fulfilled') {
    if (snapshots.size >= 40) snapshots.delete(snapshots.keys().next().value!)
    snapshots.set(key, { at: Date.now(), options: discoveredOptions.value, offers: localOffers.value,
      candidateState: candidateState.value, quoteState: quoteState.value })
  }
}, { immediate: true })
onUnmounted(() => {
  candidateReader?.abort()
})
</script>

<template>
  <section class="nb-inspector nb-card" aria-labelledby="part-detail-title">
    <header class="inspector-header">
      <div class="heading-line"><h2 id="part-detail-title">{{ mode === 'compare' ? '候选对比' : '需求优化' }}</h2><span>{{ mode === 'compare' ? group.label : '整机' }}</span></div>
      <div class="comparison-modes" aria-label="比较方式">
        <button type="button" :aria-pressed="mode === 'compare'" @click="mode = 'compare'">{{ group.id === 'cpu' ? 'CPU 选型' : '同档替换' }}</button>
        <button type="button" :aria-pressed="mode === 'optimize'" @click="mode = 'optimize'">整机优化</button>
      </div>
    </header>
    <div v-if="mode === 'compare'" class="comparison-toolbar">
      <div class="toolbar-actions">
        <button type="button" @click="revision++">刷新</button>
      </div>
    </div>
    <div v-show="mode === 'optimize'" class="nb-tab-content">
      <BuildDemandOptimizer :catalog="resolvedCatalog" :build="build" :budget="budget" :usage="usage" @apply="emit('optimize', $event)" />
    </div>
    <div v-show="mode === 'compare'" id="part-panel-compare" ref="panel" class="nb-tab-content">
      <section class="current-config-section" aria-label="当前配置">
        <h3 class="current-config-heading">当前配置</h3>
        <BuildCandidateRow :key="`current-card-${selected.id}`" :option="selected" :category="group.id" :current-price="selected.price" current />
      </section>
      <div class="candidate-filters">
        <input v-model="query" aria-label="搜索候选配件" placeholder="搜索型号或品牌" />
        <select v-model="priceRange" aria-label="候选加价上限，便宜型号不受限">
          <option value="all">全部价位</option>
          <option value="0.1">最多加价10%</option>
          <option value="0.15">最多加价15%</option>
          <option value="0.2">最多加价20%</option>
          <option value="0.35">最多加价35%</option>
          <option value="0.5">最多加价50%</option>
        </select>
        <select v-model="brandFilter" aria-label="候选品牌">
          <option value="">全部品牌</option>
          <option v-for="brand in brands" :key="brand" :value="brand">{{ brand }}</option>
        </select>
      </div>
      <div v-if="!candidates.length" class="empty-candidates">
        <template v-if="closestOutside && priceCeiling !== null">
          <p>当前加价上限为 {{ money(priceCeiling) }}（按整元四舍五入），暂无符合条件的替换型号。</p>
          <p>最近的是 {{ closestOutside.name }}，参考价 {{ money(closestOutside.price) }}，超出上限 {{ money(closestOutside.price - priceCeiling) }}。</p>
        </template>
        <p v-else>当前条件下暂无可替换型号。</p>
        <p v-if="unpricedNearbyCount">{{ unpricedNearbyCount }} 个相近型号待报价。</p>
      </div>
      <div ref="candidateList" class="candidate-list" @scrollend="alignCandidateWindow">
        <BuildCandidateRow v-for="option in displayedCandidates" :key="option.id"
          :option="option" :category="group.id" :current-price="selected.price"
          :platform-switch="needsPlatformSwitch(option)"
          :warning="needsPlatformSwitch(option) ? '跨平台 CPU：需联动更换主板，并核对散热器扣具；点击查看换平台方案。' : replacementChecks[option.id]?.warnings[0]?.message"
          @drag-start="(category, part) => emit('drag-start', category, part)"
          @drag-end="emit('drag-end')"
          @compare="comparison = $event"
          @replace="replaceCandidate" />
        <button v-if="candidates.length > visibleLimit" class="show-more" type="button" @click="visibleLimit += 8">查看更多（{{ candidates.length - visibleLimit }}）</button>
      </div>
      <div v-if="outsideRange.length" class="outside-range">
        <p>{{ outsideRange.length }} 个型号超过加价上限，已隐藏。</p>
        <button class="show-more" type="button" @click="priceRange = 'all'; visibleLimit = 8">查看全部价位</button>
      </div>
    </div>
    <BuildPartComparison v-if="comparison" :current="selected" :candidate="comparison" :category="group.id" :label="group.label"
      :platform-changes="platformChanges" :platform-total="platformPlan?.total"
      :platform-error="needsPlatformSwitch(comparison) && !platformPlan ? '目前无法在预算内匹配兼容主板和散热器，可继续对比参数或提高整机预算。' : undefined"
      @close="comparison = null" @replace="applyComparison" />
  </section>
</template>

<style scoped>
.nb-inspector { display: flex; flex-direction: column; align-self: start; max-height: min(1000px, calc(100dvh - 166px)); min-height: 0; overflow: hidden; }
.inspector-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 24px 24px 18px; flex-shrink: 0; }
.heading-line { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.heading-line h2 { margin: 0; color: #e0e0e0; font-size: 17px; }
.heading-line > span { display: inline-flex; align-items: center; padding: 5px 10px; border-radius: 4px; background: light-dark(#e4e9ef, #292d32); color: light-dark(#334155, #e0e4e9); font-size: 14px; font-weight: 700; line-height: 1.4; }
.comparison-modes { display: flex; gap: 8px; }
.comparison-modes button { min-height: 44px; min-width: 104px; padding: 10px 18px; border: 1px solid #484848; background: #111; color: #bfbfbf; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600; line-height: 1.4; transition: background-color .15s, border-color .15s, color .15s; }
.comparison-modes button:hover { background: #1c1c1c; border-color: #888; color: #eee; }
.comparison-modes button[aria-pressed='true'] { background: #a6cab9; border-color: #a6cab9; color: #101a14; box-shadow: 0 0 0 1px #a6cab926; }
.comparison-modes button[aria-pressed='true']:hover { background: #bedacb; border-color: #bedacb; color: #101a14; }
.comparison-toolbar { display: flex; justify-content: flex-end; align-items: center; padding: 0 24px 18px; flex-shrink: 0; }
.toolbar-actions { display: flex; align-items: center; gap: 14px; }
.toolbar-actions button { min-height: 38px; min-width: 80px; padding: 8px 18px; border: 1px solid light-dark(#cbd3de, #484848); border-radius: 5px; color: light-dark(#334155, #dddddd); font-size: 14px; font-weight: 600; background: light-dark(#ffffff, #161616); cursor: pointer; transition: background-color .16s ease, border-color .16s ease; }
.toolbar-actions button:hover { background: light-dark(#edf0f4, #252525); border-color: light-dark(#8b99ab, #787878); }
.data-status summary { cursor: pointer; list-style: none; }
.data-status summary::-webkit-details-marker { display: none; }
.data-status[open] summary { color: #ddd; }
.status-content { position: absolute; top: 24px; left: 20px; right: 20px; z-index: 2; padding: 12px 14px; border: 1px solid #333; background: #111; color: #aaa; line-height: 1.8; max-height: 180px; overflow-y: auto; box-shadow: 0 8px 20px #0008; }
.status-content p { margin: 0 0 6px; }
.nb-tab-content { min-height: 0; overflow-y: auto; overscroll-behavior-y: contain; scrollbar-width: thin; scrollbar-color: #444 transparent; padding: 0 24px 24px; }
.candidate-filters { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr); gap: 10px; padding: 0 0 18px; }
.candidate-filters { margin-bottom: 18px; padding: 14px; border: 1px solid light-dark(#d9dfe7, #282828); border-radius: 6px; background: light-dark(#edf0f4, #101010); }
.candidate-filters :is(input, select) { min-height: 38px; transition: border-color .16s ease, background-color .16s ease; }
.candidate-filters :is(input, select):hover { border-color: light-dark(#9ca8b8, #606060); }
.candidate-filters :is(input, select):focus-visible { outline: 2px solid light-dark(#8c9caf, #939ca8); outline-offset: 2px; }
.current-config-heading { margin: 0 0 14px; color: #f0f0f0; font-size: 15px; font-weight: 700; line-height: 1.5; }
.current-config-section { margin-bottom: 24px; border: 0; padding: 0; background: none; }
.current-config-section > .candidate-row { margin-bottom: 0; }
.candidate-filters input, .candidate-filters select { width: 100%; min-width: 0; padding: 8px; border: 1px solid #303030; background: #0d0d0d; color: #aaa; border-radius: 3px; font-size: 12px; }
.candidate-filters input::placeholder { color: #777; }
.empty-candidates, .optimization-status { margin: 12px 0; color: #999; font-size: 12px; line-height: 1.7; }
.outside-range { margin-top: 16px; border-top: 1px solid #252525; padding-top: 14px; color: #999; font-size: 12px; line-height: 1.8; }
.outside-range > p { margin: 0; color: #888; }
.show-more { display: block; width: 100%; padding: 12px; border: 0; background: transparent; color: #aaa; font-size: 12px; cursor: pointer; }
.show-more:hover { color: #eee; }
button:focus-visible, summary:focus-visible { outline: 2px solid #aaa; outline-offset: 3px; }
@media (min-width: 1101px) and (min-height: 720px) and (max-height: 820px) { .nb-inspector { max-height: calc(100dvh - 138px); } }
@media (max-width: 1100px) { .nb-inspector { max-height: 80dvh; } }
@media (max-width: 650px) { .comparison-modes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; } .comparison-modes button { min-width: 0; } .candidate-filters { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .candidate-filters input { grid-column: 1 / -1; } }
</style>
