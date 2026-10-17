<script setup lang="ts">
import { ref, computed } from 'vue'

import { getComparisonCatalog } from '../services/catalogService'

interface CompareRow {
  label: string
  a: string
  b: string
  winA?: boolean
  winB?: boolean
}

const hardwareDb = getComparisonCatalog()
const categories = Object.keys(hardwareDb)
const activeCategory = ref(categories[0] ?? '')
const options = computed(() => hardwareDb[activeCategory.value] ?? [])
const selectedA = ref(options.value[0]?.name ?? '')
const selectedB = ref(options.value[1]?.name ?? options.value[0]?.name ?? '')

function switchCategory(cat: string) {
  if (!hardwareDb[cat]) return
  activeCategory.value = cat
  selectedA.value = options.value[0]?.name ?? ''
  selectedB.value = options.value[1]?.name ?? selectedA.value
}

const rows = computed<CompareRow[]>(() => {
  const a = options.value.find((item) => item.name === selectedA.value)
  const b = options.value.find((item) => item.name === selectedB.value)
  if (!a || !b) return []
  return [...new Set([...Object.keys(a.specs), ...Object.keys(b.specs)])].map((label) => {
    const va = a.specs[label] ?? '暂无数据'
    const vb = b.specs[label] ?? '暂无数据'
    const row: CompareRow = { label, a: va, b: vb }
    // Only compare like-for-like numeric prices. A larger spec is not always better.
    if (label === '参考价格') {
      const pa = Number(va.replace(/[^\d.]/g, ''))
      const pb = Number(vb.replace(/[^\d.]/g, ''))
      if (Number.isFinite(pa) && Number.isFinite(pb) && pa > 0 && pb > 0) {
        row.winA = pa < pb
        row.winB = pb < pa
      }
    }
    return row
  })
})
const cubes = [
  { top: '24%', left: '16%', width: '44px', height: '44px', animationDelay: '0.3s' },
  { bottom: '20%', right: '12%', width: '36px', height: '36px', animationDelay: '2.2s' },
]
</script>

<template>
  <section class="hardware_compare">
    <div class="section_bg">
      <span v-for="(cube, i) in cubes" :key="i" class="cube" :style="cube"></span>
    </div>
    <div class="hardware_compare_inner">
      <header class="hardware_compare_head">
        <span class="hardware_compare_kicker">HARDWARE COMPARE</span>
        <h2 class="hardware_compare_title">硬件对比</h2>
        <p class="hardware_compare_subtitle">数据对比，理性选择</p>
      </header>

      <!-- 类别与型号选择 -->
      <div class="compare_controls">
        <div class="smart_build_tags compare_cats">
          <span
            v-for="cat in categories"
            :key="cat"
            class="smart_build_tag"
            :class="{ active: activeCategory === cat }"
            @click="switchCategory(cat)"
          >
            {{ cat }}
          </span>
        </div>
        <div class="compare_selects">
          <select v-model="selectedA" class="compare_select">
            <option v-for="h in options" :key="h.name" :value="h.name">{{ h.name }}</option>
          </select>
          <span class="compare_vs">VS</span>
          <select v-model="selectedB" class="compare_select">
            <option v-for="h in options" :key="h.name" :value="h.name">{{ h.name }}</option>
          </select>
        </div>
      </div>

      <div class="hardware_compare_table">
        <div class="hardware_compare_row hardware_compare_row_head">
          <span class="hardware_compare_cell hardware_compare_label">对比项</span>
          <span class="hardware_compare_cell">{{ selectedA }}</span>
          <span class="hardware_compare_cell">{{ selectedB }}</span>
        </div>
        <div v-for="row in rows" :key="row.label" class="hardware_compare_row">
          <span class="hardware_compare_cell hardware_compare_label">{{ row.label }}</span>
          <span class="hardware_compare_cell" :class="{ hardware_compare_win: row.winA }">
            {{ row.a }}
          </span>
          <span class="hardware_compare_cell" :class="{ hardware_compare_win: row.winB }">
            {{ row.b }}
          </span>
        </div>
        <router-link to="/ai-chat" class="hardware_compare_more">
          不确定怎么选？问问 AI →
        </router-link>
      </div>
    </div>
  </section>
</template>

<style scoped>
.compare_controls {
  margin-bottom: 28px;
}

.compare_cats {
  justify-content: center;
  margin-bottom: 18px;
}

.compare_selects {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.compare_select {
  padding: 10px 16px;
  font-size: 13px;
  color: var(--text-secondary);
  background-color: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: 10px;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.compare_select:hover,
.compare_select:focus {
  border-color: var(--color-primary);
}

.compare_vs {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary-light);
}
</style>
