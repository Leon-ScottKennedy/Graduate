<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { getJson, postJson } from '../../services/apiClient'
import type { PartOption } from '../../types/hardware'
import { money } from '../../utils/format'

type Product = {
  id: string
  itemId: string | null
  title: string
  brand: string
  shop: string
  category: string
  productUrl: string | null
  discountPriceCents: number | null
  estimatedPriceCents: number | null
  reservePriceCents: number | null
  presale: boolean
  collectedAt: string
}
type Result = {
  keyword: string
  page: number
  pageSize: number
  total: number
  received: number
  valid: number
  excluded: number
  collectedAt: string
  products: Product[]
}
const props = defineProps<{ selected: PartOption }>()
const keyword = ref('')
const result = ref<Result | null>(null)
const configured = ref(false)
const busy = ref(false)
const error = ref('')
let reader = new AbortController()
const time = (value: string) => new Date(value).toLocaleString('zh-CN')
async function search(page = 1) {
  if (busy.value) return
  const query = page === 1 ? keyword.value.trim() : (result.value?.keyword ?? '')
  if (query.length < 2) return
  const current = reader
  busy.value = true
  error.value = ''
  try {
    const data = await postJson<Result>(
      '/taobao/search',
      { keyword: query, page, pageSize: 20 },
      current.signal,
    )
    if (!current.signal.aborted) result.value = data
  } catch (reason) {
    if (!current.signal.aborted) error.value = reason instanceof Error ? reason.message : '搜索失败'
  } finally {
    if (current === reader) busy.value = false
  }
}
watch(
  () => props.selected.id,
  async () => {
    reader.abort()
    reader = new AbortController()
    const current = reader
    keyword.value = props.selected.name.slice(0, 120)
    result.value = null
    error.value = ''
    busy.value = true
    try {
      const [status, cached] = await Promise.all([
        getJson<{ configured: boolean }>('/taobao/status', current.signal),
        getJson<Result | null>(
          '/taobao/search?' +
            new URLSearchParams({ keyword: keyword.value, page: '1', pageSize: '20' }),
          current.signal,
        ),
      ])
      if (!current.signal.aborted) {
        configured.value = status.configured
        result.value = cached
      }
    } catch (reason) {
      if (!current.signal.aborted)
        error.value = reason instanceof Error ? reason.message : '读取失败'
    } finally {
      if (current === reader) busy.value = false
    }
  },
  { immediate: true },
)
onUnmounted(() => reader.abort())
</script>

<template>
  <section class="tb-search">
    <form class="tb-form" @submit.prevent="search(1)">
      <input
        v-model="keyword"
        aria-label="淘宝硬件搜索关键词"
        placeholder="输入硬件品牌、型号"
        minlength="2"
        maxlength="120"
        required
      /><button class="nb-button nb-button-small" :disabled="busy || !configured">
        {{ busy ? '查询中…' : '搜索淘宝' }}
      </button>
    </form>
    <p v-if="!configured" class="tb-caption">
      后台需要配置自己的淘宝推广位 TAOBAO_ADZONE_ID；配置后重启后端并刷新页面。
    </p>
    <p class="tb-caption">
      淘宝联盟 API 搜索结果 ·
      商品级参考。多规格、套装和预售价格需核对，暂不自动计入配置或同型号最低价。
    </p>
    <p v-if="error" role="alert" class="nb-jd-error">{{ error }}</p>
    <template v-if="result">
      <p class="tb-caption">
        “{{ result.keyword }}” · 第 {{ result.page }} 页 · 本页 {{ result.valid }} 件{{
          result.excluded ? `，排除 ${result.excluded} 条无效/重复记录` : ''
        }}<br />采集时间：{{ time(result.collectedAt) }} · 已保存至本地数据库
      </p>
      <p v-if="!result.products.length" class="tb-caption">
        本次没有返回有效商品，可尝试更简短的芯片或型号关键词。
      </p>
      <div class="tb-products">
        <article v-for="item in result.products" :key="item.id">
          <span class="tb-caption"
            >{{ item.shop || '店铺未返回' }} · {{ item.category || '类目未返回' }}</span
          >
          <h3>{{ item.title }}</h3>
          <strong
            >{{
              item.discountPriceCents === null
                ? '价格未返回'
                : money(item.discountPriceCents / 100)
            }}<small>商品折扣展示价</small></strong
          >
          <p v-if="item.estimatedPriceCents !== null" class="tb-caption">
            预估到手价 {{ money(item.estimatedPriceCents / 100) }}，可能附带优惠资格或购买条件
          </p>
          <p class="tb-caption">
            {{ item.presale ? '预售商品 · 请核对定金及尾款' : '具体型号、容量、包装及运费待核对' }}
          </p>
          <a
            v-if="item.productUrl"
            :href="item.productUrl"
            target="_blank"
            rel="noopener noreferrer"
            >前往商品核对 ↗</a
          >
          <p v-else class="tb-caption">接口未返回可用商品链接</p>
          <small v-if="!item.itemId" class="tb-caption"
            >接口未返回有效新商品 ID，暂不能继续查询详情。</small
          >
        </article>
      </div>
      <div class="tb-pagination">
        <button :disabled="busy || result.page <= 1" @click="search(result.page - 1)">上一页</button
        ><span>{{ result.page }}</span
        ><button
          :disabled="
            busy ||
            result.received === 0 ||
            result.page * result.pageSize >= result.total ||
            result.page >= 100
          "
          @click="search(result.page + 1)"
        >
          下一页
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.tb-form {
  display: flex;
  gap: 10px;
}
.tb-form input {
  flex: 1;
  min-width: 0;
  padding: 10px;
  border: 1px solid #51405e;
  background: #16121c;
  color: #eee6f6;
  border-radius: 3px;
}
.tb-form .nb-button {
  width: auto;
  flex-shrink: 0;
}
.tb-caption {
  display: block;
  color: #aaa2b8;
  font-size: 12px;
  line-height: 1.8;
  margin: 12px 0;
  overflow-wrap: anywhere;
}
.tb-products {
  display: grid;
  gap: 14px;
}
.tb-products article {
  background: #211c2a;
  border: 1px solid #494050;
  border-radius: 4px;
  padding: 16px;
}
.tb-products h3 {
  font-size: 15px;
  line-height: 1.7;
  margin: 10px 0;
  overflow-wrap: anywhere;
}
.tb-products strong {
  display: block;
  font-size: 24px;
  margin: 12px 0;
}
.tb-products strong small {
  display: block;
  font-size: 11px;
  font-weight: normal;
  color: #aaa2b8;
}
.tb-products a {
  color: #c8afff;
  font-size: 13px;
}
.tb-pagination {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: center;
  margin: 20px 0;
  font-size: 12px;
}
.tb-pagination button {
  padding: 8px 12px;
  border: 1px solid #51405e;
  color: #c8afff;
  background: #211c2a;
}
</style>
