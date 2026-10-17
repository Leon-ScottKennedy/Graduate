<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { createCubeBrandTextures } from './cubeBrandTextures'

const props = defineProps<{ progress: number; reducedMotion: boolean }>()
const host = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
type Point = { x: number; y: number; z: number }
type TrackPoint = Point & { distance: number }
let width = 0
let height = 0
let viewportHeight = 0
let phase = 0
let clock = 0
let lastTime = 0
let frame = 0
let visible = true
let track: TrackPoint[] = []
let trackLength = 0
let storyHeight = 0
let entryY = 0
let storyTop = 0
let entryHeadDistance = 0
// A slightly longer span gives the 16 cubes more room without changing the path.
const curveLength = 1800
const cubeCount = 16
const cubeSpacing = curveLength / (cubeCount - 1)
let brandTextures: HTMLCanvasElement[] = []
let disposed = false
let textBounds: { left: number; right: number; top: number; bottom: number }[] = []
let observer: ResizeObserver | undefined
let intersection: IntersectionObserver | undefined
const corners: Point[] = [
  { x: -1, y: -1, z: -1 }, { x: 1, y: -1, z: -1 },
  { x: 1, y: 1, z: -1 }, { x: -1, y: 1, z: -1 },
  { x: -1, y: -1, z: 1 }, { x: 1, y: -1, z: 1 },
  { x: 1, y: 1, z: 1 }, { x: -1, y: 1, z: 1 },
]
const faces = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [3, 2, 6, 7], [1, 5, 6, 2], [0, 3, 7, 4]]
const cubePalette = {
  light: [240, 236, 255], // #F0ECFF: the previous pale sticker tone, across the full face
  side: [205, 199, 229], // #CDC7E5
  dark: [112, 104, 137], // #706889
  background: [18, 17, 23],
} as const

function faceColor(depth: number, visibility: number) {
  const target = depth >= 0 ? cubePalette.light : cubePalette.dark
  const amount = Math.min(1, Math.abs(depth))
  const channels = cubePalette.side.map((channel, index) => {
    const lit = channel + (target[index]! - channel) * amount
    return Math.round(lit * visibility + cubePalette.background[index]! * (1 - visibility))
  })
  return `rgb(${channels.join(', ')})`
}

function rotate(point: Point, a: number, b: number, c: number): Point {
  const x = point.x * Math.cos(b) + point.z * Math.sin(b)
  const depth = -point.x * Math.sin(b) + point.z * Math.cos(b)
  const y = point.y * Math.cos(a) - depth * Math.sin(a)
  const z = point.y * Math.sin(a) + depth * Math.cos(a)
  return { x: x * Math.cos(c) - y * Math.sin(c), y: x * Math.sin(c) + y * Math.cos(c), z }
}

function measure() {
  if (!host.value || !canvas.value) return
  const story = host.value.parentElement
  if (!story) return
  const storyRect = story.getBoundingClientRect()
  const cta = story.querySelector<HTMLElement>('.overview_cta')
  // Use the actual content bounds rather than a hard-coded footer allowance.
  host.value.style.height = `${cta ? cta.getBoundingClientRect().top - storyRect.top : storyRect.height}px`
  width = host.value.clientWidth
  height = host.value.clientHeight
  viewportHeight = Math.min(window.innerHeight, height)
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.value.width = Math.round(width * ratio)
  canvas.value.height = Math.round(viewportHeight * ratio)
  canvas.value.style.height = `${viewportHeight}px`
  canvas.value.getContext('2d')?.setTransform(ratio, 0, 0, ratio, 0, 0)
  storyHeight = storyRect.height
  storyTop = storyRect.top + window.scrollY
  const hero = story.querySelector<HTMLElement>('.hero_intro')?.getBoundingClientRect()
  // Enter below the preview rather than spending the first scroll hidden behind it.
  entryY = hero ? Math.min(hero.bottom - storyRect.top + 32, window.innerHeight * .72) : window.innerHeight * .6
  buildTrack()
  textBounds = Array.from(story.querySelectorAll<HTMLElement>('.home_feature_copy, .hero_copy')).map(element => {
    const rect = element.getBoundingClientRect()
    return { left: rect.left - storyRect.left, right: rect.right - storyRect.left, top: rect.top - storyRect.top, bottom: rect.bottom - storyRect.top }
  })
  schedule()
}

function buildTrack() {
  track = []
  const mobile = width < 701
  const amplitude = mobile ? width * .43 : Math.min(width * .42, 570)
  const centerX = width / 2
  const endY = height - 100
  const span = Math.max(1, endY - entryY)
  const turns = 2.5
  let distance = 0
  for (let index = 0; index <= 2400; index++) {
    const t = index / 2400
    const angle = t * Math.PI * 2 * turns
    const depth = Math.sin(angle)
    let x = centerX + Math.cos(angle) * amplitude
    // An open descending helix: each revolution ends lower than it began.
    let y = entryY + t * span - depth * Math.min(150, span / 22)
    let z = depth * (mobile ? 80 : 260)
    if (t < .07) {
      const blend = (1 - t / .07) ** 2
      x += (width + 90 - (centerX + amplitude)) * blend
      z -= 200 * blend
    }
    if (t > .9) {
      const blend = ((t - .9) / .1) ** 2
      x = x * (1 - blend) + (width + 130) * blend
      y = y * (1 - blend) + endY * blend
      z *= 1 - blend
    }
    const previous = track.at(-1)
    if (previous) distance += Math.hypot(x - previous.x, y - previous.y, z - previous.z)
    track.push({ x, y, z, distance })
  }
  trackLength = distance
  const firstVisible = track.find(point => {
    const perspective = 1600 / (1600 - point.z)
    return width / 2 + (point.x - width / 2) * perspective <= width - 80
  })
  entryHeadDistance = (firstVisible?.distance ?? 0) + (mobile ? 99 : 198)
}

function pointAt(distance: number): Point | undefined {
  // Outside the finite path, cubes have not entered or have already exited.
  if (distance < 0 || distance > trackLength || !track.length) return
  let low = 0
  let high = track.length - 1
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (track[middle]!.distance < distance) low = middle + 1
    else high = middle
  }
  const end = track[low]!
  const start = track[Math.max(0, low - 1)]!
  const t = (distance - start.distance) / (end.distance - start.distance || 1)
  return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t, z: start.z + (end.z - start.z) * t }
}

function draw(now: number) {
  frame = 0
  if (!host.value || !canvas.value || !width || !visible) { lastTime = 0; return }
  const context = canvas.value.getContext('2d')
  if (!context) return
  const offset = Math.max(0, Math.min(height - viewportHeight, -host.value.getBoundingClientRect().top))
  canvas.value.style.transform = `translateY(${offset}px)`
  context.clearRect(0, 0, width, viewportHeight)
  const elapsed = Math.min(50, lastTime ? now - lastTime : 16)
  lastTime = now
  const target = props.reducedMotion ? .35 : props.progress
  phase = props.reducedMotion ? target : phase + (target - phase) * (1 - Math.exp(-elapsed / 160))
  if (!props.reducedMotion) clock += elapsed / 1000
  const mobile = width < 701
  const spacing = mobile ? cubeSpacing * .5 : cubeSpacing
  const bodyLength = (cubeCount - 1) * spacing
  // Start after the first scroll; finish to the right of the final introduction.
  const entryProgress = (window.innerHeight * .5 - storyTop + 12) / storyHeight
  const exitProgress = (height - window.innerHeight * .12) / storyHeight
  const travel = Math.max(0, Math.min(1, (phase - entryProgress) / Math.max(.01, exitProgress - entryProgress)))
  if (travel <= 0 || travel >= 1) {
    if (!props.reducedMotion && Math.abs(target - phase) > .00001) schedule()
    else lastTime = 0
    return
  }
  const entranceOpacity = Math.min(1, Math.max(0, (phase - entryProgress) * storyHeight / 60))
  const head = entryHeadDistance + travel * (trackLength + bodyLength - entryHeadDistance)
  const cubes: { point: Point; index: number; size: number; opacity: number }[] = []
  for (let index = 0; index < cubeCount; index++) {
    const point = pointAt(head - index * spacing)
    if (!point) continue
    const perspective = 1600 / (1600 - point.z)
    const front = Math.max(0, Math.min(1, (point.z / (mobile ? 80 : 260) + 1) / 2))
    const x = width / 2 + (point.x - width / 2) * perspective
    const y = point.y
    // Fade softly behind copy so orbiting cubes never compete with the words.
    let clearance = 1
    for (const bounds of textBounds) {
      const distance = Math.hypot(Math.max(bounds.left - x, 0, x - bounds.right), Math.max(bounds.top - y, 0, y - bounds.bottom))
      clearance = Math.min(clearance, Math.min(1, distance / 40))
    }
    cubes.push({ point: { x, y: y - offset, z: point.z }, index, size: (mobile ? 8 : 16) * perspective, opacity: (.1 + front * .85) * (.08 + clearance * .92) })
  }
  cubes.sort((a, b) => a.point.z - b.point.z)
  for (const cube of cubes) {
    if (cube.point.y < -60 || cube.point.y > viewportHeight + 60) continue
    const spin = clock * .45
    const points = corners.map(point => {
      const rotated = rotate(point, spin + cube.index * .71, spin * .63 + cube.index * 1.17, spin * .38 + cube.index * .47)
      return { x: cube.point.x + rotated.x * cube.size, y: cube.point.y + rotated.y * cube.size, z: rotated.z }
    })
    const ordered = faces.map((indices, index) => ({ indices, index, depth: indices.reduce((sum, i) => sum + points[i]!.z, 0) / 4 })).sort((a, b) => a.depth - b.depth)
    // Composite the entire opaque cube once, so its back faces never bleed through.
    context.globalAlpha = entranceOpacity
    for (const face of ordered) {
      context.beginPath()
      face.indices.forEach((index, i) => {
        const point = points[index]!
        if (i === 0) context.moveTo(point.x, point.y)
        else context.lineTo(point.x, point.y)
      })
      context.closePath()
      context.fillStyle = faceColor(face.depth, cube.opacity)
      context.fill()
      context.strokeStyle = context.fillStyle
      context.lineWidth = .6
      context.stroke()
      const texture = brandTextures[cube.index]
      if (texture && face.depth > .12) {
        // Map the sticker into the face's local axes so it rotates and foreshortens.
        const origin = points[face.indices[0]!]!
        const right = points[face.indices[3]!]!
        const bottom = points[face.indices[1]!]!
        context.save()
        context.transform(
          (right.x - origin.x) / 128, (right.y - origin.y) / 128,
          (bottom.x - origin.x) / 128, (bottom.y - origin.y) / 128,
          origin.x, origin.y,
        )
        context.globalAlpha = entranceOpacity * cube.opacity * (.72 + face.depth * .28)
        context.drawImage(texture, 10, 10, 108, 108)
        context.restore()
      }
    }
  }
  context.globalAlpha = 1
  if (!props.reducedMotion) schedule()
  else lastTime = 0
}

function schedule() { if (!frame) frame = requestAnimationFrame(draw) }
watch(() => [props.progress, props.reducedMotion], schedule)
onMounted(() => {
  void createCubeBrandTextures().then(textures => {
    if (disposed) return
    brandTextures = textures
    schedule()
  }).catch(() => {
    // Geometry remains available even if the browser cannot decode a sticker.
  })
  observer = new ResizeObserver(measure)
  if (host.value?.parentElement) observer.observe(host.value.parentElement)
  intersection = new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? false
    if (visible) schedule()
    else { cancelAnimationFrame(frame); frame = 0; lastTime = 0 }
  })
  if (host.value) intersection.observe(host.value)
  window.addEventListener('resize', measure)
  window.addEventListener('scroll', schedule, { passive: true })
  measure()
})
onUnmounted(() => {
  disposed = true
  brandTextures = []
  cancelAnimationFrame(frame)
  observer?.disconnect()
  intersection?.disconnect()
  window.removeEventListener('resize', measure)
  window.removeEventListener('scroll', schedule)
})
</script>

<template>
  <div ref="host" class="home_orbit" aria-hidden="true"><canvas ref="canvas" /></div>
</template>
