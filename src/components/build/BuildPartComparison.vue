<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useId } from 'vue'
import type { PartOption } from '../../types/hardware'
import { comparePartSpecifications } from '../../services/partComparison'
import { specificationReference } from '../../data/specificationReference'
import { money } from '../../utils/format'
import BuildPriceSource from './BuildPriceSource.vue'

const props = defineProps<{ current: PartOption; candidate: PartOption; category: string; label: string;
  platformChanges?: { label: string; name: string; price: number }[]; platformTotal?: number; platformError?: string }>()
const emit = defineEmits<{ close: []; replace: [option: PartOption] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()
const onlyDifferences = ref(false)
const rows = computed(() => comparePartSpecifications(props.current, props.candidate, props.category))
const differences = computed(() => rows.value.filter(row => row.different).length)
const visibleRows = computed(() => onlyDifferences.value ? rows.value.filter(row => row.different) : rows.value)
const priced = (part: PartOption) => part.price > 0 && !part.requiresQuote
const price = (part: PartOption) => priced(part) ? money(part.price) : '待报价'
const basis = (part: PartOption) => part.referencePrice ? '参考价' : part.priceSource ? '人工记录报价' : part.marketOffer ? '采集展示价' : '参考价'
const priceDifference = computed(() => {
  if (!priced(props.current) || !priced(props.candidate)) return '缺少有效价格，暂不计算差额'
  const delta = props.candidate.price - props.current.price
  return delta === 0 ? '两款价格相同' : `候选${delta > 0 ? '贵' : '省'} ${money(Math.abs(delta))}`
})
const sources = computed(() => [props.current, props.candidate].map(part => {
  const reference = specificationReference(part, props.category)
  return [...new Set([reference?.source, ...(reference?.additionalSources ?? []), part.specSource])].flatMap(value => {
    try {
      const url = new URL(value ?? '')
      return ['https:', 'http:'].includes(url.protocol) ? [url.href] : []
    } catch { return [] }
  })
}))
let previousFocus: HTMLElement | null = null
let previousOverflow = ''
onMounted(() => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  previousOverflow = document.body.style.overflow
  dialog.value?.showModal()
  document.body.style.overflow = 'hidden'
})
onUnmounted(() => {
  dialog.value?.close()
  document.body.style.overflow = previousOverflow
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
})
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="part-comparison" :aria-labelledby="titleId"
      @cancel.prevent="emit('close')" @click="($event.target === dialog) && emit('close')">
      <header class="comparison-header">
        <div><p class="eyebrow">{{ label }} · 两款对比</p><h2 :id="titleId">硬件参数对比</h2></div>
        <button type="button" class="close-button" aria-label="关闭参数对比" autofocus @click="emit('close')">
          <svg viewBox="0 0 12 12" width="16" height="16" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true"><path d="M1 1h2v2h2v2h2V3h2V1h2v2H9v2H7v2h2v2h2v2H9V9H7V7H5v2H3v2H1V9h2V7h2V5H3V3H1z" /></svg>
        </button>
      </header>
      <div class="comparison-toolbar">
        <p>{{ priceDifference }}<span> · {{ differences }} 项参数不同</span></p>
        <label><input v-model="onlyDifferences" type="checkbox" /> 只看不同参数</label>
      </div>
      <div class="comparison-scroll" tabindex="0" aria-label="两款硬件规格对照">
        <table>
          <caption class="sr-only">当前配置与候选配件的价格及参数对照</caption>
          <colgroup><col class="label-column" /><col /><col /></colgroup>
          <thead><tr>
            <th scope="col">{{ label }}</th>
            <th v-for="(part, index) in [current, candidate]" :key="index" scope="col">
              <span class="part-badge" :class="{ candidate: index === 1 }">{{ index === 0 ? '当前配置' : '候选配件' }}</span>
              <h3>{{ part.name }}</h3><strong class="part-price">{{ price(part) }}</strong><small>{{ basis(part) }}</small>
            </th>
          </tr></thead>
          <tbody>
            <tr><th scope="row">品牌</th><td>{{ current.brand }}</td><td>{{ candidate.brand }}</td></tr>
            <tr><th scope="row">规格概览</th><td>{{ current.specs }}</td><td>{{ candidate.specs }}</td></tr>
            <tr v-for="row in visibleRows" :key="row.label" :class="{ different: row.different }">
              <th scope="row">{{ row.label }}<span v-if="row.different" class="difference-mark" aria-label="参数不同"> ·</span></th>
              <td :class="{ unknown: row.currentUnknown }">{{ row.current }}</td>
              <td :class="{ unknown: row.candidateUnknown }">{{ row.candidate }}</td>
            </tr>
            <tr v-if="onlyDifferences && !visibleRows.length"><td colspan="3" class="empty-state">已登记的参数相同。</td></tr>
            <tr><th scope="row">资料与价格来源</th>
              <td v-for="(part, index) in [current, candidate]" :key="index">
                <div class="source-links"><a v-for="(url, sourceIndex) in sources[index]" :key="url" :href="url" target="_blank" rel="noopener noreferrer">规格资料 {{ sourceIndex + 1 }} ↗</a></div>
                <span v-if="!sources[index]?.length" class="unknown">暂无厂商资料链接</span>
                <BuildPriceSource :option="part" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer class="comparison-footer">
        <div v-if="platformChanges?.length" class="platform-plan">
          <div class="platform-summary"><strong>联动更换</strong><span>整机 {{ money(platformTotal ?? 0) }}</span></div>
          <ul><li v-for="part in platformChanges" :key="part.label"><span>{{ part.label }}</span><strong>{{ part.name }}</strong><span>{{ money(part.price) }}</span></li></ul>
        </div>
        <p v-if="platformError" role="status">{{ platformError }}</p>
        <div class="comparison-actions">
          <button type="button" class="apply-button" :disabled="!priced(candidate) || !!platformError" @click="emit('replace', candidate)">{{ platformChanges?.length ? '确认联动更换' : '替换为此候选' }}</button></div>
      </footer>
    </dialog>
  </Teleport>
</template>

<style scoped>
.part-comparison { --line: light-dark(#dce2eb, #303030); --muted: light-dark(#58677c, #999999); box-sizing: border-box; width: min(1100px, calc(100vw - 48px)); max-width: none; max-height: min(88dvh, 960px); margin: auto; padding: 0; border: 1px solid var(--line); border-radius: 14px; background: light-dark(#ffffff, #0a0a0a); color: light-dark(#263247, #eeeeee); font-family: var(--font-family, sans-serif); box-shadow: 0 24px 100px #0006; }
.part-comparison {
  --line: light-dark(#b8bec7, #303030);
  --muted: light-dark(#48515e, #999999);
  --pixel-frame: light-dark(#85909f, #656565);
  --pixel-cut: polygon(12px 0, calc(100% - 12px) 0, calc(100% - 12px) 6px, calc(100% - 6px) 6px, calc(100% - 6px) 12px, 100% 12px, 100% calc(100% - 12px), calc(100% - 6px) calc(100% - 12px), calc(100% - 6px) calc(100% - 6px), calc(100% - 12px) calc(100% - 6px), calc(100% - 12px) 100%, 12px 100%, 12px calc(100% - 6px), 6px calc(100% - 6px), 6px calc(100% - 12px), 0 calc(100% - 12px), 0 12px, 6px 12px, 6px 6px, 12px 6px);
  position: fixed;
  isolation: isolate;
  border: 0;
  border-radius: 0;
  padding: 2px;
  background: var(--pixel-frame);
  clip-path: var(--pixel-cut);
}
.part-comparison::before {
  content: '';
  position: absolute;
  inset: 2px;
  z-index: -1;
  background: light-dark(#ffffff, #0a0a0a);
  clip-path: var(--pixel-cut);
  pointer-events: none;
}
.part-comparison[open] { display: flex; flex-direction: column; animation: comparison-open 150ms steps(3, end); }
.part-comparison::backdrop { background: #0009; backdrop-filter: blur(5px); }
.comparison-header { display: flex; align-items: center; justify-content: space-between; padding: 24px 28px 18px; gap: 16px; }
.eyebrow { margin: 0 0 6px; color: var(--muted); font-size: 12px; }
h2 { display: flex; align-items: center; gap: 16px; margin: 0; font-size: 23px; }
h2::before { content: ''; width: 6px; height: 6px; flex: 0 0 6px; margin: 0 6px; background: currentColor; box-shadow: -6px -6px 0 currentColor, 6px -6px 0 currentColor, -6px 6px 0 currentColor, 6px 6px 0 currentColor; }
button { font: inherit; cursor: pointer; border: 1px solid var(--line); border-radius: 6px; background: light-dark(#f1f4f8, #1c1c1c); color: inherit; padding: 10px 16px; font-size: 13px; }
button { border-radius: 0; border-width: 2px; box-shadow: inset 0 1px 0 light-dark(#ffffff, #ffffff12), 0 3px 0 light-dark(#c7ced7, #030303); }
button:hover { border-color: light-dark(#7b8ca4, #888888); }
button:not(:disabled):active { transform: translateY(2px); box-shadow: inset 0 1px 0 light-dark(#ffffff, #ffffff12); }
button:focus-visible, a:focus-visible, input:focus-visible, .comparison-scroll:focus-visible { outline: 2px solid light-dark(#5468be, #cccccc); outline-offset: 3px; }
.close-button { display: grid; place-items: center; width: 36px; height: 36px; padding: 0; }
.comparison-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 14px 28px; border-block: 1px solid var(--line); background: light-dark(#f7f9fc, #111111); font-size: 13px; }
.comparison-toolbar p { margin: 0; font-weight: 600; }
.comparison-toolbar span { color: var(--muted); font-weight: 400; }
.comparison-toolbar label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.comparison-scroll { overflow: auto; min-height: 0; overscroll-behavior: contain; }
.comparison-scroll { scrollbar-width: thin; scrollbar-color: light-dark(#a3a3a3, #555555) light-dark(#f1f1f1, #111111); }
.comparison-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.comparison-scroll::-webkit-scrollbar-track { background: light-dark(#f1f1f1, #111111); }
.comparison-scroll::-webkit-scrollbar-thumb { background: light-dark(#a3a3a3, #555555); border: 2px solid light-dark(#f1f1f1, #111111); border-radius: 0; }
.comparison-toolbar input { accent-color: light-dark(#5468be, #bdbdbd); }
tbody th { font-weight: 600; color: var(--muted); background: light-dark(#f0f1f3, transparent); }
.part-badge { display: inline-block; padding: 2px 8px; border: 1px solid var(--line); border-radius: 4px; font-size: 11px; font-weight: 500; color: var(--muted); }
.part-badge { border-radius: 0; border-width: 2px; }
.part-badge.candidate { color: light-dark(#425eb0, #dddddd); border-color: light-dark(#b9c9ed, #555555); }
h3 { font-size: 16px; line-height: 1.6; margin: 10px 0; }
.part-price { font-size: 22px; font-variant-numeric: tabular-nums; }
small { margin-left: 8px; color: var(--muted); font-size: 11px; font-weight: 400; }
.unknown { color: var(--muted); }
.source-links { display: flex; flex-wrap: wrap; gap: 6px 14px; }
a { color: light-dark(#435ea8, #dddddd); font-size: 12px; text-underline-offset: 3px; }
.empty-state { text-align: center; color: var(--muted); }
.comparison-footer { padding: 18px 28px; border-top: 1px solid var(--line); }
.comparison-footer p { margin: 0 0 14px; color: var(--muted); font-size: 12px; line-height: 1.7; }
.comparison-actions { display: flex; justify-content: flex-end; }
.platform-summary { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.platform-summary > span { color: var(--muted); }
.platform-plan ul { display: grid; gap: 6px; padding: 0; margin: 10px 0 0; list-style: none; }
.platform-plan li { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; align-items: baseline; gap: 12px; }
.platform-plan li > span:first-child { color: var(--muted); }
.platform-plan li > strong { font-weight: 500; overflow-wrap: anywhere; }
.apply-button { background: light-dark(#405aa5, #dddddd); color: light-dark(#ffffff, #111111); border-color: transparent; font-weight: 600; }
button:disabled { opacity: .45; cursor: default; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
@keyframes comparison-open { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .part-comparison[open] { animation: none; } }
table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; font-size: 13px; line-height: 1.7; }
.label-column { width: 20%; }
th, td { padding: 14px 22px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--line); overflow-wrap: anywhere; }
th + th, td + td, th + td { border-left: 1px solid var(--line); }
thead th { position: sticky; top: 0; z-index: 1; background: light-dark(#e5e7eb, #141414); padding-block: 20px; border-bottom: 2px solid light-dark(#9098a4, #303030); }
td + td, thead th + th + th { border-left-color: light-dark(#929aa5, #303030); }
.different th { background: light-dark(#e2e4e8, transparent); color: light-dark(#252a32, #999999); }
.different td { background: light-dark(#d9dde2, #202020); color: light-dark(#111111, #ffffff); box-shadow: inset 0 1px 0 light-dark(#c0c5cc, #383838), inset 0 -1px 0 light-dark(#c0c5cc, #383838); }
.different td.unknown { color: light-dark(#626262, #b0b0b0); }
.different th + td { box-shadow: inset 3px 0 0 light-dark(#555555, #bdbdbd), inset 0 1px 0 light-dark(#d0d0d0, #383838), inset 0 -1px 0 light-dark(#d0d0d0, #383838); }
.difference-mark { color: light-dark(#333333, #eeeeee); }
.platform-plan { display: block; padding: 12px 16px; margin-bottom: 12px; background: light-dark(#eef3fd, #1c1c1c); border: 2px solid var(--line); border-left-color: var(--pixel-frame); border-radius: 0; font-size: 12px; }
@media (max-width: 650px) { .part-comparison { width: calc(100vw - 16px); max-height: 94dvh; } .comparison-header, .comparison-toolbar, .comparison-footer { padding: 16px; } th, td { padding: 12px 10px; } .label-column { width: 24%; } h3 { font-size: 13px; } .part-price { font-size: 18px; } small { display: block; margin: 0; } }
</style>
