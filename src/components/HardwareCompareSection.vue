<script setup lang="ts">
interface CompareRow {
  label: string
  intel: string
  amd: string
  intelWin?: boolean
  amdWin?: boolean
}

const rows: CompareRow[] = [
  { label: '核心 / 线程', intel: '14核 20线程', amd: '8核 16线程', intelWin: true },
  { label: '最高睿频', intel: '5.3 GHz', amd: '5.5 GHz', amdWin: true },
  { label: '三级缓存', intel: '24 MB', amd: '32 MB', amdWin: true },
  { label: 'TDP', intel: '125 W', amd: '65 W', amdWin: true },
  { label: '内存类型', intel: 'DDR4 / DDR5', amd: 'DDR5' },
  { label: '参考价格', intel: '¥1,899', amd: '¥1,999', intelWin: true }
]

const cubes = [
  { top: '24%', left: '16%', width: '44px', height: '44px', delay: '0.3s' },
  { bottom: '20%', right: '12%', width: '36px', height: '36px', delay: '2.2s' },
  { top: '55%', left: '8%', width: '22px', height: '22px', delay: '1s' }
]
</script>

<template>
  <section class="hardware_compare" id="hardware-compare">
    <div class="section_bg">
      <span
        v-for="(cube, index) in cubes"
        :key="index"
        class="cube"
        :style="cube"
      ></span>
    </div>
    <div class="hardware_compare_inner">
      <header class="hardware_compare_head">
        <span class="hardware_compare_kicker">HARDWARE COMPARE</span>
        <h2 class="hardware_compare_title">硬件对比</h2>
        <p class="hardware_compare_subtitle">数据对比，理性选择</p>
      </header>

      <div class="hardware_compare_table">
        <div class="hardware_compare_row hardware_compare_row_head">
          <span class="hardware_compare_cell hardware_compare_label">对比项</span>
          <span class="hardware_compare_cell">Intel i5-14600KF</span>
          <span class="hardware_compare_cell">AMD R7 9700X</span>
        </div>
        <div v-for="row in rows" :key="row.label" class="hardware_compare_row">
          <span class="hardware_compare_cell hardware_compare_label">{{ row.label }}</span>
          <span
            class="hardware_compare_cell"
            :class="{ hardware_compare_win: row.intelWin }"
          >
            {{ row.intel }}
          </span>
          <span
            class="hardware_compare_cell"
            :class="{ hardware_compare_win: row.amdWin }"
          >
            {{ row.amd }}
          </span>
        </div>
        <router-link to="/ai-chat" class="hardware_compare_more">不确定怎么选？问问 AI →</router-link>
      </div>
    </div>
  </section>
</template>
