<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { PartOption } from '../../types/hardware'
import BuildShopLink from './BuildShopLink.vue'
import BuildPartSpecifications from './BuildPartSpecifications.vue'
import { money } from '../../utils/format'

const props = defineProps<{
  option: PartOption
  category: string
  currentPrice: number
  current?: boolean
  warning?: string
  reason?: string
  platformSwitch?: boolean
}>()
const emit = defineEmits<{ replace: [option: PartOption]; compare: [option: PartOption]; 'drag-start': [category: string, option: PartOption]; 'drag-end': [] }>()
const dragging = ref(false)
const card = ref<HTMLElement | null>(null)
let scrollRoot: HTMLElement | null = null
let revealFrame = 0
let revealSize: ResizeObserver | undefined
function updateReveal() {
  revealFrame = 0
  if (!card.value || !scrollRoot) return
  const bottom = scrollRoot.getBoundingClientRect().bottom
  const top = card.value.getBoundingClientRect().top
  const progress = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : Math.max(0, Math.min(1, (bottom - top) / 100))
  // Follow the scroll position rather than replaying a timed entrance.
  card.value.style.setProperty('--reveal-opacity', String(progress))
  card.value.style.setProperty('--reveal-scale', String(.3 + .7 * progress))
}
function queueReveal() {
  if (!revealFrame) revealFrame = requestAnimationFrame(updateReveal)
}
onMounted(() => {
  scrollRoot = card.value?.closest<HTMLElement>('.candidate-list') ?? null
  if (!scrollRoot) return
  scrollRoot.addEventListener('scroll', queueReveal, { passive: true })
  window.addEventListener('resize', queueReveal)
  revealSize = new ResizeObserver(queueReveal)
  revealSize.observe(scrollRoot)
  updateReveal()
})
onUnmounted(() => {
  scrollRoot?.removeEventListener('scroll', queueReveal)
  window.removeEventListener('resize', queueReveal)
  revealSize?.disconnect()
  cancelAnimationFrame(revealFrame)
})
let dragImage: HTMLElement | undefined
let emptyDragImage: HTMLCanvasElement | undefined
let dragGrip = { x: 0, y: 0 }
function moveDragPreview(event: DragEvent) {
  if (!dragImage) return
  const x = event.clientX - dragGrip.x
  const y = event.clientY - dragGrip.y
  dragImage.style.transform = `translate3d(${x}px, ${y}px, 0)`
}
function finishDrag() {
  dragging.value = false
  dragImage?.remove()
  dragImage = undefined
  emptyDragImage?.remove()
  emptyDragImage = undefined
  document.removeEventListener('dragover', moveDragPreview, true)
  window.removeEventListener('dragend', finishDrag)
  emit('drag-end')
}
onUnmounted(finishDrag)
function startDrag(event: DragEvent) {
  if (props.current || props.platformSwitch || props.option.requiresQuote || props.option.price <= 0 || !event.dataTransfer
    || (event.target instanceof Element && event.target.closest('a, button, .part-specifications'))) {
    event.preventDefault()
    return
  }
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('text/plain', props.option.name)
  // A DOM overlay stays opaque; native drag images are forcibly translucent.
  const source = event.currentTarget as HTMLElement
  const sourceRect = source.getBoundingClientRect()
  const computed = getComputedStyle(source)
  dragImage?.remove()
  dragImage = source.cloneNode(true) as HTMLElement
  dragImage.setAttribute('aria-hidden', 'true')
  dragImage.setAttribute('inert', '')
  dragImage.removeAttribute('draggable')
  dragImage.classList.remove('is-draggable', 'is-dragging')
  dragImage.querySelectorAll('.row-actions, .row-advice, .row-warning, .part-specifications, .model-price > span').forEach(element => element.remove())
  Object.assign(dragImage.style, {
    position: 'fixed', left: '0', top: '0', zIndex: '2147483647',
    width: `${Math.min(440, window.innerWidth - 16)}px`,
    display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '12px',
    padding: '16px 18px', borderRadius: '10px',
    margin: '0', opacity: '1', transition: 'none',
    background: computed.backgroundColor, border: computed.border,
    fontFamily: computed.fontFamily, boxShadow: '0 16px 40px rgb(0 0 0 / .26)',
    pointerEvents: 'none', willChange: 'transform',
  })
  const price = dragImage.querySelector<HTMLElement>('.model-price')
  if (price) Object.assign(price.style, { gridColumn: '1', gridRow: '2', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', textAlign: 'left' })
  document.body.appendChild(dragImage)
  // Preserve the grabbed point proportionally when the compact preview differs
  // from the source card's dimensions.
  dragGrip = {
    x: Math.max(0, Math.min(1, (event.clientX - sourceRect.left) / Math.max(1, sourceRect.width))) * dragImage.offsetWidth,
    y: Math.max(0, Math.min(1, (event.clientY - sourceRect.top) / Math.max(1, sourceRect.height))) * dragImage.offsetHeight,
  }
  moveDragPreview(event)
  emptyDragImage = document.createElement('canvas')
  emptyDragImage.width = emptyDragImage.height = 1
  Object.assign(emptyDragImage.style, { position: 'fixed', left: '0', top: '0', pointerEvents: 'none' })
  emptyDragImage.setAttribute('aria-hidden', 'true')
  document.body.appendChild(emptyDragImage)
  event.dataTransfer.setDragImage(emptyDragImage, 0, 0)
  document.addEventListener('dragover', moveDragPreview, true)
  window.addEventListener('dragend', finishDrag)
  dragging.value = true
  emit('drag-start', props.category, props.option)
}
</script>

<template>
  <article ref="card" class="candidate-row" :class="{ 'is-current': current, 'is-dragging': dragging, 'is-draggable': !current && !platformSwitch && option.price > 0 && !option.requiresQuote }"
    :draggable="!current && !platformSwitch && option.price > 0 && !option.requiresQuote" @dragstart="startDrag" @dragend="finishDrag">
    <div class="model-info">
      <h3 :title="option.name">{{ option.name }}</h3>
      <p>{{ option.specs }}</p>
    </div>
    <div class="model-price">
      <strong>{{ option.price > 0 && !option.requiresQuote ? money(option.price) : '待报价' }}</strong>
      <span>参考价</span>
      <span v-if="!current && option.price > 0 && !option.requiresQuote && currentPrice > 0" class="price-difference"
        :class="{ 'is-higher': option.price > currentPrice, 'is-lower': option.price < currentPrice }">
        {{ option.price === currentPrice ? '价格相同' : `${option.price > currentPrice ? '贵' : '省'} ${money(Math.abs(option.price - currentPrice))}` }}
      </span>
    </div>
    <BuildPartSpecifications :key="option.id" :option="option" :category="category">
      <template #actions>
      <div class="row-buttons">
        <button v-if="!current" type="button" class="replace-button compare-button" @click="emit('compare', option)">参数对比</button>
        <button v-if="!current" type="button" class="replace-button apply-button"
          :disabled="option.price <= 0 || !!option.requiresQuote" @click="$emit('replace', option)">
          {{ option.price <= 0 || option.requiresQuote ? '待报价' : platformSwitch ? '换平台方案' : '替换' }}
        </button>
      </div>
      </template>
      <p v-if="reason" class="row-advice">{{ reason }}</p>
      <div class="purchase-links"><span>购买渠道</span><BuildShopLink :category="category" :option="option" compact /></div>
    </BuildPartSpecifications>
    <p class="row-warning card-warning" :class="{ 'is-empty': !warning }" :aria-hidden="!warning">{{ warning || '\u00a0' }}</p>
  </article>
</template>

<style scoped>
.candidate-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 24px; row-gap: 20px; padding: 22px; margin-bottom: 18px; border: 1px solid #343434; border-radius: 6px; background: #141414; box-shadow: 0 2px 4px #0002; transition: border-color .18s ease, box-shadow .18s ease; }
.model-info { grid-column: 1; grid-row: 1; min-width: 0; }
.candidate-row { opacity: var(--reveal-opacity, 1); scale: var(--reveal-scale, 1); transform-origin: center top; }
.candidate-row:focus-within { opacity: 1; scale: 1; }
.is-draggable { cursor: grab; user-select: none; }
.is-draggable:hover { border-color: #747474; background: light-dark(#f8fafc, #191919); }
.is-dragging { opacity: .45; border-style: dashed; }
.is-draggable:active { cursor: grabbing; }
.model-info h3 { margin: 0; color: #ddd; font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.model-info p { margin: 8px 0 0; color: #888; font-size: 12px; line-height: 1.7; }
.model-price { grid-column: 2; grid-row: 1; text-align: right; padding-top: 1px; }
.model-price strong { display: block; color: #e4e4e4; font-size: 20px; line-height: 1.4; font-variant-numeric: tabular-nums; }
.model-price > span { color: #888; font-size: 11px; }
.row-buttons { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-left: auto; }
.price-difference, .row-note { color: #999; font-size: 12px; }
.model-price .price-difference { display: block; margin-top: 5px; font-size: 12px; }
.replace-button.compare-button { background: transparent; }
.purchase-links { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid light-dark(#dce1e8, #303030); font-size: 12px; color: light-dark(#58677c, #999); }
.price-difference.is-higher { color: #ff6464; font-weight: 600; }
.price-difference.is-lower { color: #a6cab9; font-weight: 600; }
.replace-button { min-height: 32px; padding: 6px 16px; border: 1px solid light-dark(#b6bec9, #626262); background: light-dark(#e7ebf0, #303030); color: light-dark(#263241, #f0f0f0); border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer; transition: background-color .16s ease, border-color .16s ease; }
.replace-button:not(:disabled):hover { background: light-dark(#dce2e9, #424242); border-color: light-dark(#8593a5, #888888); }
.replace-button:not(:disabled):active { transform: scale(.97); }
.replace-button:disabled { opacity: .45; cursor: default; }
.replace-button:focus-visible { outline: 2px solid #aaa; outline-offset: 3px; }
.row-advice, .row-warning { grid-column: 1 / -1; margin: 0; color: #999; font-size: 11px; line-height: 1.7; }
.row-warning { color: #b9a16d; }
@media (max-width: 520px) {
  .candidate-row { column-gap: 12px; padding: 16px; row-gap: 16px; }
  .model-price strong { font-size: 18px; }
}
@media (prefers-reduced-motion: reduce) { .candidate-row { transition: none; opacity: 1; scale: 1; } .replace-button:active { transform: none; } }
</style>
