<script setup lang="ts">
import { ref } from 'vue'

interface PlanDetail {
  part: string
  name: string
  price: number
}

interface ConfigPlan {
  name: string
  price: string
  desc: string
  specs: string[]
  featured?: boolean
  detail: PlanDetail[]
}

const plans: ConfigPlan[] = [
  {
    name: '办公影音',
    price: '¥3,499',
    desc: '文档办公 · 网页浏览 · 高清影音',
    specs: ['CPU · i5-12400', '显卡 · 核芯显卡', '内存 · 16GB DDR4', '固态 · 512GB NVMe'],
    detail: [
      { part: 'CPU', name: 'Intel i5-12400', price: 1099 },
      { part: '显卡', name: 'UHD 730 核显', price: 0 },
      { part: '内存', name: 'DDR4 3200 16GB', price: 299 },
      { part: '固态', name: '512GB NVMe', price: 299 },
      { part: '主板', name: 'B660M DDR4', price: 599 },
      { part: '电源', name: '450W 铜牌', price: 249 },
      { part: '机箱', name: '简约办公机箱', price: 199 }
    ]
  },
  {
    name: '主流游戏',
    price: '¥6,999',
    desc: '1080P 高画质畅玩 3A 大作',
    specs: ['CPU · i5-14600KF', '显卡 · RTX 4060', '内存 · 32GB DDR5', '固态 · 1TB NVMe'],
    featured: true,
    detail: [
      { part: 'CPU', name: 'Intel i5-14600KF', price: 1899 },
      { part: '显卡', name: 'RTX 4060 8GB', price: 2499 },
      { part: '内存', name: 'DDR5 6000 32GB', price: 899 },
      { part: '固态', name: '1TB NVMe PCIe 4.0', price: 549 },
      { part: '主板', name: 'B760M DDR5', price: 999 },
      { part: '散热', name: '240 一体式水冷', price: 399 },
      { part: '电源', name: '650W 金牌', price: 499 },
      { part: '机箱', name: '中塔侧透机箱', price: 399 }
    ]
  },
  {
    name: '高端创作',
    price: '¥12,999',
    desc: '4K 视频剪辑 · 3D 渲染 · 直播推流',
    specs: ['CPU · i7-14700KF', '显卡 · RTX 4070 SUPER', '内存 · 64GB DDR5', '固态 · 2TB NVMe'],
    detail: [
      { part: 'CPU', name: 'Intel i7-14700KF', price: 2899 },
      { part: '显卡', name: 'RTX 4070 SUPER 12GB', price: 4899 },
      { part: '内存', name: 'DDR5 6400 64GB', price: 1799 },
      { part: '固态', name: '2TB NVMe PCIe 4.0', price: 999 },
      { part: '主板', name: 'Z790M DDR5', price: 1499 },
      { part: '散热', name: '360 一体式水冷', price: 599 },
      { part: '电源', name: '850W 金牌全模组', price: 799 },
      { part: '机箱', name: '静音中塔机箱', price: 599 }
    ]
  },
  {
    name: 'AI 工作站',
    price: '¥19,999',
    desc: '大模型本地部署 · 深度学习训练',
    specs: ['CPU · R9 9950X', '显卡 · RTX 4080 SUPER', '内存 · 96GB DDR5', '固态 · 4TB NVMe'],
    detail: [
      { part: 'CPU', name: 'AMD R9 9950X', price: 4299 },
      { part: '显卡', name: 'RTX 4080 SUPER 16GB', price: 8099 },
      { part: '内存', name: 'DDR5 6000 96GB', price: 2699 },
      { part: '固态', name: '4TB NVMe PCIe 4.0', price: 1999 },
      { part: '主板', name: 'X870E 旗舰主板', price: 2999 },
      { part: '散热', name: '420 一体式水冷', price: 999 },
      { part: '电源', name: '1000W 白金全模组', price: 1299 },
      { part: '机箱', name: '全塔工作站机箱', price: 899 }
    ]
  }
]

const expandedPlan = ref<string | null>(null)

function togglePlan(name: string) {
  expandedPlan.value = expandedPlan.value === name ? null : name
}

function formatPrice(value: number) {
  return '¥' + value.toLocaleString()
}

const cubes = [
  { top: '16%', left: '12%', width: '40px', height: '40px', animationDelay: '1s' },
  { bottom: '18%', right: '14%', width: '50px', height: '50px', animationDelay: '0s' }
]
</script>

<template>
  <section class="config_plan">
    <div class="section_bg">
      <span v-for="(cube, i) in cubes" :key="i" class="cube" :style="cube"></span>
    </div>
    <div class="config_plan_inner">
      <header class="config_plan_head">
        <span class="config_plan_kicker">CONFIG PLANS</span>
        <h2 class="config_plan_title">配置方案</h2>
        <p class="config_plan_subtitle">场景化整机方案，点击卡片查看完整清单</p>
      </header>

      <div class="config_plan_grid">
        <div
          v-for="plan in plans"
          :key="plan.name"
          class="config_plan_card"
          :class="{ featured: plan.featured }"
        >
          <span v-if="plan.featured" class="config_plan_badge">推荐</span>
          <h3 class="config_plan_name">{{ plan.name }}</h3>
          <div class="config_plan_price">{{ plan.price }}</div>
          <p class="config_plan_desc">{{ plan.desc }}</p>
          <ul class="config_plan_specs">
            <li v-for="spec in plan.specs" :key="spec">{{ spec }}</li>
          </ul>
          <a
            href="javascript:void(0)"
            class="config_plan_link"
            @click="togglePlan(plan.name)"
          >
            {{ expandedPlan === plan.name ? '收起配置 ↑' : '查看完整配置 →' }}
          </a>
        </div>
      </div>

      <!-- 展开的完整配置清单 -->
      <div v-if="expandedPlan" class="plan_detail">
        <h3 class="plan_detail_title">
          {{ plans.find((p) => p.name === expandedPlan)?.name }} · 完整清单
        </h3>
        <ul class="smart_build_list">
          <li
            v-for="item in plans.find((p) => p.name === expandedPlan)?.detail"
            :key="item.part"
            class="smart_build_item"
          >
            <span class="smart_build_part">{{ item.part }}</span>
            <span class="smart_build_name">{{ item.name }}</span>
            <span class="smart_build_price">{{ formatPrice(item.price) }}</span>
          </li>
        </ul>
        <div class="smart_build_total">
          <span>预估整机</span>
          <strong>{{ plans.find((p) => p.name === expandedPlan)?.price }}</strong>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.plan_detail {
  margin-top: 40px;
  padding: 28px 8px;
  border-top: 1px solid var(--border-divider);
}

.plan_detail_title {
  margin-bottom: 18px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}
</style>
