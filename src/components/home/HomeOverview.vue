<script setup lang="ts">
import HomeFeatureSection from './HomeFeatureSection.vue'
const scenes = [
  { title: '尽兴游戏', text: '帧率与画质', symbol: '↗' },
  { title: '专注创作', text: '剪辑与渲染', symbol: '✳' },
  { title: '轻松日常', text: '办公与学习', symbol: '⌘' }
]
const steps = ['说清预算与用途', '逐项了解配置', '比较后再选择']
</script>

<template>
  <div class="home_overview">
    <HomeFeatureSection id="scenes-title" eyebrow="01 / 按需选择" title="你的日常，决定你的配置。" description="先想用来做什么，再决定买什么。" to="/config-plan" link="浏览配置方案">
      <div class="home_scene_list">
        <router-link v-for="scene in scenes" :key="scene.title" to="/config-plan" class="home_scene_row">
          <span class="home_scene_symbol" aria-hidden="true">{{ scene.symbol }}</span>
          <div><h3>{{ scene.title }}</h3><p>{{ scene.text }}</p></div><span aria-hidden="true">↗</span>
        </router-link>
      </div>
    </HomeFeatureSection>
    <HomeFeatureSection id="compare-title" eyebrow="02 / 看懂差别" title="型号很接近，选择可以很清楚。" description="规格、功耗、参考价，放在一起看。" to="/hardware-compare" link="去对比硬件" reverse>
      <div class="overview_compare" aria-label="硬件对比示意，非实际硬件数据">
        <div class="overview_demo_label">对比示意</div>
        <div><span>关注什么</span><strong>型号 A</strong><strong>型号 B</strong></div>
        <div><span>性能规格</span><span>逐项查看</span><span>逐项查看</span></div>
        <div><span>功耗</span><span>了解需求</span><span>了解需求</span></div>
        <div><span>参考价格</span><span>结合预算</span><span>结合预算</span></div>
        <p>各有所长，按需取舍。</p>
      </div>
    </HomeFeatureSection>
    <HomeFeatureSection id="chat-title" eyebrow="03 / 理清疑问" title="不必先懂硬件，从一个问题开始。" description="把参数的困惑，变成具体的问题。" to="/ai-chat" link="打开装机助手">
      <template #note><small class="overview_demo_note">当前为模拟对话，AI 服务接入中。</small></template>
      <div class="overview_chat" aria-label="装机提问示意">
        <div class="overview_demo_label">提问示意</div>
        <p class="overview_question">第一次装机，从哪里开始？</p>
        <div class="overview_answer"><span>N /</span><p>先确定预算和用途，<br />再从一份配置清单开始了解。</p></div>
        <div class="overview_chat_topics"><span>显卡怎么选</span><span>内存多大够用</span></div>
      </div>
    </HomeFeatureSection>
    <HomeFeatureSection id="steps-title" eyebrow="04 / 开始搭配" title="从一个想法，到一份清单。" description="一步一步，让你的选择更有方向。" to="/smart-build" link="开始搭配" reverse>
      <ol class="home_step_list"><li v-for="(step, index) in steps" :key="step"><span>0{{ index + 1 }}</span><h3>{{ step }}</h3></li></ol>
    </HomeFeatureSection>
    <section class="overview_cta" aria-labelledby="start-title">
      <p class="hero_eyebrow">YOUR NEXT BUILD</p>
      <h2 id="start-title">下一台电脑，从这里开始。</h2>
      <p>带上你的预算，看看有哪些可能。</p>
      <router-link to="/smart-build" class="hero_btn hero_btn_primary">开始搭配 <span aria-hidden="true">↗</span></router-link>
    </section>
  </div>
</template>
