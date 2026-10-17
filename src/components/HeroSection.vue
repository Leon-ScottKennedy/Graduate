<script setup lang="ts">
const cubes = [
  { top: '18%', left: '8%', width: '42px', height: '42px', animationDelay: '0s' },
  { top: '62%', left: '14%', width: '28px', height: '28px', animationDelay: '2s' },
  { top: '28%', right: '10%', width: '52px', height: '52px', animationDelay: '1s' },
  { top: '70%', right: '18%', width: '34px', height: '34px', animationDelay: '3s' },
  { bottom: '16%', left: '46%', width: '24px', height: '24px', animationDelay: '1.5s' }
]
</script>

<template>
  <section class="hero" id="home">
    <div class="section_bg">
      <span
        v-for="(cube, index) in cubes"
        :key="index"
        class="cube"
        :style="cube"
      ></span>
    </div>
    <div class="hero_intro">
      <div class="hero_copy">
        <p class="hero_eyebrow">NEXBUILD / 为你的下一台电脑</p>
        <h1 class="hero_title">少一点纠结。<br />多一点<span>适合。</span></h1>
        <p class="hero_subtitle">从第一份配置，到每一个硬件选择。<br />NexBuild 让装机思路更清晰，让选择更简单。</p>
        <div class="hero_actions">
          <router-link to="/smart-build" class="hero_btn hero_btn_primary">开始搭配 <span aria-hidden="true">↗</span></router-link>
          <router-link to="/config-plan" class="hero_btn hero_btn_ghost">浏览配置方案</router-link>
        </div>
        <p class="hero_note">预算 · 用途 · 硬件，一站理清。</p>
      </div>
      <div class="hero_preview" aria-label="装机配置界面示意">
        <div class="hero_preview_bar"><span class="hero_preview_dot"></span> 我的下一台电脑 <span class="hero_preview_label">配置示意</span></div>
        <div class="hero_preview_body">
          <p class="hero_preview_caption">YOUR NEXT BUILD</p>
          <h2>好配置，从需求开始。</h2>
          <div class="hero_preview_tags"><span>游戏电竞</span><span>内容创作</span><span>办公学习</span></div>
          <div class="hero_preview_part"><span>01 / 处理器</span><strong>流畅处理，每一项任务</strong><i class="hero_meter hero_meter_cpu"></i></div>
          <div class="hero_preview_part"><span>02 / 显卡</span><strong>为你在意的画面而选</strong><i class="hero_meter hero_meter_gpu"></i></div>
          <div class="hero_preview_part"><span>03 / 内存与存储</span><strong>给灵感，留足空间</strong><i class="hero_meter hero_meter_ram"></i></div>
          <div class="hero_preview_bottom"><span>让每一份预算，都有方向。</span><span aria-hidden="true">↗</span></div>
        </div>
      </div>
    </div>

  </section>
</template>

