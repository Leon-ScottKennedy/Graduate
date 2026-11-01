<script setup lang="ts">
import type { PartOption } from '../../types/hardware'
import { money } from '../../utils/format'
defineProps<{ option: PartOption }>()
</script>

<template>
  <details v-if="option.referencePrice" class="price-source">
    <summary>{{ option.referencePrice.basis === 'estimated' ? '估算参考价依据' : option.referencePrice.basis === 'overseas' ? '海外参考价来源' : '公开参考价来源' }}</summary>
    <p><a :href="option.referencePrice.sourceUrl" target="_blank" rel="noopener noreferrer">{{ option.referencePrice.sourceName }} ↗</a> · 查阅于 {{ option.referencePrice.checkedAt }}</p>
    <p>{{ option.referencePrice.note }}</p>
    <p v-if="option.observedMarketOffer">另存有采集展示价 {{ money(option.observedMarketOffer.price) }}；当前按参考价比较，购买前请核价。</p>
  </details>
</template>

<style scoped>
.price-source { color: #909090; font-size: 11px; line-height: 1.7; margin-top: 7px; }
summary { cursor: pointer; color: #aaa; }
p { margin-top: 5px; }
a { color: #b8b8b8; text-underline-offset: 3px; }
</style>
