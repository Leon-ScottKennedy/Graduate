<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import BuildJdComparison from './BuildJdComparison.vue'
import BuildManualQuotes from './BuildManualQuotes.vue'
import BuildHardwareBrowser from './BuildHardwareBrowser.vue'
import BuildTaobaoSearch from './BuildTaobaoSearch.vue'
import { reviewCandidates, type CandidateAssessment } from '../../services/candidateReview'
import type { PartGroup, PartOption } from '../../types/hardware'
import { selectCandidates } from '../../services/candidateSelection'
import { checkReplacement } from '../../services/buildCompatibility'
import { money } from '../../utils/format'

const props = defineProps<{
  group: PartGroup
  selected: PartOption
  build: Record<string, PartOption>
}>()
const candidates = computed(() => selectCandidates(props.group, props.selected))
const assessments = ref<CandidateAssessment[]>([])
const ranks = { suitable: 0, caution: 1, unknown: 2, not_recommended: 3 }
const displayedCandidates = computed(() =>
  [...candidates.value].sort(
    (a, b) =>
      ranks[assessments.value.find((item) => item.id === a.id)?.verdict ?? 'unknown'] -
      ranks[assessments.value.find((item) => item.id === b.id)?.verdict ?? 'unknown'],
  ),
)
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
const tab = ref('browse')
const tabs = [
  { id: 'browse', label: '全部型号' },
  { id: 'compare', label: '候选对比' },
  { id: 'offers', label: '店铺比价' },
  { id: 'taobao', label: '淘宝商品' },
]
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
          candidates.value,
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
        <h2 id="part-detail-title">{{ selected.name }}</h2>
        <p>{{ selected.specs }}</p>
      </div>
      <span class="nb-badge nb-brand-badge">{{ selected.brand }}</span>
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
        @click="tab = item.id"
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
      <BuildManualQuotes
        :key="`${group.id}-${selected.id}`"
        :category="group.id"
        :selected="selected"
        :fallback="group.options[0]"
        @select="emit('replace', $event)"
      />
      <details class="nb-legacy-quotes">
        <summary>已采集的京东接口报价</summary>
        <BuildJdComparison
          :category="group.id"
          :label="group.label"
          :selected="selected"
          @compare="tab = 'compare'"
        />
      </details>
    </div>
    <div
      v-else-if="tab === 'compare'"
      id="part-panel-compare"
      class="nb-tab-content"
      role="tabpanel"
      aria-labelledby="part-tab-compare"
    >
      <p class="nb-jd-caption">相近规格档位 · 参考价差不超过 20%</p>
      <p v-if="!candidates.length" class="nb-jd-caption">暂无同时满足规格与价格条件的其他候选。</p>
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
            >{{ money(option.price) }}<small class="nb-candidate-price-label">参考价</small></strong
          >
          <button
            class="nb-button nb-button-small"
            type="button"
            :disabled="!!replacementChecks[option.id]?.errors.length"
            @click="emit('replace', option)"
          >
            {{ replacementChecks[option.id]?.errors.length ? '存在兼容冲突' : '替换到配置' }}
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
    <div
      v-if="tab === 'browse'"
      id="part-panel-browse"
      class="nb-tab-content"
      role="tabpanel"
      aria-labelledby="part-tab-browse"
    >
      <BuildHardwareBrowser
        :group="group"
        :selected="selected"
        :build="build"
        @replace="emit('replace', $event)"
      />
    </div>
    <div
      v-if="tab === 'taobao'"
      id="part-panel-taobao"
      class="nb-tab-content"
      role="tabpanel"
      aria-labelledby="part-tab-taobao"
    >
      <BuildTaobaoSearch :selected="selected" />
    </div>
  </section>
</template>

<style scoped>
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
