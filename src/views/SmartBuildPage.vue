<script setup lang="ts">
import { ref, computed } from 'vue'

interface BuildItem {
  part: string
  name: string
  price: number
}

const budget = ref(10000)
const budgetMin = 3000
const budgetMax = 30000

const sliderPercent = computed(
  () => ((budget.value - budgetMin) / (budgetMax - budgetMin)) * 100
)

const usages = ['游戏电竞', '内容创作', '办公学习', 'AI 计算']
const preferences = ['均衡搭配', '性能优先', '静音低温']

const activeUsage = ref('游戏电竞')
const activePreference = ref('均衡搭配')

// 各用途完整配置库（含机箱、风扇等更多部件）
const buildLibrary: Record<string, BuildItem[]> = {
  游戏电竞: [
    { part: 'CPU', name: 'Intel i5-14600KF', price: 1899 },
    { part: '显卡', name: 'RTX 4070 SUPER', price: 4899 },
    { part: '内存', name: 'DDR5 6000 32GB (16GB×2)', price: 899 },
    { part: '固态', name: '1TB NVMe PCIe 4.0', price: 549 },
    { part: '主板', name: 'B760M 重炮手 DDR5', price: 999 },
    { part: '散热', name: '360 一体式水冷', price: 499 },
    { part: '电源', name: '750W 金牌全模组', price: 599 },
    { part: '机箱', name: '中塔侧透机箱', price: 399 },
    { part: '风扇', name: 'ARGB 机箱风扇 ×3', price: 199 }
  ],
  内容创作: [
    { part: 'CPU', name: 'Intel i7-14700KF', price: 2899 },
    { part: '显卡', name: 'RTX 4070 SUPER', price: 4899 },
    { part: '内存', name: 'DDR5 6400 64GB (32GB×2)', price: 1799 },
    { part: '固态', name: '2TB NVMe PCIe 4.0', price: 999 },
    { part: '主板', name: 'Z790M DDR5', price: 1499 },
    { part: '散热', name: '360 一体式水冷', price: 599 },
    { part: '电源', name: '850W 金牌全模组', price: 799 },
    { part: '机箱', name: '静音中塔机箱', price: 599 },
    { part: '风扇', name: '静音风扇 ×3', price: 249 }
  ],
  办公学习: [
    { part: 'CPU', name: 'Intel i5-12400', price: 1099 },
    { part: '显卡', name: '核芯显卡', price: 0 },
    { part: '内存', name: 'DDR4 3200 16GB (8GB×2)', price: 299 },
    { part: '固态', name: '512GB NVMe', price: 299 },
    { part: '主板', name: 'B660M DDR4', price: 599 },
    { part: '散热', name: '原装散热器', price: 0 },
    { part: '电源', name: '450W 铜牌', price: 249 },
    { part: '机箱', name: '简约办公机箱', price: 199 },
    { part: '风扇', name: '标配风扇', price: 0 }
  ],
  'AI 计算': [
    { part: 'CPU', name: 'AMD R9 9950X', price: 4299 },
    { part: '显卡', name: 'RTX 4080 SUPER', price: 8099 },
    { part: '内存', name: 'DDR5 6000 96GB (48GB×2)', price: 2699 },
    { part: '固态', name: '4TB NVMe PCIe 4.0', price: 1999 },
    { part: '主板', name: 'X870E 旗舰主板', price: 2999 },
    { part: '散热', name: '420 一体式水冷', price: 999 },
    { part: '电源', name: '1000W 白金全模组', price: 1299 },
    { part: '机箱', name: '全塔工作站机箱', price: 899 },
    { part: '风扇', name: '高风压风扇 ×4', price: 399 }
  ]
}

const currentBuild = computed(() => buildLibrary[activeUsage.value])

const totalPrice = computed(() =>
  currentBuild.value.reduce((sum, item) => sum + item.price, 0)
)

function formatPrice(value: number) {
  return '¥' + value.toLocaleString()
}

const cubes = [
  { top: '20%', right: '12%', width: '46px', height: '46px', animationDelay: '0.5s' },
  { bottom: '22%', left: '10%', width: '32px', height: '32px', animationDelay: '2.5s' }
]
</script>

<template>
  <section class="smart_build">
    <div class="section_bg">
      <span v-for="(cube, i) in cubes" :key="i" class="cube" :style="cube"></span>
    </div>
    <div class="smart_build_inner">
      <header class="smart_build_head">
        <span class="smart_build_kicker">SMART BUILD</span>
        <h2 class="smart_build_title">智能装机</h2>
        <p class="smart_build_subtitle">设定预算与用途，AI 秒出配置清单</p>
      </header>

      <div class="smart_build_panel">
        <div class="smart_build_controls">
          <div class="smart_build_field">
            <label class="smart_build_label">预算范围</label>
            <div class="smart_build_budget">
              <span class="smart_build_budget_value">{{ formatPrice(budget) }}</span>
              <span class="smart_build_budget_range">¥3,000 - ¥30,000</span>
            </div>
            <div class="smart_build_slider">
              <input
                v-model.number="budget"
                type="range"
                class="smart_build_range"
                :min="budgetMin"
                :max="budgetMax"
                step="100"
              />
            </div>
          </div>

          <div class="smart_build_field">
            <label class="smart_build_label">主要用途</label>
            <div class="smart_build_tags">
              <span
                v-for="usage in usages"
                :key="usage"
                class="smart_build_tag"
                :class="{ active: activeUsage === usage }"
                @click="activeUsage = usage"
              >
                {{ usage }}
              </span>
            </div>
          </div>

          <div class="smart_build_field">
            <label class="smart_build_label">性能偏好</label>
            <div class="smart_build_tags">
              <span
                v-for="pref in preferences"
                :key="pref"
                class="smart_build_tag"
                :class="{ active: activePreference === pref }"
                @click="activePreference = pref"
              >
                {{ pref }}
              </span>
            </div>
          </div>

          <button class="smart_build_btn">生成配置方案</button>
        </div>

        <div class="smart_build_result">
          <h3 class="smart_build_result_title">推荐配置 · {{ activeUsage }}</h3>
          <ul class="smart_build_list">
            <li v-for="item in currentBuild" :key="item.part" class="smart_build_item">
              <span class="smart_build_part">{{ item.part }}</span>
              <span class="smart_build_name">{{ item.name }}</span>
              <span class="smart_build_price">{{ formatPrice(item.price) }}</span>
            </li>
          </ul>
          <div class="smart_build_total">
            <span>预估整机</span>
            <strong>{{ formatPrice(totalPrice) }}</strong>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 原生 range 滑块：延续滑块视觉风格 */
.smart_build_range {
  width: 100%;
  height: 6px;
  appearance: none;
  border-radius: 3px;
  outline: none;
  background: linear-gradient(
    90deg,
    var(--color-primary) 0%,
    var(--color-primary-light) v-bind('sliderPercent + "%"'),
    var(--border-base) v-bind('sliderPercent + "%"')
  );
  cursor: pointer;
}

.smart_build_range::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--text-primary);
  border: 3px solid var(--color-primary);
}

.smart_build_range::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--text-primary);
  border: 3px solid var(--color-primary);
}
</style>
