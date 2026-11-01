<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ modelValue: number | string }>()
const emit = defineEmits<{
  'update:modelValue': [value: number]
  change: []
}>()
const progress = computed(() => Math.max(0, Math.min(1, (Number(props.modelValue) - 3000) / 27000)) || 0)
const stars = Array.from({ length: 40 }, (_, index) => ({
  left: `${5 + (index * 37 % 90)}%`,
  top: `${22 + (index * 23 % 56)}%`,
  '--star-size': `${index % 5 === 0 ? 3.5 : index % 3 === 0 ? 2.5 : 1.8}px`,
  '--star-drift': `${(index % 5 - 2) * 6}px`,
  '--star-rise': `${18 + index % 5 * 5}px`,
  animationDelay: `${index * -0.19}s`,
  animationDuration: `${1.2 + (index % 7) * 0.15}s`,
}))
</script>

<template>
  <div class="budget-slider" :class="{ 'is-high': progress >= 0.8, 'is-full': progress === 1 }">
    <div class="budget-slider-track" aria-hidden="true">
      <div class="budget-slider-fill" :style="{
        width: `calc(7px + (100% - 14px) * ${progress})`,
        '--color-mix': progress * progress * (3 - 2 * progress),
      }">
        <span v-for="(star, index) in stars" :key="index" class="budget-slider-star" :style="star" />
      </div>
    </div>
    <input
      :value="modelValue"
      type="range"
      min="3000"
      max="30000"
      step="100"
      aria-label="调整整机预算"
      :aria-valuetext="`${Number(modelValue).toLocaleString('zh-CN')} 元`"
      @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
      @change="emit('change')"
    />
  </div>
</template>

<style scoped>
.budget-slider {
  position: relative;
  height: 24px;
  margin-top: 12px;
  --slider-track: light-dark(#b3bfd0, #24252a);
  --slider-blue: light-dark(#00658f, #32b9dc);
  --slider-indigo: light-dark(#343cc4, #6488f0);
  --slider-purple: light-dark(#791fb6, #b47bed);
  --slider-thumb: light-dark(#ffffff, #e0edf5);
  --slider-thumb-ring: light-dark(#343cc4, #ffffff24);
  --slider-thumb-ring-size: 1.5px;
  --slider-star-scale: 1;
}
.budget-slider:where(:root[data-theme='light'] *) {
  --slider-thumb-ring-size: 2.5px;
  --slider-star-scale: 1.35;
}
.budget-slider-track {
  position: absolute;
  inset: 8px 0;
  border-radius: 999px;
  background: var(--slider-track);
  box-shadow: inset 0 1px 2px #0003;
}
.budget-slider-fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: inherit;
  background: var(--slider-blue);
  transition: box-shadow 400ms ease;
}
.budget-slider-fill::before,
.budget-slider-fill::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}
.budget-slider-fill::before {
  background: linear-gradient(90deg, var(--slider-blue) 0%, var(--slider-indigo) 50%, var(--slider-purple) 100%);
  opacity: var(--color-mix);
  transition: opacity 180ms ease-out;
}
.budget-slider-fill::after {
  background: linear-gradient(100deg, var(--slider-blue) 0%, var(--slider-indigo) 20%, var(--slider-purple) 40%, var(--slider-indigo) 60%, var(--slider-blue) 80%, var(--slider-indigo) 100%);
  background-size: 250% 100%;
  animation: budget-color-wave 4s ease-in-out infinite alternate;
  opacity: 0;
  transition: opacity 500ms ease;
}
.is-full .budget-slider-fill::after {
  opacity: 1;
}
.is-full .budget-slider-fill {
  box-shadow: 0 0 9px #6488f038;
}
@keyframes budget-color-wave {
  from { background-position: 0% 50%; }
  to { background-position: 100% 50%; }
}
.budget-slider input {
  position: absolute;
  inset: 0;
  appearance: none;
  width: 100%;
  height: 24px;
  padding: 0;
  margin: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
}
.budget-slider input::-webkit-slider-runnable-track {
  height: 14px;
  background: transparent;
}
.budget-slider input::-moz-range-track,
.budget-slider input::-moz-range-progress {
  height: 14px;
  background: transparent;
}
.budget-slider input::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border: 0;
  border-radius: 50%;
  background: var(--slider-thumb);
  box-shadow: 0 1px 4px #0005, 0 0 0 var(--slider-thumb-ring-size) var(--slider-thumb-ring);
}
.budget-slider input::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: 0;
  border-radius: 50%;
  background: var(--slider-thumb);
  box-shadow: 0 1px 4px #0005, 0 0 0 var(--slider-thumb-ring-size) var(--slider-thumb-ring);
}
.budget-slider input:focus-visible {
  outline: 2px solid var(--slider-indigo);
  outline-offset: 5px;
}
.budget-slider-star {
  display: none;
  position: absolute;
  z-index: 1;
  width: var(--star-size);
  height: var(--star-size);
  border-radius: 50%;
  background: light-dark(#50149d, #e4f4ff);
  scale: var(--slider-star-scale);
  box-shadow: 0 0 0 0.75px light-dark(#ffffffdd, transparent), 0 0 3px light-dark(#ffffffcc, #b7e8ff99), 0 0 6px light-dark(#6523b580, #a47bed66);
  pointer-events: none;
}
.is-high .budget-slider-star {
  display: block;
  animation: budget-star-twinkle 2s ease-out infinite;
}
.budget-slider:not(.is-full) .budget-slider-star:nth-child(n + 21) {
  display: none;
}
.is-full .budget-slider-star:nth-child(5n) {
  border-radius: 0;
  clip-path: polygon(50% 0, 62% 36%, 100% 50%, 62% 64%, 50% 100%, 38% 64%, 0 50%, 38% 36%);
  width: 6px;
  height: 6px;
}
@keyframes budget-star-twinkle {
  0% { opacity: 0; transform: translate(0, 2px) scale(0.5); }
  20% { opacity: 1; }
  55% { opacity: 0.85; }
  100% { opacity: 0; transform: translate(var(--star-drift), calc(-1 * var(--star-rise))) scale(0.4); }
}
@media (prefers-reduced-motion: reduce) {
  .budget-slider-fill { transition: none; }
  .budget-slider-fill::before,
  .budget-slider-fill::after { animation: none; transition: none; }
  .is-high .budget-slider-star { animation: none; opacity: 0.45; }
}
</style>
