<script setup lang="ts">
import HomePixelBackground from './home/HomePixelBackground.vue'
import HardwareExplodedView from './home/HardwareExplodedView.vue'
const titleLines = ['少一点纠结', '多一点适合']

function showFeatures() {
  document.getElementById('home-features')?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    block: 'start',
  })
}
</script>

<template>
  <section class="hero hero-auto" id="home">
    <HomePixelBackground />
    <div class="hero_intro">
      <div class="hero_copy">
        <p class="hero_eyebrow">NEXBUILD</p>
        <h1 class="hero_title" :aria-label="titleLines.join('，')">
          <span v-for="(line, lineIndex) in titleLines" :key="line" class="hero_title_line" aria-hidden="true"><span v-for="(character, index) in [...line]" :key="index" class="hero_title_character" :style="{ '--character-index': lineIndex * 5 + index }">{{ character }}</span></span>
        </h1>
        <p class="hero_subtitle">按预算和用途选一台适合你的电脑</p>
        <div class="hero_actions">
          <router-link to="/smart-build" class="hero_start_action">
            开始装机 <span aria-hidden="true">↗</span>
          </router-link>
          <button type="button" class="hero_learn_more" @click="showFeatures">
            了解更多 <span aria-hidden="true">↓</span>
          </button>
        </div>
      </div>
      <HardwareExplodedView />
    </div>
  </section>
</template>

<style scoped>
@media(min-width:901px) {
  .hero-auto { --pc-display-outset: clamp(0px, calc(14vw - 154px), 174px); }
  .hero-auto :deep(.pc-exploded) { height: auto; aspect-ratio: 1; max-height: min(60svh,600px); min-height: 0; }
  .hero-auto :deep(.pc-canvas),
  .hero-auto :deep(.pc-poster) {
    inset: calc(0px - var(--pc-display-outset));
    width: calc(100% + var(--pc-display-outset) + var(--pc-display-outset));
    height: calc(100% + var(--pc-display-outset) + var(--pc-display-outset));
  }
}
@media(max-width:900px) {
  .hero-auto { padding-block: 32px 24px; }
  .hero-auto :deep(.pc-exploded) { height: auto; aspect-ratio: 1; max-height: min(50svh, calc(100svh - 350px), 560px); min-height: 190px; }
  .hero-auto .hero_intro { gap: 12px; }
  .hero-auto .hero_title { margin-top: 12px; font-size: clamp(30px,7vw,44px); }
  .hero-auto .hero_subtitle { margin-top: 10px; font-size: 13px; }
  .hero-auto .hero_actions { margin-top: 16px; }
}
@media(max-height:640px) and (min-width:901px) {
  .hero-auto { padding-block: 12px; }
  .hero-auto :deep(.pc-exploded) { max-height: 76svh; min-height: 0; }
}
@media(max-height:500px) and (max-width:900px) and (orientation:landscape) {
  .hero-auto .hero_intro { grid-template-columns: .9fr 1.1fr; gap: 16px; max-width: none; }
  .hero-auto :deep(.pc-exploded) { height: 72svh; max-height: 72svh; aspect-ratio: auto; min-height: 0; }
  .hero-auto .hero_title { font-size: 28px; }
  .hero-auto .hero_subtitle { font-size: 11px; }
}
@media(max-width:360px) {
  .hero-auto .hero_actions { gap: 10px; flex-wrap: nowrap; }
  .hero-auto .hero_actions > * { min-width: 0; padding-inline: 12px; gap: 18px; }
}
.hero_title_character {
  display: inline-block;
  animation: hero-character-slide 420ms cubic-bezier(.2,.7,.2,1) both;
  animation-delay: calc(180ms + var(--character-index) * 55ms);
}
@keyframes hero-character-slide {
  from { opacity: 0; transform: translateX(.65em); filter: blur(3px); }
  to { opacity: 1; transform: translateX(0); filter: blur(0); }
}
.hero_eyebrow,
.hero_subtitle,
.hero_actions > * {
  animation: hero-element-reveal 560ms cubic-bezier(.2,.7,.2,1) both;
  animation-delay: var(--reveal-delay, 0ms);
}
.hero_eyebrow { --reveal-delay: 60ms; }
.hero_subtitle { --reveal-delay: 620ms; }
.hero_actions > :first-child { --reveal-delay: 740ms; }
.hero_actions > :last-child { --reveal-delay: 820ms; }
@keyframes hero-element-reveal {
  from { opacity: 0; translate: 18px 0; filter: blur(3px); }
  to { opacity: 1; translate: 0 0; filter: blur(0); }
}
@media (prefers-reduced-motion: reduce) {
  .hero_title_character,
  .hero_eyebrow,
  .hero_subtitle,
  .hero_actions > * {
    animation: none;
  }
}
</style>
