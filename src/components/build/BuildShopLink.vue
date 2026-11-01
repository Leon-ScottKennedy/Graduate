<script setup lang="ts">
import { computed } from 'vue'
import type { PartOption } from '../../types/hardware'
import { purchaseSearchLinks } from '../../utils/purchaseSearch'

const props = defineProps<{ category: string; option: PartOption; compact?: boolean }>()
const links = computed(() => purchaseSearchLinks(props.option.name, props.option.specs))
</script>

<template>
  <div class="candidate-search-links" :class="{ 'is-compact': compact }" :aria-label="`${option.name}购买渠道`">
    <a v-for="link in links" :key="link.platform" :href="link.url" :aria-label="link.label" target="_blank" rel="noopener noreferrer">
      {{ compact ? (link.platform === 'jd' ? '京东' : '淘宝') : link.label }} <span aria-hidden="true">↗</span>
    </a>
  </div>
</template>

<style scoped>
.candidate-search-links { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 6px 14px; justify-self: end; align-self: center; }
a { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 8px 12px; border: 1px solid #363636; border-radius: 4px; background: #111; color: #bbb; font-size: 12px; text-decoration: none; }
a:hover { color: #eee; background: #1b1b1b; border-color: #666; }
a:focus-visible { outline: 2px solid #aaa; outline-offset: 4px; }
.is-compact { gap: 8px; }
.is-compact a { padding: 6px 10px; gap: 5px; }
</style>
