<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import BuildMarketComparison from './BuildMarketComparison.vue'
import { reviewCandidates, type CandidateAssessment } from '../../services/candidateReview'
import type { PartGroup, PartOption } from '../../types/hardware'
import { selectCandidates } from '../../services/candidateSelection'
import { checkReplacement } from '../../services/buildCompatibility'
import { money } from '../../utils/format'
import { browseHardware } from '../../services/hardwareBrowse'

const props = defineProps<{
  group: PartGroup
  selected: PartOption
  build: Record<string, PartOption>
}>()
const priceRange = ref('all')
const brandFilter = ref('')
const query = ref('')
const offerPreview = ref<PartOption | null>(null)
const inspected = computed(() => offerPreview.value ?? props.selected)
const brands = computed(() => [...new Set(browseHardware(props.group).map((item) => item.brand))])
const candidates = computed(() =>
  selectCandidates(props.group, props.selected, {
    priceRange: priceRange.value === 'all' ? undefined : Number(priceRange.value),
    brand: brandFilter.value,
    query: query.value,
  }),
)
const assessments = ref<CandidateAssessment[]>([])
const displayedCandidates = candidates
const candidateAdvice = (id: string) => assessments.value.find((item) => item.id === id)
const replacementChecks = computed(() =>
  Object.fromEntries(
    candidates.value.map((option) => [
      option.id,
      checkReplacement(props.build, props.group.id, option),
    ]),
  ),
)
const emit = defineEmits<{ replace: [option: PartOption] }>()
const tab = ref('compare')
const tabs = [
  { id: 'compare', label: '候选对比' },
  { id: 'offers', label: '店铺比较' },
]
function switchTab(value: string) {
  tab.value = value
  if (value === 'compare') offerPreview.value = null
}
function showShops(option: PartOption) {
  offerPreview.value = option
  tab.value = 'offers'
}
watch(
  () => props.group.id,
  () => {
    priceRange.value = 'all'
    brandFilter.value = ''
    query.value = ''
    offerPreview.value = null
  },
)
watch(
  () => props.selected.id,
  () => {
    offerPreview.value = null
  },
)
let timer: ReturnType<typeof setTimeout> | undefined
let reader: AbortController | undefined
watch(
  () => JSON.stringify([props.build, props.group.id, tab.value]),
  () => {
    clearTimeout(timer)
    reader?.abort()
    assessments.value = []
    if (tab.value !== 'compare' || !candidates.value.length) return
    const current = new AbortController()
    reader = current
    timer = setTimeout(async () => {
      try {
        const data = await reviewCandidates(
          props.build,
          props.group.id,
          candidates.value.filter((item) => item.price > 0 && !item.requiresQuote).slice(0, 3),
          current.signal,
        )
        if (!current.signal.aborted) assessments.value = data
      } catch {
        // Missing credentials, quota and network failures leave deterministic candidates usable.
      }
    }, 600)
  },
  { immediate: true },
)
onUnmounted(() => {
  clearTimeout(timer)
  reader?.abort()
})
</script>

<template>
  <section class="nb-inspector nb-card" aria-labelledby="part-detail-title">
    <div class="nb-card-head">
      <div>
        <h2 id="part-detail-title">{{ inspected.name }}</h2>
        <p>{{ inspected.specs }}</p>
      </div>
      <span class="nb-badge nb-brand-badge">{{ inspected.brand }}</span>
    </div>
    <div class="nb-tabs" role="tablist" aria-label="配件数据">
      <button
        v-for="item in tabs"
        :id="`part-tab-${item.id}`"
        :key="item.id"
        type="button"
        role="tab"
        :aria-selected="tab === item.id"
        :aria-controls="`part-panel-${item.id}`"
        :class="{ active: tab === item.id }"
        @click="switchTab(item.id)"
      >
        {{ item.label }}
      </button>
    </div>
    <div
      v-if="tab === 'offers'"
      id="part-panel-offers"
      class="nb-tab-content"
      role="tabpanel"
      aria-labelledby="part-tab-offers"
    >
      <BuildMarketComparison
        :key="`market-${group.id}-${inspected.id}`"
        :category="group.id"
        :selected="inspected"
      />
    </div>
    <div
      v-else-if="tab === 'compare'"
      id="part-panel-compare"
      class="nb-tab-content"
      role="tabpanel"
      aria-labelledby="part-tab-compare"
    >
      <div class="candidate-filters">
        <input v-model="query" aria-label="搜索候选配件" placeholder="搜索品牌、型号或规格" />
        <select v-model="priceRange" aria-label="候选价位范围">
          <option value="all">全部价位 · 价格接近优先</option>
          <option value="0.2">价差 ±20%</option>
          <option value="0.35">价差 ±35%</option>
          <option value="0.5">价差 ±50%</option>
        </select>
        <select v-model="brandFilter" aria-label="候选品牌">
          <option value="">全部品牌</option>
          <option v-for="brand in brands" :key="brand" :value="brand">{{ brand }}</option>
        </select>
      </div>
      <p v-if="!candidates.length" class="nb-jd-caption">
        没有符合筛选条件的型号，请扩大价位或清除筛选。
      </p>
      <div class="nb-candidates">
        <article
          v-for="option in displayedCandidates"
          :key="option.id"
          :class="{ selected: selected.id === option.id }"
        >
          <div class="nb-candidate-top">
            <span class="nb-badge nb-brand-badge">{{ option.brand }}</span>
            <span v-if="selected.id === option.id" class="nb-accent">当前选用</span>
          </div>
          <h3>{{ option.name }}</h3>
          <p>{{ option.specs }} · {{ option.tag }}</p>
          <strong
            >{{ option.price > 0 && !option.requiresQuote ? money(option.price) : '价格待确认'
            }}<small
              v-if="option.price > 0 && !option.requiresQuote"
              class="nb-candidate-price-label"
              >参考价</small
            ></strong
          >
          <small
            v-if="option.price > 0 && !option.requiresQuote && selected.price > 0"
            class="nb-candidate-price-label"
            >{{ option.price >= selected.price ? '比当前贵' : '比当前省' }}
            {{ money(Math.abs(option.price - selected.price)) }}</small
          >
          <button
            class="nb-button nb-button-small"
            type="button"
            :disabled="
              option.price <= 0 ||
              !!option.requiresQuote ||
              !!replacementChecks[option.id]?.errors.length
            "
            @click="emit('replace', option)"
          >
            {{
              replacementChecks[option.id]?.errors.length
                ? '存在兼容冲突'
                : option.price <= 0 || option.requiresQuote
                  ? '需确认价格'
                  : '替换到配置'
            }}
          </button>
          <button
            class="nb-button nb-button-small candidate-shops"
            type="button"
            @click="showShops(option)"
          >
            查看店铺
          </button>
          <small v-if="replacementChecks[option.id]?.errors.length" class="nb-candidate-conflict">
            {{ replacementChecks[option.id]?.errors[0]?.message }}
          </small>
          <small
            v-if="candidateAdvice(option.id) && candidateAdvice(option.id)?.verdict !== 'suitable'"
            class="nb-candidate-conflict"
          >
            替换建议：{{ candidateAdvice(option.id)?.reason }}
          </small>
          <small
            v-else-if="replacementChecks[option.id]?.warnings.length"
            class="nb-candidate-conflict"
          >
            {{ replacementChecks[option.id]?.warnings[0]?.message }}
          </small>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.candidate-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}
.candidate-filters input,
.candidate-filters select {
  min-width: 0;
  padding: 10px;
  border: 1px solid #51405e;
  background: #16121c;
  color: #eee6f6;
  border-radius: 4px;
}
.candidate-filters input {
  flex: 1 1 180px;
}
.candidate-shops {
  margin-top: 8px;
}
.nb-inspector {
  display: flex;
  flex-direction: column;
  align-self: start;
  max-height: min(1000px, calc(100dvh - 166px));
  min-height: 0;
  overflow: hidden;
}
.nb-card-head,
.nb-tabs {
  flex-shrink: 0;
}
.nb-tab-content {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scrollbar-width: thin;
  scrollbar-color: #76618f transparent;
}
.nb-candidate-price-label {
  margin-left: 8px;
  color: #aaa0b7;
  font-size: 12px;
  font-weight: normal;
}
.nb-candidate-conflict {
  display: block;
  color: #e8bd61;
  font-size: 12px;
  line-height: 1.6;
  margin-top: 8px;
}
@media (min-width: 1101px) and (min-height: 720px) and (max-height: 820px) {
  .nb-inspector {
    max-height: calc(100dvh - 138px);
  }
}
@media (max-width: 1100px) {
  .nb-inspector {
    max-height: 80dvh;
  }
}
</style>
