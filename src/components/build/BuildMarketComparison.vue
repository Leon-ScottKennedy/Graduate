<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { getJson, postJson } from '../../services/apiClient'
import type { PartOption } from '../../types/hardware'
import { money } from '../../utils/format'

type Product = {
  id: string
  platform: 'jd' | 'taobao'
  platformLabel: string
  title: string
  shop: string
  price: number | null
  productUrl: string | null
  collectedAt: string
  stale: boolean
  matchStatus: 'title_match' | 'reference'
  relationLabel: string
}
type Result = {
  searchKeyword: string
  storeSearches: { platform: string; label: string; url: string }[]
  total: number
  counts: { jd: number; taobao: number }
  page: number
  pageSize: number
  products: Product[]
}
type SearchPage = { page: number; received: number; pageSize: number; total: number }
const props = defineProps<{ category: string; selected: PartOption }>()
const result = ref<Result | null>(null)
const platform = ref('all')
const page = ref(1)
const busy = ref(false)
const collecting = ref(false)
const configured = ref(false)
const error = ref('')
const notice = ref('')
const lastSearch = ref<SearchPage | null>(null)
let reader = new AbortController()
let loadVersion = 0
const time = (value: string) => new Date(value).toLocaleString('zh-CN')
async function load() {
  const version = ++loadVersion
  const current = reader
  busy.value = true
  error.value = ''
  try {
    const data = await postJson<Result>(
      '/market/compare',
      {
        category: props.category,
        brand: props.selected.brand,
        modelName: props.selected.name,
        specs: props.selected.specs,
        platform: platform.value,
        page: page.value,
      },
      current.signal,
    )
    if (!current.signal.aborted && version === loadVersion) {
      result.value = data
      return data
    }
  } catch (reason) {
    if (!current.signal.aborted && version === loadVersion)
      error.value = reason instanceof Error ? reason.message : '读取失败'
  } finally {
    if (current === reader && version === loadVersion) busy.value = false
  }
}
async function collect(next = false) {
  if (collecting.value || busy.value) return
  collecting.value = true
  error.value = ''
  notice.value = ''
  const current = reader
  try {
    const data = await postJson<SearchPage>(
      '/taobao/search',
      {
        keyword: result.value?.searchKeyword ?? props.selected.name.slice(0, 120),
        page: next ? (lastSearch.value?.page ?? 0) + 1 : 1,
        pageSize: 20,
        tmallOnly: true,
      },
      current.signal,
    )
    if (!current.signal.aborted) {
      lastSearch.value = data
      page.value = 1
      await load()
      notice.value = result.value?.total
        ? '商品已更新'
        : '暂未找到符合条件的商品，可直接前往京东或天猫查找。'
    }
  } catch (reason) {
    if (!current.signal.aborted)
      error.value = reason instanceof Error ? reason.message : '补充数据失败'
  } finally {
    if (current === reader) collecting.value = false
  }
}
watch(
  () => [props.category, props.selected.id],
  async () => {
    reader.abort()
    reader = new AbortController()
    const current = reader
    result.value = null
    lastSearch.value = null
    configured.value = false
    collecting.value = false
    notice.value = ''
    page.value = 1
    await load()
    try {
      const status = await getJson<{ configured: boolean }>('/taobao/status', current.signal)
      if (!current.signal.aborted) {
        configured.value = status.configured
      }
    } catch {
      /* Local comparison remains available without remote configuration. */
    }
  },
  { immediate: true },
)
watch([platform, page], () => {
  void load()
})
onUnmounted(() => reader.abort())
</script>

<template>
  <section class="market" aria-label="京东淘宝商品比价">
    <div class="toolbar">
      <select
        v-model="platform"
        aria-label="筛选商品平台"
        :disabled="busy || collecting"
        @change="page = 1"
      >
        <option value="all">全部平台</option>
        <option value="jd">京东</option>
        <option value="taobao">淘宝 / 天猫</option>
      </select>
      <button :disabled="busy || collecting || !configured" @click="collect()">
        {{ collecting ? '更新中…' : '更新淘宝商品' }}
      </button>
      <button
        v-if="
          lastSearch &&
          lastSearch.received &&
          lastSearch.page * lastSearch.pageSize < lastSearch.total &&
          lastSearch.page < 100
        "
        :disabled="busy || collecting"
        @click="collect(true)"
      >
        更多商品
      </button>
    </div>
    <p v-if="error" role="alert" class="nb-jd-error">{{ error }}</p>
    <p v-if="notice" role="status" class="caption">{{ notice }}</p>
    <p v-if="busy" role="status" class="caption">加载中…</p>
    <template v-if="result">
      <p v-if="!result.total && !busy && !collecting" class="caption">
        暂无符合条件的店铺报价，可更新商品或前往京东、天猫查找。
      </p>
      <div class="products" :aria-busy="busy">
        <article v-for="item in result.products" :key="item.id">
          <div class="caption">{{ item.platformLabel }} · {{ item.shop || '店铺未返回' }}</div>
          <h4>{{ item.title }}</h4>
          <strong>{{ item.price === null ? '暂无有效展示价' : money(item.price) }}</strong>
          <p class="caption">
            {{
              item.matchStatus === 'title_match' ? '标题规格匹配 · 待核对 SKU' : item.relationLabel
            }}{{ item.stale ? ' · 超过 7 天，建议更新' : '' }}
          </p>
          <small class="caption"
            >{{ time(item.collectedAt) }} · 商品展示价，不含运费及优惠资格</small
          >
          <a
            v-if="item.productUrl"
            :href="item.productUrl"
            target="_blank"
            rel="noopener noreferrer"
            >前往核对 ↗</a
          >
        </article>
      </div>
      <div v-if="result.total > result.pageSize" class="toolbar pages">
        <button :disabled="busy || collecting || page <= 1" @click="page--">上一页</button>
        <span>{{ page }} / {{ Math.ceil(result.total / result.pageSize) }}</span>
        <button
          :disabled="busy || collecting || page * result.pageSize >= result.total"
          @click="page++"
        >
          下一页
        </button>
      </div>
      <div class="toolbar store-searches">
        <a
          v-for="store in result.storeSearches.filter(
            (item) => platform === 'all' || item.platform === platform,
          )"
          :key="store.platform"
          :href="store.url"
          target="_blank"
          rel="noopener noreferrer"
          >{{ store.label }} ↗</a
        >
      </div>
    </template>
  </section>
</template>

<style scoped>
.market {
  margin-bottom: 24px;
}
.caption {
  color: #aaa2b8;
  font-size: 12px;
  line-height: 1.8;
  margin: 10px 0;
  display: block;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.toolbar button,
.toolbar select {
  background: #211c2a;
  color: #d9c3ff;
  border: 1px solid #51405e;
  padding: 9px;
  border-radius: 4px;
}
.toolbar button:disabled {
  opacity: 0.45;
}
.products {
  display: grid;
  gap: 12px;
}
.products article {
  padding: 14px;
  border: 1px solid #494050;
  background: #211c2a;
  border-radius: 4px;
}
h4 {
  margin: 8px 0;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
strong {
  font-size: 22px;
}
a {
  color: #c8afff;
  font-size: 13px;
}
.pages {
  justify-content: center;
  margin-top: 18px;
}
.store-searches {
  margin-top: 18px;
  gap: 20px;
}
</style>
