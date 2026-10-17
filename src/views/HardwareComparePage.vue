<script setup lang="ts">
import { ref, computed } from 'vue'

interface HardwareSpec {
  label: string
  value: string
  win?: boolean // 该项是否占优（相对另一款）
}

interface Hardware {
  name: string
  specs: Record<string, string>
}

interface CompareRow {
  label: string
  a: string
  b: string
  winA?: boolean
  winB?: boolean
}

// 硬件数据库
const hardwareDb: Record<string, Hardware[]> = {
  CPU: [
    {
      name: 'Intel i5-14600KF',
      specs: { 核心线程: '14核 20线程', 最高睿频: '5.3 GHz', 三级缓存: '24 MB', TDP: '125 W', 内存类型: 'DDR4 / DDR5', 参考价格: '¥1,899' }
    },
    {
      name: 'AMD R7 9700X',
      specs: { 核心线程: '8核 16线程', 最高睿频: '5.5 GHz', 三级缓存: '32 MB', TDP: '65 W', 内存类型: 'DDR5', 参考价格: '¥1,999' }
    },
    {
      name: 'AMD R7 7800X3D',
      specs: { 核心线程: '8核 16线程', 最高睿频: '5.0 GHz', 三级缓存: '96 MB 3D', TDP: '120 W', 内存类型: 'DDR5', 参考价格: '¥2,599' }
    }
  ],
  显卡: [
    {
      name: 'RTX 4070 SUPER',
      specs: { 显存: '12GB GDDR6X', 核心频率: '2.48 GHz', CUDA核心: '7168', TDP: '220 W', 接口: 'PCIe 4.0 ×16', 参考价格: '¥4,899' }
    },
    {
      name: 'RX 7800 XT',
      specs: { 显存: '16GB GDDR6', 核心频率: '2.43 GHz', CUDA核心: '3840 (流处理器)', TDP: '263 W', 接口: 'PCIe 4.0 ×16', 参考价格: '¥3,999' }
    },
    {
      name: 'RTX 4060',
      specs: { 显存: '8GB GDDR6', 核心频率: '2.46 GHz', CUDA核心: '3072', TDP: '115 W', 接口: 'PCIe 4.0 ×8', 参考价格: '¥2,499' }
    }
  ]
}

const categories = Object.keys(hardwareDb)
const activeCategory = ref('CPU')

const options = computed(() => hardwareDb[activeCategory.value])
const selectedA = ref(hardwareDb.CPU[0].name)
const selectedB = ref(hardwareDb.CPU[1].name)

function switchCategory(cat: string) {
  activeCategory.value = cat
  selectedA.value = hardwareDb[cat][0].name
  selectedB.value = hardwareDb[cat][1].name
}

// 简单占优规则：数值类字段提取数字比较（显存/频率/缓存越大越好，TDP/价格越小越好）
const rows = computed<CompareRow[]>(() => {
  const a = options.value.find((h) => h.name === selectedA.value)
  const b = options.value.find((h) => h.name === selectedB.value)
  if (!a || !b) return []

  const lowerBetter = ['TDP', '参考价格']
  return Object.keys(a.specs).map((label) => {
    const va = a.specs[label]
    const vb = b.specs[label]
    const na = parseFloat(va.replace(/[^\d.]/g, ''))
    const nb = parseFloat(vb.replace(/[^\d.]/g, ''))
    const row: CompareRow = { label, a: va, b: vb }
    if (!isNaN(na) && !isNaN(nb) && na !== nb) {
      const aWin = lowerBetter.includes(label) ? na < nb : na > nb
      row.winA = aWin
      row.winB = !aWin
    }
    return row
  })
})

const cubes = [
  { top: '24%', left: '16%', width: '44px', height: '44px', animationDelay: '0.3s' },
  { bottom: '20%', right: '12%', width: '36px', height: '36px', animationDelay: '2.2s' }
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
