<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'

defineEmits<{ activate: [] }>()
const props = defineProps<{ expanded?: boolean }>()
const mascot = ref<HTMLDivElement | null>(null)
const position = ref(0)
const walking = ref(false)
const engaged = ref(false)
const hintVisible = ref(false)
let hintInterval: ReturnType<typeof setInterval> | undefined
let hintTimeout: ReturnType<typeof setTimeout> | undefined

watch(() => props.expanded, (expanded) => {
  if (expanded) hintVisible.value = false
})
let focused = false
let hovering = false
let walkFrame = 0
let resizeObserver: ResizeObserver | undefined
let motionPreference: MediaQueryList | undefined
let maxPosition = 0
let destination = 0
let speed = 24
let restUntil = 0
let lastTime = 0
let walkUntil = 0
let travelDirection = 1

function randomPause() {
  return 5000 + Math.random() * 1000
}

function measurePath() {
  if (!mascot.value) return
  const card = mascot.value.parentElement?.querySelector<HTMLElement>('.nb-result')
  const nextMaxPosition = Math.max(0, (card?.clientWidth ?? 0) - 52 - 8)
  // Card content can change height frequently; only reset the route when its width changes.
  if (nextMaxPosition === maxPosition) return
  maxPosition = nextMaxPosition
  position.value = Math.max(Math.min(8, maxPosition), Math.min(position.value, maxPosition))
  destination = position.value
  walking.value = false
  restUntil = performance.now() + randomPause()
}
function wander(time: number) {
  const elapsed = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0
  lastTime = time
  if (engaged.value || props.expanded || document.hidden) {
    walking.value = false
    restUntil = time + randomPause()
  } else if (time >= restUntil && maxPosition > 8) {
    if (!walking.value) {
      const direction = Math.random() < 0.5 ? -1 : 1
      const step = 60 + Math.random() * Math.min(220, maxPosition - 8)
      destination = Math.max(8, Math.min(maxPosition, position.value + direction * step))
      if (Math.abs(destination - position.value) < 10) {
        destination = Math.max(8, Math.min(maxPosition, position.value - direction * step))
      }
      speed = 28 + Math.random() * 22
      travelDirection = Math.sign(destination - position.value) || travelDirection
      walkUntil = time + 1800 + Math.random() * 3600
      walking.value = true
    }
    const distance = destination - position.value
    if (Math.abs(distance) < 1 || time >= walkUntil) {
      walking.value = false
      restUntil = time + randomPause()
    } else {
      walking.value = true
      position.value += Math.sign(distance) * Math.min(Math.abs(distance), speed * elapsed)
      scheduleGaze()
    }
  } else walking.value = false
  walkFrame = requestAnimationFrame(wander)
}
function updateMotionPreference() {
  cancelAnimationFrame(walkFrame)
  walking.value = false
  lastTime = 0
  if (!motionPreference?.matches) walkFrame = requestAnimationFrame(wander)
}
function pauseForPointer(value: boolean) {
  hovering = value
  engaged.value = hovering || focused
}
function pauseForFocus(value: boolean) {
  focused = value && !!mascot.value?.querySelector('button')?.matches(':focus-visible')
  engaged.value = hovering || focused
}
const face = ref<SVGSVGElement | null>(null)
const gaze = ref({ x: 0, y: 0 })
let pointer: { x: number; y: number } | undefined
let frame = 0

function updateGaze() {
  frame = 0
  if (walking.value) {
    gaze.value = { x: travelDirection * 2.8, y: 0 }
    return
  }
  if (!face.value || !pointer) {
    gaze.value = { x: 0, y: 0 }
    return
  }
  const bounds = face.value.getBoundingClientRect()
  // Aim from the centre of the eyes, with a bounded range inside the pixel face.
  const dx = pointer.x - (bounds.left + bounds.width / 2)
  const dy = pointer.y - (bounds.top + bounds.height * 23 / 28)
  const distance = Math.hypot(dx, dy, 90)
  gaze.value = { x: dx / distance * 3.2, y: dy / distance * (dy < 0 ? 4.5 : .8) }
}
function scheduleGaze() {
  if (!frame) frame = requestAnimationFrame(updateGaze)
}
watch(walking, scheduleGaze)
function trackPointer(event: PointerEvent) {
  if (event.pointerType === 'touch') return
  pointer = { x: event.clientX, y: event.clientY }
  scheduleGaze()
}
function resetGaze() {
  pointer = undefined
  cancelAnimationFrame(frame)
  frame = 0
  gaze.value = walking.value ? { x: travelDirection * 2.8, y: 0 } : { x: 0, y: 0 }
}
onMounted(() => {
  hintInterval = setInterval(() => {
    if (props.expanded || document.hidden) return
    hintVisible.value = true
    clearTimeout(hintTimeout)
    hintTimeout = setTimeout(() => { hintVisible.value = false }, 4000)
  }, 15000)
  measurePath()
  position.value = Math.min(18, maxPosition)
  destination = position.value
  resizeObserver = new ResizeObserver(measurePath)
  const card = mascot.value?.parentElement?.querySelector('.nb-result')
  if (card) resizeObserver.observe(card)
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionPreference.addEventListener('change', updateMotionPreference)
  updateMotionPreference()
  window.addEventListener('pointermove', trackPointer, { passive: true })
  window.addEventListener('scroll', scheduleGaze, { passive: true, capture: true })
  window.addEventListener('resize', scheduleGaze, { passive: true })
  window.addEventListener('blur', resetGaze)
  document.documentElement.addEventListener('pointerleave', resetGaze)
})
onUnmounted(() => {
  clearInterval(hintInterval)
  clearTimeout(hintTimeout)
  cancelAnimationFrame(walkFrame)
  resizeObserver?.disconnect()
  motionPreference?.removeEventListener('change', updateMotionPreference)
  window.removeEventListener('pointermove', trackPointer)
  window.removeEventListener('scroll', scheduleGaze, true)
  window.removeEventListener('resize', scheduleGaze)
  window.removeEventListener('blur', resetGaze)
  document.documentElement.removeEventListener('pointerleave', resetGaze)
  cancelAnimationFrame(frame)
})
</script>

<template>
  <div ref="mascot" class="build-assistant-mascot" :class="{ 'is-walking': walking }"
    :style="{ transform: `translateX(${position}px)` }"
    @pointerenter="pauseForPointer(true)" @pointerleave="pauseForPointer(false)"
    @focusin="pauseForFocus(true)" @focusout="pauseForFocus(false)">
    <button type="button" aria-label="打开装机 AI 助手" :aria-describedby="hintVisible && !expanded ? 'mascot-chat-hint' : undefined" title="问问装机助手" aria-haspopup="dialog" aria-controls="build-chat" :aria-expanded="expanded ?? false" @click="$emit('activate')">
      <span v-if="hintVisible && !expanded" id="mascot-chat-hint" class="mascot-bubble" :class="{ 'opens-left': position > maxPosition - 138 }">
        <span class="mascot-bubble-text">有不懂的？<br /><strong>点我问问！</strong></span>
      </span>
      <svg ref="face" viewBox="0 0 32 28" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">
        <g class="mascot-antenna">
          <path d="M20 0h2v2h-2zM18 2h2v2h-2zM22 2h2v2h-2zM20 4h2v5h-2z" />
        </g>
        <path d="M7 9h18v2h2v2h2v15h-4v-2h2V14h-2v-2H7v2H5v12h2v2H3V13h2v-2h2z" />
        <g class="mascot-gaze" :style="{ transform: `translate(${gaze.x}px, ${gaze.y}px)` }">
          <g class="mascot-eyes"><path d="M10 20h2v6h-2zM20 20h2v6h-2z" /></g>
        </g>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.build-assistant-mascot {
  position: absolute;
  grid-column: 1 / 2;
  grid-row: 1 / 2;
  top: -42px;
  left: 0;
  z-index: 3;
  width: 52px;
  height: 44px;
}
.build-assistant-mascot button {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0 2px 2px;
  border: 0;
  background: transparent;
  color: light-dark(#46505e, #eeeeee);
  cursor: pointer;
  transition: color .2s ease, transform .2s ease;
}
svg { display: block; width: 44px; height: 38.5px; overflow: visible; }
.mascot-bubble {
  position: absolute;
  bottom: 16px;
  left: calc(100% + 10px);
  width: 116px;
  text-align: left;
  font-family: var(--font-family);
  font-size: 12px;
  line-height: 1.45;
  color: light-dark(#46505e, #dce7f5);
  --bubble-border: light-dark(#8b97a6, #68778e);
  --bubble-bg: light-dark(#ffffff, #000000);
}
.mascot-bubble-text {
  position: relative;
  display: block;
  padding: 6px 10px;
  background: var(--bubble-border);
  clip-path: polygon(4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px), 0 4px, 4px 4px);
  isolation: isolate;
}
.mascot-bubble-text::before {
  content: '';
  position: absolute;
  inset: 2px;
  z-index: -1;
  background: var(--bubble-bg);
  clip-path: inherit;
}
.mascot-bubble-text strong {
  font-weight: 600;
  color: light-dark(#263347, #b8c9ff);
}
.mascot-bubble::after {
  content: '';
  position: absolute;
  top: 28px;
  left: -8px;
  width: 10px;
  height: 12px;
  background: var(--bubble-border);
  clip-path: polygon(100% 0, 100% 100%, 6px 100%, 6px 8px, 3px 8px, 3px 4px, 0 4px, 0 0);
}
.mascot-bubble.opens-left { left: auto; right: calc(100% + 10px); }
.mascot-bubble.opens-left::after { left: auto; right: -8px; transform: scaleX(-1); }
.is-walking svg {
  transform-origin: 50% 100%;
  animation: mascot-waddle 560ms ease-in-out infinite;
}
.is-walking .mascot-antenna {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: mascot-antenna-sway 560ms ease-in-out infinite;
}
@keyframes mascot-waddle {
  0%, 100% { transform: translateY(0) rotate(-7deg); transform-origin: 22% 100%; }
  25%, 75% { transform: translateY(-2px) rotate(0); }
  50% { transform: translateY(0) rotate(7deg); transform-origin: 78% 100%; }
}
@keyframes mascot-antenna-sway {
  0%, 100% { transform: rotate(10deg); }
  50% { transform: rotate(-10deg); }
}
.mascot-gaze { transition: transform .12s ease-out; }
.mascot-eyes { transform-box: fill-box; transform-origin: center; animation: mascot-blink 6.4s infinite; }
.mascot-antenna { animation: mascot-signal 4.8s ease-in-out infinite; }
button:hover { color: light-dark(#202b3a, #ffffff); transform: translateY(-3px); }
button:active { transform: translateY(-1px); }
button:focus-visible { outline: 2px solid currentColor; outline-offset: 4px; border-radius: 4px; }
@keyframes mascot-blink {
  0%, 43%, 47%, 100% { transform: scaleY(1); }
  45% { transform: scaleY(.16); }
}
@keyframes mascot-signal { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
@media (prefers-reduced-motion: reduce) {
  .mascot-eyes, .mascot-antenna, .is-walking svg, .is-walking .mascot-antenna { animation: none; }
  .mascot-gaze { transition: none; }
  .build-assistant-mascot button { transition: none; transform: none; }
}
</style>
