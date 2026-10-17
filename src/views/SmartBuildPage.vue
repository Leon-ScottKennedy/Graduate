<script setup lang="ts">
import { computed, ref } from 'vue'
import BuildPartInspector from '../components/build/BuildPartInspector.vue'
import BuildAssistant from '../components/build/BuildAssistant.vue'
import { getBuildCatalog } from '../services/catalogService'
import type { PartOption } from '../types/hardware'
import { money } from '../utils/format'
import '../assets/styles/build-workspace.css'

const demoParts = getBuildCatalog()
const budget = ref(9000)
const usage = ref('游戏电竞')
const preference = ref('均衡搭配')
const extra = ref('')
const generatedFor = ref('游戏电竞 · 均衡搭配')
const usageOptions = ['游戏电竞', '内容创作', '办公学习', 'AI 计算']
const preferences = ['均衡搭配', '控制预算', '静音优先']
const chosen = ref<Record<string, PartOption>>(
  Object.fromEntries(demoParts.map((part) => [part.id, part.options[0]])),
)
const selectedId = ref('gpu')
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
const hoveredAllocation = ref<string | null>(null)
const focusedAllocation = ref<string | null>(null)
const activeAllocation = computed(() =>
  rows.value.find((row) => row.id === (hoveredAllocation.value ?? focusedAllocation.value)),
)
function allocationPercent(price: number) {
  return `${((price / total.value) * 100).toFixed(1)}%`
}
const remaining = computed(() => budget.value - total.value)
const notice = ref('')
const activeQuestion = ref('')
const pendingChanges = ref(false)
const requests = ['预算怎么分配？', '报价从哪里来？', '这套配置兼容吗？']

function selectUsage(value: string) {
  usage.value = value
  pendingChanges.value = true
}
function selectPreference(value: string) {
  preference.value = value
  pendingChanges.value = true
}
function generate() {
  budget.value = Math.min(30000, Math.max(3000, Number(budget.value) || 9000))
  const upgraded = budget.value >= 11000 && preference.value !== '控制预算'
  chosen.value = Object.fromEntries(
    demoParts.map((group) => {
      const useUpgrade =
        (upgraded && ['cpu', 'gpu', 'power'].includes(group.id)) ||
        (usage.value === '内容创作' && budget.value >= 9000 && ['ram', 'ssd'].includes(group.id)) ||
        (preference.value === '静音优先' && ['case', 'cooler'].includes(group.id))
      return [group.id, group.options[useUpgrade ? 1 : 0]]
    }),
  )
  generatedFor.value = `${usage.value} · ${preference.value}`
  pendingChanges.value = false
  notice.value = '配置已更新'
}
function replace(option: PartOption) {
  chosen.value = { ...chosen.value, [selectedGroup.value.id]: option }
  notice.value = `已替换${selectedGroup.value.label}`
}
const assistantReply = computed(() => {
  const question = activeQuestion.value
  if (!question) return ''
  if (question === requests[0]) {
    const gpu = chosen.value.gpu!
    return `当前示例总价 ${money(total.value)}，其中显卡 ${money(gpu.price)}，占比约 ${Math.round((gpu.price / total.value) * 100)}%。${remaining.value >= 0 ? `预算余量 ${money(remaining.value)}。` : `超过预算 ${money(-remaining.value)}，可在候选对比中更换配件。`}`
  } else if (question === requests[1]) {
    return '当前为示例报价，尚未接入京东、淘宝实时数据。'
  } else if (question === requests[2]) {
    return 'AM5 / DDR5 接口一致；BIOS、尺寸与供电兼容性尚未校验。'
  }
  return 'AI 尚未接入，暂不支持自由问答。可点击快捷问题查看当前配置。'
})
function ask(question: string) {
  activeQuestion.value = question
}
</script>

<template>
  <div class="nb-workspace">
    <header class="nb-page-head">
      <div>
        <h1>智能装机</h1>
      </div>
    </header>
    <BuildAssistant
      :question="activeQuestion"
      :reply="assistantReply"
      :questions="requests"
      @ask="ask"
    />
    <div class="nb-workbench">
      <aside class="nb-requirements nb-card">
        <div class="nb-card-head">
          <div>
            <h2>装机需求</h2>
          </div>
        </div>
        <form @submit.prevent="generate">
          <label class="nb-label" for="build-budget">整机预算 <span>不含显示器与外设</span></label>
          <div class="nb-budget-input">
            <span>¥</span
            ><input
              id="build-budget"
              v-model.number="budget"
              type="number"
              min="3000"
              max="30000"
              step="100"
              required
              @input="pendingChanges = true"
            /><small>元</small>
          </div>
          <input
            v-model.number="budget"
            aria-label="调整整机预算"
            class="nb-range"
            type="range"
            min="3000"
            max="30000"
            step="100"
            @input="pendingChanges = true"
          />
          <div class="nb-range-labels"><span>¥3,000</span><span>¥30,000</span></div>
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
          <label class="nb-label" for="build-extra">补充需求 <span>仅记录</span></label
          ><textarea
            id="build-extra"
            v-model="extra"
            placeholder="例如：已有硬盘、希望白色机箱……"
            rows="3"
            maxlength="300"
            @input="pendingChanges = true"
          ></textarea>
          <button class="nb-button nb-generate" type="submit">
            {{ pendingChanges ? '更新配置' : '生成配置' }} <span>↗</span>
          </button>
        </form>
      </aside>
      <div class="nb-main-column">
        <section class="nb-result nb-card" aria-labelledby="build-list-title">
          <div class="nb-card-head">
            <div>
              <h2 id="build-list-title">配置清单</h2>
              <p>
                {{ generatedFor }}
                <span v-if="pendingChanges" class="nb-warm">· 待更新</span>
              </p>
            </div>
            <span class="nb-badge">{{ rows.length }} 项配置</span>
          </div>
          <div class="nb-total-row">
            <div>
              <span>整机总价</span><strong>{{ money(total) }}</strong>
            </div>
            <div class="nb-budget-state" :class="{ over: remaining < 0 }">
              <span>{{ remaining >= 0 ? '预算余量' : '超出预算' }}</span
              ><b>{{ money(Math.abs(remaining)) }}</b>
            </div>
          </div>
          <div class="nb-allocation-detail" aria-live="polite">
            <span>预算分配</span>
            <span v-if="activeAllocation" class="nb-allocation-value">
              <i :style="{ background: activeAllocation.color }"></i>
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
              :style="{ flexGrow: row.selected.price, background: row.color }"
              :aria-label="`${row.label} · ${money(row.selected.price)} · ${allocationPercent(row.selected.price)}`"
              @mouseenter="hoveredAllocation = row.id"
              @mouseleave="hoveredAllocation = null"
              @focus="focusedAllocation = row.id"
              @blur="focusedAllocation = null"
              @click="selectedId = row.id"
            ></button>
          </div>
          <div class="nb-list-heading"><span>配件 / 型号</span><span>单价 / 详情</span></div>
          <button
            v-for="row in rows"
            :key="row.id"
            class="nb-part-row"
            :class="{ active: selectedId === row.id }"
            type="button"
            :aria-pressed="selectedId === row.id"
            @mouseenter="hoveredAllocation = row.id"
            @mouseleave="hoveredAllocation = null"
            @focus="focusedAllocation = row.id"
            @blur="focusedAllocation = null"
            @click="selectedId = row.id"
          >
            <span class="nb-part-icon" :style="{ borderColor: row.color, color: row.color }">{{
              row.symbol
            }}</span
            ><span class="nb-part-name"
              ><small>{{ row.label }} · {{ row.selected.brand }}</small
              ><strong :title="row.selected.name">{{ row.selected.name }}</strong></span
            ><span class="nb-part-price"
              >{{ money(row.selected.price)
              }}<small
                >{{ allocationPercent(row.selected.price) }} ·
                {{ selectedId === row.id ? '已选' : '查看' }} →</small
              ></span
            >
          </button>
          <div class="nb-check-note">
            <span>◇</span>
            <div>
              <strong>兼容性未校验</strong>
            </div>
          </div>
        </section>
        <p v-if="notice" class="nb-live-message" role="status" aria-live="polite">{{ notice }}</p>
        <BuildPartInspector :group="selectedGroup" :selected="selectedOption" @replace="replace" />
      </div>
    </div>
  </div>
</template>
