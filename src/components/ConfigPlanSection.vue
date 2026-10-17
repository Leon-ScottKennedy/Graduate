<script setup lang="ts">
interface ConfigPlan {
  name: string
  price: string
  desc: string
  specs: string[]
  featured?: boolean
}

const plans: ConfigPlan[] = [
  {
    name: '办公影音',
    price: '¥3,499',
    desc: '文档办公 · 网页浏览 · 高清影音',
    specs: ['CPU · i5-12400', '显卡 · 核芯显卡', '内存 · 16GB DDR4', '固态 · 512GB NVMe']
  },
  {
    name: '主流游戏',
    price: '¥6,999',
    desc: '1080P 高画质畅玩 3A 大作',
    specs: ['CPU · i5-14600KF', '显卡 · RTX 4060', '内存 · 32GB DDR5', '固态 · 1TB NVMe'],
    featured: true
  },
  {
    name: '高端创作',
    price: '¥12,999',
    desc: '4K 视频剪辑 · 3D 渲染 · 直播推流',
    specs: ['CPU · i7-14700KF', '显卡 · RTX 4070 SUPER', '内存 · 64GB DDR5', '固态 · 2TB NVMe']
  },
  {
    name: 'AI 工作站',
    price: '¥19,999',
    desc: '大模型本地部署 · 深度学习训练',
    specs: ['CPU · R9 9950X', '显卡 · RTX 4080 SUPER', '内存 · 96GB DDR5', '固态 · 4TB NVMe']
  }
]

const cubes = [
  { top: '16%', left: '12%', width: '40px', height: '40px', delay: '1s' },
  { bottom: '18%', right: '14%', width: '50px', height: '50px', delay: '0s' },
  { top: '50%', left: '44%', width: '26px', height: '26px', delay: '2s' }
]
</script>

<template>
  <section class="config_plan" id="config-plan">
    <div class="section_bg">
      <span
        v-for="(cube, index) in cubes"
        :key="index"
        class="cube"
        :style="cube"
      ></span>
    </div>
    <div class="config_plan_inner">
      <header class="config_plan_head">
        <span class="config_plan_kicker">CONFIG PLANS</span>
        <h2 class="config_plan_title">配置方案</h2>
        <p class="config_plan_subtitle">场景化整机方案，一键查看完整清单</p>
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
          <a href="#" class="config_plan_link">查看完整配置 →</a>
        </div>
      </div>
    </div>
  </section>
</template>
