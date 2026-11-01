<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import HomeFeatureSection from './HomeFeatureSection.vue'
const buttonLabel = '开始搭配'
const buttonCharacters = ref([...buttonLabel])
let scrambleTimer: ReturnType<typeof setInterval> | undefined
function resetButton() {
  clearInterval(scrambleTimer)
  buttonCharacters.value = [...buttonLabel]
}
function scrambleButton() {
  resetButton()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const symbols = '!<>-_[]{}—=+*^?#'
  let frame = 0
  scrambleTimer = setInterval(() => {
    frame++
    const revealed = Math.max(0, Math.floor((frame - 3) / 3))
    buttonCharacters.value = [...buttonLabel].map((character, index) => index < revealed ? character : symbols[Math.floor(Math.random() * symbols.length)]!)
    if (revealed >= buttonLabel.length) resetButton()
  }, 40)
}
onUnmounted(resetButton)
const scenes = [
  { title: '尽兴游戏', text: '帧率与画质', symbol: '↗' },
  { title: '专注创作', text: '剪辑与渲染', symbol: '✳' },
  { title: '轻松日常', text: '办公与学习', symbol: '⌘' },
]
const steps = ['定预算', '选配件', '看清单']
</script>

<template>
  <div id="home-features" class="home_overview">
    <HomeFeatureSection
      id="scenes-title"
      eyebrow="01 用途"
      :title="['按用途', '选配置']"
    >
      <div class="home_scene_list">
        <div
          v-for="scene in scenes"
          :key="scene.title"
          class="home_scene_row"
        >
          <span class="home_scene_symbol" aria-hidden="true">{{ scene.symbol }}</span>
          <div>
            <h3>{{ scene.title }}</h3>
            <p>{{ scene.text }}</p>
          </div>
        </div>
      </div>
    </HomeFeatureSection>
    <HomeFeatureSection
      id="compare-title"
      eyebrow="02 对比"
      :title="['选前', '比一比']"
      reverse
    >
      <div class="overview_compare" aria-label="硬件对比示意 非实际硬件数据">
        <div class="overview_demo_label">对比示意</div>
        <div><span>关注什么</span><strong>型号 A</strong><strong>型号 B</strong></div>
        <div><span>规格</span><span>查看参数</span><span>查看参数</span></div>
        <div><span>功耗</span><span>查看需求</span><span>查看需求</span></div>
        <div><span>价格</span><span>查看参考价</span><span>查看参考价</span></div>
      </div>
    </HomeFeatureSection>
    <HomeFeatureSection
      id="chat-title"
      eyebrow="03 助手"
      :title="['装机疑问', '直接问']"
    >
      <div class="overview_chat" aria-label="装机提问示意">
        <div class="overview_demo_label">提问示意</div>
        <p class="overview_question">第一次装机怎么选</p>
        <div class="overview_answer">
          <span>N</span>
          <p>先说预算和用途</p>
        </div>
        <div class="overview_chat_topics"><span>显卡怎么选</span><span>内存多大够用</span></div>
      </div>
    </HomeFeatureSection>
    <HomeFeatureSection id="steps-title" eyebrow="04 装机" :title="['三步', '配好电脑']" reverse>
      <ol class="home_step_list">
        <li v-for="(step, index) in steps" :key="step">
          <span>0{{ index + 1 }}</span>
          <h3>{{ step }}</h3>
        </li>
      </ol>
    </HomeFeatureSection>
    <section class="overview_cta" aria-labelledby="start-title">
      <h2 id="start-title">
        <span class="home_heading_line">下一台电脑，从这里开始</span>
      </h2>
      <p>选好预算和用途，生成适合你的配置。</p>
      <router-link to="/smart-build" class="hero_btn hero_btn_primary home-start-button" aria-label="开始搭配"
        @mouseenter="scrambleButton" @mouseleave="resetButton" @focus="scrambleButton" @blur="resetButton"
        ><span class="start-label" aria-hidden="true"><span v-for="(character, index) in buttonCharacters" :key="index">{{ character }}</span></span><span aria-hidden="true">↗</span></router-link
      >
    </section>
  </div>
</template>
