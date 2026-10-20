<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import BuildPartInspector from '../components/build/BuildPartInspector.vue'
import BuildAssistant from '../components/build/BuildAssistant.vue'
import { getBuildCatalog } from '../services/catalogService'
import { selectBuild } from '../services/buildSelection'
import { checkReplacement } from '../services/buildCompatibility'
import type { PartOption } from '../types/hardware'
import { money } from '../utils/format'
import '../assets/styles/build-workspace.css'

const demoParts = getBuildCatalog()
const budget = ref(9000)
const budgetInput = ref<number | string>(budget.value)
const usage = ref('游戏电竞')
const preference = ref('均衡搭配')
const extra = ref('')
const generatedFor = ref('游戏电竞 · 均衡搭配')
const usageOptions = ['游戏电竞', '内容创作', '办公学习', 'AI 计算']
const preferences = ['均衡搭配', '控制预算', '静音优先']
const chosen = ref<Record<string, PartOption>>(
  selectBuild(demoParts, budget.value, usage.value, preference.value)?.chosen ??
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
const quotedCount = computed(() => rows.value.filter((row) => row.selected.priceSource).length)
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
let budgetTimer: ReturnType<typeof setTimeout> | undefined
const requests = ['预算怎么分配？', '报价从哪里来？', '这套配置兼容吗？']

function selectUsage(value: string) {
  usage.value = value
}
function selectPreference(value: string) {
  preference.value = value
}
function updateConfiguration() {
  clearTimeout(budgetTimer)
  const previousBudget = budget.value
  const amount = Number(budgetInput.value)
  budget.value =
    String(budgetInput.value).trim() && Number.isFinite(amount)
      ? Math.min(30000, Math.max(3000, Math.round(amount)))
      : budget.value
  budgetInput.value = budget.value
  if (
    budget.value === previousBudget &&
    generatedFor.value === `${usage.value} · ${preference.value}`
  )
    return
  const selection = selectBuild(demoParts, budget.value, usage.value, preference.value)
  if (!selection) {
    notice.value = '当前候选无法组成预算内的完整配置，请调整预算。'
    return
  }
  chosen.value = selection.chosen
  generatedFor.value = `${usage.value} · ${preference.value}`
  notice.value = '配置已自动更新'
}
watch([usage, preference], updateConfiguration)
watch(budgetInput, (value) => {
  clearTimeout(budgetTimer)
  const amount = Number(value)
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
onUnmounted(() => clearTimeout(budgetTimer))
function replace(option: PartOption) {
  if (option.requiresQuote || option.price <= 0) {
    notice.value = '该型号尚无有效报价，请先录入并采用店铺报价。'
    return
  }
  const check = checkReplacement(chosen.value, selectedGroup.value.id, option)
  if (check.errors.length) {
    notice.value = `无法替换：${check.errors[0]!.message}`
    return
  }
  chosen.value = { ...chosen.value, [selectedGroup.value.id]: option }
  notice.value = ''
}
</script>

<template>
  <div class="nb-workspace">
    <BuildAssistant
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
        <form @submit.prevent="updateConfiguration">
          <label class="nb-label" for="build-budget">整机预算 <span>不含显示器与外设</span></label>
          <div class="nb-budget-input">
            <span>¥</span
            ><input
              id="build-budget"
              v-model.number="budgetInput"
              type="number"
              min="3000"
              max="30000"
              step="100"
              required
              @blur="updateConfiguration"
              @keydown.enter.prevent="updateConfiguration"
            /><small>元</small>
          </div>
          <input
            v-model.number="budgetInput"
            aria-label="调整整机预算"
            class="nb-range"
            type="range"
            min="3000"
            max="30000"
            step="100"
            @change="updateConfiguration"
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
          ></textarea>
        </form>
      </aside>
      <div class="nb-main-column">
        <section class="nb-result nb-card" aria-labelledby="build-list-title">
          <div class="nb-card-head">
            <div>
              <h2 id="build-list-title">配置清单</h2>
              <p>
                {{ generatedFor }}
              </p>
            </div>
            <span class="nb-badge">{{ rows.length }} 项配置</span>
          </div>
          <div class="nb-total-row">
            <div>
              <span
                >整机总价 ·
                {{
                  quotedCount ? `${quotedCount}/8 项采用人工店铺报价，其余参考价` : '预设参考价'
                }}</span
              ><strong>{{ money(total) }}</strong>
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
              }}<small v-if="row.selected.priceSource" :title="row.selected.priceSource.observedAt"
                >{{ row.selected.priceSource.shop }} · 人工报价</small
              ><small
                >{{ allocationPercent(row.selected.price) }} ·
                {{ selectedId === row.id ? '已选' : '查看' }} →</small
              ></span
            >
          </button>
        </section>
        <p v-if="notice" class="nb-live-message" role="status" aria-live="polite">{{ notice }}</p>
        <BuildPartInspector
          :group="selectedGroup"
          :selected="selectedOption"
          :build="chosen"
          @replace="replace"
        />
      </div>
    </div>
  </div>
</template>
