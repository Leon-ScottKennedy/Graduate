<script setup lang="ts">
import { ref } from 'vue'

interface BuildItem {
  part: string
  name: string
  price: string
}

const buildList: BuildItem[] = [
  { part: 'CPU', name: 'Intel i5-14600KF', price: '¥1,899' },
  { part: '显卡', name: 'RTX 4070 SUPER', price: '¥4,899' },
  { part: '内存', name: 'DDR5 6000 32GB (16GB×2)', price: '¥899' },
  { part: '固态', name: '1TB NVMe PCIe 4.0', price: '¥549' },
  { part: '主板', name: 'B760M 重炮手 DDR5', price: '¥999' },
  { part: '散热', name: '360 一体式水冷', price: '¥499' },
  { part: '电源', name: '750W 金牌全模组', price: '¥599' }
]

const usages = ['游戏电竞', '内容创作', '办公学习', 'AI 计算']
const preferences = ['均衡搭配', '性能优先', '静音低温']

const activeUsage = ref('游戏电竞')
const activePreference = ref('均衡搭配')

const cubes = [
  { top: '20%', right: '12%', width: '46px', height: '46px', delay: '0.5s' },
  { bottom: '22%', left: '10%', width: '32px', height: '32px', delay: '2.5s' },
  { top: '60%', right: '26%', width: '24px', height: '24px', delay: '1.2s' }
]
</script>

<template>
  <section class="smart_build" id="smart-build">
    <div class="section_bg">
      <span
        v-for="(cube, index) in cubes"
        :key="index"
        class="cube"
        :style="cube"
      ></span>
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
              <span class="smart_build_budget_value">¥10,000</span>
              <span class="smart_build_budget_range">¥3,000 - ¥30,000</span>
            </div>
            <div class="smart_build_slider">
              <div class="smart_build_slider_track">
                <div class="smart_build_slider_thumb"></div>
              </div>
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
            <li v-for="item in buildList" :key="item.part" class="smart_build_item">
              <span class="smart_build_part">{{ item.part }}</span>
              <span class="smart_build_name">{{ item.name }}</span>
              <span class="smart_build_price">{{ item.price }}</span>
            </li>
          </ul>
          <div class="smart_build_total">
            <span>预估整机</span>
            <strong>¥10,343</strong>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
