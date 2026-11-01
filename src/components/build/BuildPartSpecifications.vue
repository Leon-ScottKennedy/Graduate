<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { PartOption } from '../../types/hardware'
import { partSpecifications } from '../../services/partSpecifications'
import { specificationReference } from '../../data/specificationReference'

const props = defineProps<{ option: PartOption; category: string }>()
const rows = computed(() => partSpecifications(props.option, props.category)
  .filter(row => row.value.trim() && !/待补充|待核验|待确认/.test(row.value)))
const expanded = ref(false)
const contentId = useId()
const reference = computed(() => specificationReference(props.option, props.category))
const sources = computed(() => {
  const urls = [
    { url: reference.value?.source, label: '厂商规格' },
    ...(reference.value?.additionalSources ?? []).map(url => ({ url, label: '补充规格' })),
    { url: props.option.specSource, label: '型号资料' },
  ]
  const seen = new Set<string>()
  return urls.flatMap(item => {
    try {
      const url = new URL(item.url ?? '')
      if (!['https:', 'http:'].includes(url.protocol) || seen.has(url.href)) return []
      seen.add(url.href)
      return [{ url: url.href, label: item.label }]
    } catch { return [] }
  })
})
</script>

<template>
  <div class="part-specifications">
    <div class="spec-header">
    <button type="button" class="spec-toggle" :aria-expanded="expanded" :aria-controls="contentId" @click="expanded = !expanded">
      <span>{{ expanded ? '收起参数' : '查看参数' }}</span>
      <svg class="spec-chevron" :class="{ expanded }" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>
    <slot name="actions" />
    </div>
    <div :id="contentId" class="spec-reveal" :class="{ expanded }" :inert="!expanded" :aria-hidden="!expanded">
    <div class="spec-content">
      <p class="spec-summary">{{ option.specs }}</p>
      <dl>
        <div><dt>品牌</dt><dd>{{ option.brand }}</dd></div>
        <div v-for="row in rows" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div>
      </dl>
      <p>{{ reference?.scope ?? '具体版本以厂商规格为准。' }}</p>
      <div class="spec-sources"><a v-for="source in sources" :key="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.label }} ↗</a></div>
      <slot />
    </div>
    </div>
  </div>
</template>

<style scoped>
.part-specifications { grid-column: 1 / -1; border-top: 1px solid light-dark(#dce1e8, #303030); padding-top: 12px; cursor: auto; user-select: text; }
.spec-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px 16px; }
.spec-toggle { display: inline-flex; align-items: center; gap: 8px; padding: 4px 0; border: 0; background: transparent; color: light-dark(#334155, #d5d9df); font: inherit; font-size: 13px; font-weight: 600; line-height: 20px; cursor: pointer; }
.spec-toggle > span { width: 4em; text-align: left; }
.spec-toggle:focus-visible { outline: 2px solid light-dark(#64748b, #a1aab6); outline-offset: 4px; }
.spec-chevron { display: block; width: 16px; height: 16px; flex: 0 0 16px; transform-origin: center; transition: transform .24s ease; }
.spec-chevron.expanded { transform: rotate(180deg); }
.spec-reveal { display: grid; grid-template-rows: 0fr; opacity: 0; transition: grid-template-rows .26s ease, opacity .2s ease; }
.spec-reveal.expanded { grid-template-rows: 1fr; opacity: 1; }
.spec-content { min-height: 0; overflow: hidden; }
.spec-summary { color: light-dark(#475569, #bbbbbb); }
.spec-sources { display: flex; flex-wrap: wrap; gap: 16px; }
dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 24px; margin: 12px 0 0; }
dl > div { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid light-dark(#e2e7ed, #282828); font-size: 12px; line-height: 1.6; }
dt { flex-shrink: 0; color: light-dark(#64748b, #a3a3a3); }
dd { margin: 0; text-align: right; overflow-wrap: anywhere; color: light-dark(#263241, #e0e0e0); }
p { margin: 14px 0 0; font-size: 11px; line-height: 1.7; color: light-dark(#64748b, #999999); }
a { display: inline-block; margin-top: 8px; font-size: 12px; color: light-dark(#476581, #becbd8); }
@media (max-width: 650px) { dl { grid-template-columns: minmax(0, 1fr); } }
@media (prefers-reduced-motion: reduce) { .spec-chevron, .spec-reveal { transition: none; } }
</style>
