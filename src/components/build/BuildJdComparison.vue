<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { jdApi } from '../../services/hardwareApi'
import type { JDComparison, JDPoolPrice, PartOption } from '../../types/hardware'
import { money } from '../../utils/format'

const props = defineProps<{ category: string; label: string; selected: PartOption }>()
const emit = defineEmits<{ compare: [] }>()
const comparison = ref<JDComparison | null>(null)
const loading = ref(false)
const collecting = ref(false)
const error = ref('')
const historyId = ref('')
const history = ref<JDPoolPrice[]>([])
const historyLoading = ref(false)
let reader: AbortController | undefined
let collector: AbortController | undefined
let historyReader: AbortController | undefined
const target = () => ({
  category: props.category,
  brand: props.selected.brand,
  modelName: props.selected.name,
  specs: props.selected.specs,
})
const time = (value: string) => new Date(value).toLocaleString('zh-CN')

async function load() {
  reader?.abort()
  const current = new AbortController()
  reader = current
  loading.value = true
  error.value = ''
  try {
    const data = await jdApi.compare(target(), current.signal)
    if (!current.signal.aborted) {
      comparison.value = data
    }
  } catch (reason) {
    if (!current.signal.aborted)
      error.value = reason instanceof Error ? reason.message : '读取报价失败'
  } finally {
    if (reader === current) loading.value = false
  }
}
async function refresh() {
  collecting.value = true
  collector = new AbortController()
  let failure = ''
  try {
    await jdApi.collectPool(collector.signal)
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
    const data = await jdApi.compareHistory(target(), id, current.signal)
    if (!current.signal.aborted) history.value = data
  } catch (reason) {
    if (!current.signal.aborted)
      error.value = reason instanceof Error ? reason.message : '读取价格记录失败'
  } finally {
    if (historyReader === current) historyLoading.value = false
  }
}
watch(
  () => [props.category, props.selected.id],
  () => {
    reader?.abort()
    historyReader?.abort()
    comparison.value = null
    historyId.value = ''
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
  <div class="nb-jd-comparison">
    <div class="nb-comparison-toolbar">
      <span>同型号店铺报价{{ comparison ? ` · ${comparison.shopCount} 家` : '' }}</span>
      <button
        class="nb-button nb-button-small"
        type="button"
        :disabled="collecting"
        @click="refresh"
      >
        {{ collecting ? '采集中…' : '刷新数据' }}
      </button>
    </div>
    <p v-if="error" class="nb-jd-error" role="alert">{{ error }}</p>
    <p v-if="loading" class="nb-jd-caption" role="status">正在匹配型号与规格…</p>
    <p v-else-if="comparison && !comparison.offers.length" class="nb-jd-caption">
      暂无该型号报价。
      <button type="button" class="nb-jd-link" @click="emit('compare')">查看其他型号 →</button>
    </p>
    <p v-else-if="comparison?.shopCount === 1" class="nb-jd-caption">
      目前仅有单店报价，暂不能进行跨店比价。
    </p>
    <p v-else-if="comparison && comparison.shopCount > 1" class="nb-jd-caption">
      仅比较已采集的同型号展示价，不含优惠券和运费。
    </p>
    <div v-if="comparison?.offers.length" class="nb-table-scroll" :aria-busy="loading">
      <table class="nb-table nb-shop-table">
        <thead>
          <tr>
            <th>店铺 / 商品</th>
            <th>展示价</th>
            <th>价差</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="offer in comparison.offers" :key="offer.id">
            <tr>
              <td>
                <strong>{{ offer.shop }}</strong>
                <small class="nb-jd-product">{{ offer.name }}</small>
                <small>{{ time(offer.collectedAt) }}</small>
              </td>
              <td class="nb-price">
                {{ money(offer.price)
                }}<small v-if="offer.isLowest" class="nb-accent">当前采集最低</small>
              </td>
              <td>
                {{
                  offer.difference === null
                    ? '—'
                    : offer.difference === 0
                      ? money(0)
                      : `+${money(offer.difference)}`
                }}
              </td>
              <td class="nb-pool-actions">
                <a
                  class="nb-jd-link"
                  :href="offer.productUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  >商品 ↗</a
                >
                <button
                  type="button"
                  :aria-expanded="historyId === offer.id"
                  @click="showHistory(offer.id)"
                >
                  价格记录
                </button>
              </td>
            </tr>
            <tr v-if="historyId === offer.id" class="nb-pool-history">
              <td colspan="4">
                <span v-if="historyLoading">读取中…</span>
                <template v-else>
                  <small
                    v-for="(point, index) in history.slice(0, 5)"
                    :key="`${point.taskId}-${index}`"
                  >
                    {{ time(point.collectedAt) }}　{{
                      point.price === null ? '本次价格无效' : money(point.price)
                    }}
                  </small>
                  <small v-if="history.length === 1">仅一条记录，暂无价格趋势。</small>
                </template>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.nb-comparison-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  font-size: 12px;
}
.nb-comparison-toolbar .nb-button {
  width: auto;
  flex: 0 0 auto;
}
.nb-jd-caption button {
  border: 0;
  background: transparent;
  color: var(--nb-accent, #c8afff);
  cursor: pointer;
}
</style>
