<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const canvas = ref<HTMLCanvasElement | null>(null)
let context: CanvasRenderingContext2D | null = null
let width = 0
let height = 0
let size = 64
let frame = 0
let preference: MediaQueryList | undefined
let observer: ResizeObserver | undefined
let intersection: IntersectionObserver | undefined
let visible = true
let ambientTime = 0
let lastPaint = 0
const meteors: {
  start: number
  stepTime: number
  tailLength: number
  row: number
}[] = []
let ambientInitialized = false

function paintAmbient() {
  if (!context || preference?.matches) return
  const isLight = document.documentElement.dataset.theme === 'light'
  const trailColor = isLight ? '32, 145, 185' : '124, 119, 231'
  const trailOpacity = isLight ? 0.42 : 0.32
  const fadePower = isLight ? 1.4 : 1.8
  const columns = Math.ceil(width / size)
  const rows = Math.ceil(height / size)
  const laneCount = Math.min(width < 700 ? 2 : 3, Math.ceil(rows / 2))
  // Old tails keep fading independently while new heads start in free rows.
  for (let index = meteors.length - 1; index >= 0; index--) {
    const meteor = meteors[index]!
    if ((ambientTime - meteor.start) / meteor.stepTime + 0.75 >= columns + meteor.tailLength)
      meteors.splice(index, 1)
  }
  const incoming = meteors.filter(
    (meteor) => (ambientTime - meteor.start) / meteor.stepTime < columns * 0.65,
  ).length
  const initialPass = !ambientInitialized
  for (let lane = incoming; lane < laneCount; lane++) {
    const available = Array.from({ length: rows }, (_, row) => row).filter(
      (row) => row % 2 === 0 && meteors.every((meteor) => Math.abs(row - meteor.row) >= 2),
    )
    if (!available.length) break
    const stepTime = 72 + Math.random() * 26
    // Spread the initial heads across the grid instead of aligning at the left edge.
    const initialProgress = initialPass
      ? columns * (0.08 + ((lane + Math.random() * 0.65) / laneCount) * 0.78)
      : 0
    meteors.push({
      start: ambientTime - initialProgress * stepTime,
      stepTime,
      tailLength: Math.floor((width < 700 ? 9 : 12) + Math.random() * 8),
      row: available[Math.floor(Math.random() * available.length)]!,
    })
  }
  ambientInitialized = true
  for (const meteor of meteors) {
    const { stepTime, tailLength, row } = meteor
    const age = ambientTime - meteor.start
    if (age < 0 || age > (columns + tailLength + 1) * stepTime) continue
    const travel = age / stepTime + 0.75
    const head = Math.floor(travel)
    for (let step = Math.max(0, head - tailLength); step <= Math.min(head, columns - 1); step++) {
      const column = step
      const cellAge = travel - step
      const ignite = Math.min(1, cellAge)
      const smoothIgnite = ignite * ignite * (3 - 2 * ignite)
      const fade = Math.max(0, 1 - cellAge / tailLength) ** fadePower
      context.fillStyle = `rgba(${trailColor}, ${trailOpacity * smoothIgnite * fade})`
      context.fillRect(column * size + 1, row * size + 1, size - 1, size - 1)
    }
  }
}

function paint(now: number) {
  frame = 0
  if (!context) return
  // The slow decorative trails need 30 updates/s, independent of monitor Hz.
  if (visible && !document.hidden && !preference?.matches && lastPaint && now - lastPaint < 1000 / 30 - .5) {
    frame = requestAnimationFrame(paint)
    return
  }
  if (visible && !document.hidden && !preference?.matches) {
    if (lastPaint) ambientTime += Math.min(now - lastPaint, 80)
    lastPaint = now
  } else lastPaint = 0
  context.clearRect(0, 0, width, height)
  paintAmbient()
  const isLight = document.documentElement.dataset.theme === 'light'
  context.beginPath()
  context.strokeStyle = isLight ? 'rgba(50, 75, 95, 0.24)' : 'rgba(255, 255, 255, 0.03)'
  context.lineWidth = 1
  for (let x = 0; x < width; x += size) {
    context.moveTo(x + 0.5, 0)
    context.lineTo(x + 0.5, height)
  }
  const rows = Math.ceil(height / size)
  for (let row = 0; row <= rows; row++) {
    const y = Math.min(row * size + 0.5, height - 0.5)
    context.moveTo(0, y)
    context.lineTo(width, y)
  }
  context.stroke()
  {
    // Both themes share the same cell size and four-cell major grid.
    context.beginPath()
    context.strokeStyle = isLight ? 'rgba(50, 75, 95, 0.34)' : 'rgba(255, 255, 255, 0.02)'
    for (let column = 0; column * size < width; column += 4) {
      const x = column * size + 0.5
      context.moveTo(x, 0)
      context.lineTo(x, height)
    }
    for (let row = 0; row <= rows; row += 4) {
      const y = Math.min(row * size + 0.5, height - 0.5)
      context.moveTo(0, y)
      context.lineTo(width, y)
    }
    context.stroke()
  }
  if (visible && !document.hidden && !preference?.matches) frame = requestAnimationFrame(paint)
}

function resize() {
  const element = canvas.value
  if (!element) return
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  const host = element.parentElement
  if (!host) return
  width = host.clientWidth
  const topExtension = Math.max(0, host.getBoundingClientRect().top + window.scrollY)
  // On desktop the grid ends with the hero instead of spilling into section 01.
  const transitionTail = width > 900 ? 0 : width < 700 ? 72 : 120
  height = host.clientHeight + topExtension + transitionTail
  element.style.top = `${-topExtension}px`
  element.style.height = `${height}px`
  // Exact, theme-independent squares: 64px desktop / 48px mobile.
  size = width < 700 ? 48 : 64
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  element.width = Math.round(width * ratio)
  element.height = Math.round(height * ratio)
  context = element.getContext('2d')
  context?.setTransform(ratio, 0, 0, ratio, 0, 0)
  lastPaint = 0
  paint(performance.now())
}

function reset() {
  lastPaint = 0
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  if (!document.hidden) paint(performance.now())
}
onMounted(() => {
  preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  preference.addEventListener('change', reset)
  window.addEventListener('resize', resize)
  window.addEventListener('blur', reset)
  window.addEventListener('nexbuild-theme-change', reset)
  document.addEventListener('visibilitychange', reset)
  observer = new ResizeObserver(resize)
  intersection = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? false
      lastPaint = 0
      if (visible && !document.hidden && !frame) frame = requestAnimationFrame(paint)
      if (!visible && frame) {
        cancelAnimationFrame(frame)
        frame = 0
      }
    },
    { rootMargin: '80px' },
  )
  if (canvas.value?.parentElement) intersection.observe(canvas.value.parentElement)
  if (canvas.value?.parentElement) observer.observe(canvas.value.parentElement)
  const navigation = document.querySelector('.nav_top')
  if (navigation) observer.observe(navigation)
  resize()
})
onUnmounted(() => {
  observer?.disconnect()
  intersection?.disconnect()
  if (frame) cancelAnimationFrame(frame)
  preference?.removeEventListener('change', reset)
  window.removeEventListener('resize', resize)
  window.removeEventListener('blur', reset)
  window.removeEventListener('nexbuild-theme-change', reset)
  document.removeEventListener('visibilitychange', reset)
})
</script>

<template><canvas ref="canvas" class="home-pixel-background" aria-hidden="true"></canvas></template>

<style scoped>
.home-pixel-background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #090909;
  z-index: 0;
  pointer-events: none;
  mask-image: linear-gradient(
    to bottom,
    #000 0%,
    #000 calc(100% - 280px),
    rgb(0 0 0 / 0.82) calc(100% - 210px),
    rgb(0 0 0 / 0.42) calc(100% - 140px),
    rgb(0 0 0 / 0.1) calc(100% - 70px),
    transparent 100%
  );
}
@media (max-width: 700px) {
  .home-pixel-background {
    mask-image: linear-gradient(
      to bottom,
      #000 0%,
      #000 calc(100% - 190px),
      rgb(0 0 0 / 0.5) calc(100% - 95px),
      transparent 100%
    );
  }
}
</style>
