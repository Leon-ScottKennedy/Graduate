<script setup lang="ts">
defineProps<{
  id: string
  eyebrow: string
  title: string
  description: string
  to?: string
  link?: string
  reverse?: boolean
}>()
</script>

<template>
  <section class="home_feature" :class="{ home_feature_reverse: reverse }" :aria-labelledby="id">
    <div class="home_feature_copy">
      <p class="hero_eyebrow">{{ eyebrow }}</p>
      <h2 :id="id">{{ title }}</h2>
      <p class="home_feature_description">{{ description }}</p>
      <router-link v-if="to && link" :to="to" class="overview_link">{{ link }} <span aria-hidden="true">↗</span></router-link>
      <slot name="note" />
    </div>
    <div class="home_feature_visual"><slot /></div>
  </section>
</template>
