<script setup lang="ts">
import HeroSection from '../components/HeroSection.vue'
import { ref } from 'vue'
import HomeOverview from '../components/home/HomeOverview.vue'
import HomeScrollOrbit from '../components/home/HomeScrollOrbit.vue'
import { useScrollProgress } from '../composables/useScrollProgress'
import '../assets/styles/home.css'

const overviewEl = ref<HTMLElement | null>(null)
const { progress, reducedMotion } = useScrollProgress(overviewEl)
</script>

<template>
  <div ref="overviewEl" class="home_story">
    <HomeScrollOrbit :progress="progress" :reduced-motion="reducedMotion" />
    <HeroSection />
    <HomeOverview />
  </div>
</template>
