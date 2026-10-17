<script setup lang="ts">
import { ref } from 'vue'

import { getConfigPlans } from '../services/catalogService'
import { money as formatPrice } from '../utils/format'

const plans = getConfigPlans()

const expandedPlan = ref<string | null>(null)

function togglePlan(name: string) {
  expandedPlan.value = expandedPlan.value === name ? null : name
}

const cubes = [
  { top: '16%', left: '12%', width: '40px', height: '40px', animationDelay: '1s' },
  { bottom: '18%', right: '14%', width: '50px', height: '50px', animationDelay: '0s' },
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
          <a href="javascript:void(0)" class="config_plan_link" @click="togglePlan(plan.name)">
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
