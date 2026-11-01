<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const sectionEl = ref<HTMLElement | null>(null)
const revealPending = ref(true)
let observer: IntersectionObserver | undefined
let revealFrame = 0

onMounted(() => {
  if (
    !sectionEl.value ||
    !('IntersectionObserver' in window) ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    revealPending.value = false
    return
  }

  observer = new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting) {
      revealPending.value = false
      observer?.disconnect()
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -24% 0px' })
  // Paint the hidden starting state before observing an already-visible section.
  // Otherwise the first observer callback can skip the transition on refresh.
  revealFrame = requestAnimationFrame(() => {
    revealFrame = requestAnimationFrame(() => {
      if (sectionEl.value) observer?.observe(sectionEl.value)
    })
  })
})

onBeforeUnmount(() => {
  cancelAnimationFrame(revealFrame)
  observer?.disconnect()
})

defineProps<{
  id: string
  eyebrow: string
  title: string | string[]
  description?: string
  to?: string
  link?: string
  reverse?: boolean
}>()
</script>

<template>
  <section
    ref="sectionEl"
    class="home_feature"
    :class="{ home_feature_reverse: reverse, home_feature_pending: revealPending }"
    :aria-labelledby="id"
    @focusin="revealPending = false"
  >
    <div class="home_feature_copy">
      <p class="hero_eyebrow">{{ eyebrow }}</p>
      <h2 :id="id">
        <span
          v-for="(line, index) in Array.isArray(title) ? title : [title]"
          :key="index"
          class="home_heading_line"
          >{{ line }}</span
        >
      </h2>
      <p v-if="description" class="home_feature_description">{{ description }}</p>
      <router-link v-if="to && link" :to="to" class="overview_link"
        >{{ link }} <span aria-hidden="true">↗</span></router-link
      >
      <slot name="note" />
    </div>
    <div class="home_feature_visual"><slot /></div>
  </section>
</template>

<style scoped>
.home_feature_copy,
.home_feature_visual {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 1100ms ease, transform 1200ms cubic-bezier(0.16, 0.65, 0.3, 1);
}

.home_feature_pending .home_feature_copy,
.home_feature_pending .home_feature_visual {
  opacity: 0;
  transform: translateY(96px);
}

@media (max-width: 700px) {
  .home_feature_pending .home_feature_copy,
  .home_feature_pending .home_feature_visual {
    transform: translateY(64px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .home_feature_copy,
  .home_feature_visual,
  .home_feature_pending .home_feature_copy,
  .home_feature_pending .home_feature_visual {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
</style>
