<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { deleteJson, getJson, postJson } from '../../services/apiClient'
import type { PartOption } from '../../types/hardware'
import { money } from '../../utils/format'

type Offer = {
  id: string
  platform: 'jd' | 'taobao'
  shop: string
  productUrl: string
  price: number
  shipping: number
  total: number
  observedAt: string
  note: string
  stale: boolean
  difference: number | null
  source: string
}
const props = defineProps<{ category: string; selected: PartOption; fallback?: PartOption }>()
const emit = defineEmits<{ select: [option: PartOption] }>()
const target = computed(() => ({
  category: props.category,
  brand: props.selected.brand,
  modelName: props.selected.name,
  specs: props.selected.specs,
}))
const offers = ref<Offer[]>([])
const shopCount = ref(0)
const busy = ref(false)
const error = ref('')
const notice = ref('')
const confirmed = ref(false)
const platform = ref<'jd' | 'taobao'>('jd')
const shop = ref('')
const productUrl = ref('')
const price = ref<number | string>('')
const shipping = ref<number | string>(0)
const observedAt = ref(localNow())
const note = ref('')
const history = ref<{ price: number; shipping: number; observedAt: string }[]>([])
const historyId = ref('')
let controller = new AbortController()
function localNow() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const time = (value: string) => new Date(value).toLocaleString('zh-CN')
async function load() {
  const data = await postJson<{ offers: Offer[]; shopCount: number }>(
    '/quotes/compare',
    target.value,
    controller.signal,
  )
  if (controller.signal.aborted) return
  offers.value = data.offers
  shopCount.value = data.shopCount
}
async function action(task: () => Promise<unknown>) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  notice.value = ''
  const current = controller
  try {
    await task()
  } catch (reason) {
    if (!current.signal.aborted) error.value = reason instanceof Error ? reason.message : '操作失败'
  } finally {
    if (current === controller) busy.value = false
  }
}
function save() {
  if (!confirmed.value) return
  void action(async () => {
    await postJson(
      '/quotes/import',
      {
        target: target.value,
        confirmed: true,
        quotes: [
          {
            platform: platform.value,
            shop: shop.value,
            productUrl: productUrl.value,
            price: Number(price.value),
            shipping: Number(shipping.value),
            observedAt: new Date(observedAt.value).toISOString(),
            note: note.value,
          },
        ],
      },
      controller.signal,
    )
    await load()
    notice.value = '报价已保存；可继续录入其他店铺。'
  })
}
function template() {
  const header = 'platform,shop,productUrl,price,shipping,observedAt,note\r\n'
  const blob = new Blob(['\ufeff' + header], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '店铺报价模板.csv'
  a.click()
  URL.revokeObjectURL(url)
}
function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !confirmed.value) return
  if (file.size > 200000) {
    error.value = 'CSV 文件不能超过 200KB'
    return
  }
  const snapshot = target.value
  void action(async () => {
    await postJson(
      '/quotes/import-csv',
      { target: snapshot, confirmed: true, csv: await file.text() },
      controller.signal,
    )
    await load()
    notice.value = '批量导入成功。'
  })
}
function remove(id: string) {
  void action(async () => {
    await deleteJson('/quotes/' + id, controller.signal)
    if (props.selected.priceSource?.quoteId === id) resetPrice()
    await load()
    historyId.value = ''
  })
}
function showHistory(id: string) {
  if (historyId.value === id) {
    historyId.value = ''
    return
  }
  void action(async () => {
    history.value = await getJson('/quotes/' + id + '/history', controller.signal)
    historyId.value = id
  })
}
function select(offer: Offer) {
  if (offer.stale) return
  emit('select', {
    ...props.selected,
    price: offer.total,
    requiresQuote: false,
    priceSource: {
      quoteId: offer.id,
      shop: offer.shop,
      platform: offer.platform,
      observedAt: offer.observedAt,
      productUrl: offer.productUrl,
      basis: 'manual',
      presetPrice: props.selected.priceSource?.presetPrice ?? props.selected.price,
    },
  })
}
function resetPrice() {
  if (props.selected.priceSource?.presetPrice === 0 && props.fallback) {
    emit('select', props.fallback)
    return
  }
  if (props.selected.priceSource)
    emit('select', {
      ...props.selected,
      price: props.selected.priceSource.presetPrice,
      priceSource: undefined,
    })
}
watch(
  () => JSON.stringify(target.value),
  () => {
    controller.abort()
    controller = new AbortController()
    offers.value = []
    confirmed.value = false
    error.value = ''
    notice.value = ''
    historyId.value = ''
    busy.value = false
    void action(load)
  },
  { immediate: true },
)
onUnmounted(() => controller.abort())
</script>

<template>
  <section class="nb-manual-quotes">
    <div class="quote-toolbar">
      <strong>店铺报价 · {{ shopCount }} 家有效店铺</strong
      ><button class="nb-button nb-button-small" :disabled="busy" @click="action(load)">
        重新读取
      </button>
    </div>
    <p class="quote-caption">
      同一完整型号与规格；人工核对的商品展示价 + 运费，不含优惠券。7 天前的报价不参与当前最低价。
    </p>
    <p v-if="selected.priceSource" class="quote-caption">
      当前采用：{{ selected.priceSource.shop }} · 人工报价
      <button type="button" @click="resetPrice">
        {{ selected.priceSource.presetPrice ? '恢复参考价' : '恢复默认参考型号' }}
      </button>
    </p>
    <p v-if="error" class="nb-jd-error" role="alert">{{ error }}</p>
    <p v-if="notice" role="status" class="quote-caption">{{ notice }}</p>
    <p v-if="busy" role="status" class="quote-caption">处理中…</p>
    <p v-if="!offers.length && !busy" class="quote-caption">
      还没有录入该型号报价，可从下方添加京东、淘宝或天猫店铺。
    </p>
    <div class="quote-list">
      <article v-for="offer in offers" :key="offer.id" class="quote-card">
        <div class="quote-toolbar">
          <strong>{{ offer.shop }}</strong
          ><span>{{ offer.platform === 'jd' ? '京东' : '淘宝 / 天猫' }}</span>
        </div>
        <div class="quote-toolbar">
          <b class="quote-price">{{ money(offer.total) }}</b
          ><span>{{
            offer.stale
              ? '已过期'
              : offer.difference === 0
                ? shopCount > 1
                  ? '已录入最低价'
                  : '单店报价'
                : `比最低价高 ${money(offer.difference ?? 0)}`
          }}</span>
        </div>
        <p class="quote-caption">
          商品 {{ money(offer.price) }} + 运费 {{ money(offer.shipping) }} ·
          {{ offer.source === 'csv' ? 'CSV 导入' : '人工录入' }}<br />{{ time(offer.observedAt)
          }}<br v-if="offer.note" />{{ offer.note }}
        </p>
        <div class="quote-actions">
          <a :href="offer.productUrl" target="_blank" rel="noopener noreferrer">查看商品 ↗</a
          ><button @click="showHistory(offer.id)">价格记录</button
          ><button :disabled="busy" @click="remove(offer.id)">停用</button>
        </div>
        <button class="nb-button" :disabled="offer.stale || busy" @click="select(offer)">
          {{
            selected.priceSource?.quoteId === offer.id && selected.price === offer.total
              ? '更新此店铺报价到配置'
              : '采用此店铺报价'
          }}
        </button>
        <div v-if="historyId === offer.id" class="quote-caption">
          <p v-for="(point, i) in history" :key="i">
            {{ time(point.observedAt) }} · {{ money(point.price + point.shipping) }}
          </p>
        </div>
      </article>
    </div>
    <details class="quote-entry">
      <summary>录入 / 批量导入报价</summary>
      <p class="quote-caption">绑定型号：{{ selected.name }} · {{ selected.specs }}</p>
      <label class="quote-confirm"
        ><input
          v-model="confirmed"
          type="checkbox"
        />我已核对商品为该完整型号、规格及单件版本，不是套装、定金或其他容量版本。</label
      >
      <form class="quote-form" @submit.prevent="save">
        <label
          >平台<select v-model="platform">
            <option value="jd">京东</option>
            <option value="taobao">淘宝 / 天猫</option>
          </select></label
        >
        <label>店铺名称<input v-model="shop" required maxlength="100" /></label>
        <label class="wide"
          >完整商品链接<input
            v-model="productUrl"
            type="url"
            required
            maxlength="2000"
            placeholder="https://item.jd.com/… 或淘宝/天猫详情链接"
        /></label>
        <label
          >商品价格（元）<input
            v-model="price"
            type="number"
            min="0.01"
            max="1000000"
            step="0.01"
            required
        /></label>
        <label
          >运费（元）<input
            v-model="shipping"
            type="number"
            min="0"
            max="10000"
            step="0.01"
            required
        /></label>
        <label class="wide"
          >查看报价的时间<input v-model="observedAt" type="datetime-local" required
        /></label>
        <label class="wide"
          >备注<input v-model="note" maxlength="300" placeholder="如盒装、颜色、价格条件"
        /></label>
        <button class="nb-button wide" :disabled="busy || !confirmed">保存报价</button>
      </form>
      <div class="quote-actions">
        <button type="button" @click="template">下载 CSV 表头模板</button
        ><label
          >导入 CSV<input
            aria-label="导入报价 CSV"
            type="file"
            accept=".csv,text/csv"
            :disabled="busy || !confirmed"
            @change="upload"
        /></label>
      </div>
      <p class="quote-caption">
        一批最多 100 条，全部绑定上方型号。platform 填 jd / taobao；observedAt 填带时区的时间，例如
        2026-10-19T10:00:00+08:00；shipping 必填，包邮填 0。重复记录不增加快照。
      </p>
    </details>
  </section>
</template>

<style scoped>
.quote-toolbar,
.quote-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
}
.quote-toolbar .nb-button {
  width: auto;
}
.quote-caption {
  font-size: 12px;
  color: #aaa2b8;
  line-height: 1.8;
  margin: 12px 0;
  overflow-wrap: anywhere;
}
.quote-list {
  display: grid;
  gap: 12px;
  margin: 16px 0;
}
.quote-card {
  padding: 16px;
  border: 1px solid #494050;
  background: #211c2a;
  border-radius: 5px;
}
.quote-price {
  font-size: 23px;
  margin-top: 12px;
}
.quote-actions {
  justify-content: flex-start;
  margin: 12px 0;
}
.quote-actions button {
  border: 0;
  background: transparent;
  color: #c8afff;
  font: inherit;
  cursor: pointer;
}
.quote-actions a {
  color: #c8afff;
}
.quote-entry {
  border-top: 1px solid #494050;
  margin-top: 20px;
  padding-top: 16px;
  font-size: 12px;
}
.quote-entry summary {
  cursor: pointer;
  color: #d7c2f0;
}
.quote-confirm {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  line-height: 1.8;
  margin: 14px 0;
}
.quote-confirm input {
  margin-top: 4px;
}
.quote-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.quote-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.quote-form input,
.quote-form select {
  min-width: 0;
  width: 100%;
  padding: 9px;
  background: #15121c;
  color: #eee6f6;
  border: 1px solid #51405e;
  border-radius: 3px;
}
.wide {
  grid-column: 1 / -1;
}
</style>
