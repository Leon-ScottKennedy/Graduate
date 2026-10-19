<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { jdApi } from '../../services/hardwareApi'
import type { JDPoolCatalog, JDPoolPrice, JDPoolProduct } from '../../types/hardware'
import { money } from '../../utils/format'

const props = defineProps<{ category: string; label: string; comparedIds?: string[] }>()
const emit = defineEmits<{ compare: [item: JDPoolProduct] }>()
const result = ref<JDPoolCatalog | null>(null)
const query = ref('')
const appliedQuery = ref('')
const page = ref(1)
const loading = ref(false)
const collecting = ref(false)
const error = ref('')
const notice = ref('')
const historyId = ref('')
const history = ref<JDPoolPrice[]>([])
const historyLoading = ref(false)
let reader: AbortController | undefined
let collector: AbortController | undefined
let historyReader: AbortController | undefined
const coverage = computed(
  () => result.value?.coverage.map((item) => `${item.label} ${item.count}`).join(' · ') ?? '',
)
const formatTime = (value: string) => new Date(value).toLocaleString('zh-CN')

async function load() {
  reader?.abort()
  const current = new AbortController()
  reader = current
  loading.value = true
  error.value = ''
  try {
    const data = await jdApi.catalog(props.category, appliedQuery.value, page.value, current.signal)
    if (!current.signal.aborted) result.value = data
  } catch (reason) {
    if (!current.signal.aborted) error.value = reason instanceof Error ? reason.message : '读取失败'
  } finally {
    if (reader === current) loading.value = false
  }
}
function filter() {
  appliedQuery.value = query.value.trim()
  page.value = 1
  void load()
}
function turnPage(offset: number) {
  page.value += offset
  void load()
}
async function collect(complete = false) {
  collector = new AbortController()
  collecting.value = true
  notice.value = ''
  error.value = ''
  let failure = ''
  try {
    const run = await jdApi.collectPool(collector.signal, complete)
    notice.value = `采集 ${run.receivedCount} 条，保留 ${run.validCount} 条硬件，排除 ${run.excludedCount} 条。`
    if (run.detailFailed) notice.value += ` ${run.detailFailed} 条详情未取得。`
  } catch (reason) {
    if (!collector.signal.aborted) failure = reason instanceof Error ? reason.message : '刷新失败'
  } finally {
    collecting.value = false
  }
  if (!collector.signal.aborted) {
    await load()
    if (failure) error.value = failure
  }
}
async function showHistory(id: string) {
  historyReader?.abort()
  if (historyId.value === id) {
    historyId.value = ''
    return
  }
  historyId.value = id
  history.value = []
  historyLoading.value = true
  const current = new AbortController()
  historyReader = current
  try {
    const data = await jdApi.priceHistory(id, current.signal)
    if (!current.signal.aborted) history.value = data
  } catch (reason) {
    if (!current.signal.aborted)
      error.value = reason instanceof Error ? reason.message : '读取价格记录失败'
  } finally {
    if (historyReader === current) historyLoading.value = false
  }
}
watch(
  () => props.category,
  () => {
    query.value = ''
    appliedQuery.value = ''
    page.value = 1
    result.value = null
    historyId.value = ''
    historyReader?.abort()
    void load()
  },
  { immediate: true },
)
onUnmounted(() => {
  reader?.abort()
  collector?.abort()
  historyReader?.abort()
})
</script>

<template>
  <div class="nb-jd-catalog">
    <form class="nb-jd-search" @submit.prevent="filter">
      <label class="nb-sr-only" for="jd-local-filter">筛选已采集商品</label>
      <input
        id="jd-local-filter"
        v-model="query"
        maxlength="100"
        placeholder="筛选已采集的品牌、型号"
      />
      <button class="nb-button" type="submit" :disabled="loading">筛选</button>
      <button class="nb-button" type="button" :disabled="collecting" @click="collect(false)">
        {{ collecting ? '采集中…' : '刷新数据' }}
      </button>
    </form>
    <p v-if="error" class="nb-jd-error" role="alert">{{ error }}</p>
    <p v-if="notice" class="nb-jd-caption" role="status">{{ notice }}</p>
    <div v-if="result" class="nb-jd-meta">
      <span>{{ label }} · {{ result.totalCount }} 件</span>
      <small>京东精选池 · 已保存数据</small>
    </div>
    <p class="nb-jd-caption">采集商品 · 展示价。规格与兼容性待核验，暂不支持替换配置。</p>
    <p v-if="loading" class="nb-jd-caption" role="status">读取中…</p>
    <div v-else-if="result && !result.items.length" class="nb-jd-empty">
      <p>{{ appliedQuery ? '没有符合筛选条件的商品。' : `暂未采集到${label}商品。` }}</p>
      <template v-if="!appliedQuery">
        <p v-if="result.scan" class="nb-jd-caption">
          本轮已扫描 {{ result.scan.scannedPages }}/{{ result.scan.totalPages }} 页
          <span v-if="result.scan.nextPage > 1">，后续页面尚未采集。</span>
          <span v-else-if="result.scan.fullScanAt">，当前频道暂未提供该类商品。</span>
        </p>
        <button
          class="nb-button nb-button-small"
          type="button"
          :disabled="collecting"
          @click="collect(true)"
        >
          {{ collecting ? '正在补齐…' : '补齐商品数据' }}
        </button>
      </template>
    </div>
    <div v-if="result?.items.length" class="nb-candidates nb-collected-cards" :aria-busy="loading">
      <article
        v-for="item in result.items"
        :key="item.id"
        :class="{ selected: comparedIds?.includes(item.id) }"
      >
        <div class="nb-candidate-top">
          <span class="nb-badge nb-brand-badge">{{ item.brand || '品牌未提供' }}</span>
          <span class="nb-source-tag">京东采集价</span>
        </div>
        <h3 class="nb-collected-title" :title="item.name">{{ item.name }}</h3>
        <span class="nb-review-label">规格待核验</span>
        <strong>{{ money(item.price) }}</strong>
        <button class="nb-button nb-button-small" type="button" @click="emit('compare', item)">
          {{ comparedIds?.includes(item.id) ? '移出对比' : '加入对比' }}
        </button>
        <details class="nb-candidate-details">
          <summary>商品详情</summary>
          <p>{{ item.name }}</p>
          <p>{{ item.shop }}<br />{{ formatTime(item.collectedAt) }}</p>
          <div class="nb-pool-actions">
            <a :href="item.productUrl" target="_blank" rel="noopener noreferrer" class="nb-jd-link"
              >京东商品 ↗</a
            >
            <button
              type="button"
              :aria-expanded="historyId === item.id"
              @click="showHistory(item.id)"
            >
              价格记录
            </button>
          </div>
          <div v-if="historyId === item.id" class="nb-card-history">
            <small v-if="historyLoading">读取中…</small>
            <template v-else>
              <small
                v-for="(point, index) in history.slice(0, 5)"
                :key="`${point.taskId}-${index}`"
              >
                {{ formatTime(point.collectedAt) }} ·
                {{ point.price === null ? '本次价格无效' : money(point.price) }}
              </small>
              <small v-if="history.length === 1">仅一条记录，暂无价格趋势。</small>
            </template>
          </div>
        </details>
      </article>
    </div>
    <div v-if="result && (result.hasMore || page > 1)" class="nb-jd-pagination">
      <small>共 {{ result.totalCount }} 件</small>
      <div>
        <button type="button" :disabled="loading || page <= 1" @click="turnPage(-1)">上一页</button>
        <span>{{ result.page }}</span>
        <button type="button" :disabled="loading || !result.hasMore" @click="turnPage(1)">
          下一页
        </button>
      </div>
    </div>
    <details v-if="result?.latestRun" class="nb-pool-summary">
      <summary>采集记录</summary>
      <p>
        {{ formatTime(result.latestRun.collectedAt) }} ·
        {{
          result.latestRun.status === 'completed'
            ? '完成'
            : result.latestRun.status === 'running'
              ? '进行中'
              : '失败，已保留已采集数据'
        }}
      </p>
      <p>
        本次 {{ result.latestRun.receivedCount }} 条 · 有效 {{ result.latestRun.validCount }} · 排除
        {{ result.latestRun.excludedCount }} · 重复 {{ result.latestRun.duplicateCount }}
      </p>
      <p>{{ coverage }}</p>
      <p v-if="result.scan">
        本轮扫描 {{ result.scan.scannedPages }}/{{ result.scan.totalPages }} 页 · 下次从第
        {{ result.scan.nextPage }} 页继续
      </p>
    </details>
  </div>
</template>

<style scoped>
.nb-collected-cards {
  align-items: start;
}
.nb-collected-cards article {
  min-width: 0;
}
.nb-source-tag,
.nb-review-label {
  color: #b9aecb;
  font-size: 12px;
}
.nb-source-tag {
  white-space: nowrap;
}
.nb-collected-title {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 82px;
  overflow-wrap: anywhere;
}
.nb-candidate-details {
  margin-top: 16px;
  border-top: 1px solid #42384e;
  padding-top: 12px;
}
.nb-candidate-details summary {
  cursor: pointer;
  color: #c7badb;
  font-size: 13px;
}
.nb-candidate-details p {
  min-height: 0;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.nb-card-history {
  margin-top: 12px;
}
.nb-card-history small {
  display: block;
  color: #b9aecb;
  line-height: 1.8;
  font-size: 12px;
}
</style>
