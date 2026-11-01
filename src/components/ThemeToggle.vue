<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { currentTheme, setTheme, themeStorageKey } from '../services/theme'
const light = computed(() => currentTheme.value === 'light')
const changing = ref(false)
async function toggle(event: MouseEvent) {
  if (changing.value) return
  const next = light.value ? 'dark' : 'light'
  if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setTheme(next)
    return
  }
  const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect()
  const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  changing.value = true
  try {
    const transition = document.startViewTransition(async () => { setTheme(next); await nextTick() })
    await transition.ready
    await document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] }, {
      duration: 480, easing: 'cubic-bezier(.2,.7,.2,1)', pseudoElement: '::view-transition-new(root)',
    }).finished
    await transition.finished
  } catch { setTheme(next) } finally { changing.value = false }
}
function syncTheme(event: StorageEvent) {
  if (event.key === themeStorageKey) setTheme(event.newValue === 'light' ? 'light' : 'dark')
}
onMounted(() => window.addEventListener('storage', syncTheme))
onUnmounted(() => window.removeEventListener('storage', syncTheme))
</script>

<template>
  <button class="theme-toggle" :class="{ 'is-light': light }" type="button" role="switch" :aria-checked="light"
    aria-label="亮色模式" :title="light ? '切换暗色模式' : '切换亮色模式'" :aria-busy="changing" @click="toggle">
    <span class="theme-icon" aria-hidden="true">
      <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="3.75"/><path d="M12 2.5v2m0 15v2M2.5 12h2m15 0h2M5.3 5.3l1.4 1.4m10.6 10.6 1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>
      <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.1 14.3A8.3 8.3 0 0 1 9.7 3.9a8.3 8.3 0 1 0 10.4 10.4Z"/></svg>
    </span>
    <span class="sr-only">{{ light ? '当前为亮色，点击切换暗色' : '当前为暗色，点击切换亮色' }}</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  position: relative;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid light-dark(#d3d8df, #343434);
  border-radius: 0;
  background: light-dark(#f8f9fa, #141414);
  color: light-dark(#56606c, #bfc3c9);
  cursor: pointer;
  transition: background .2s ease, border-color .2s ease, color .2s ease, transform .18s ease;
}
.theme-toggle:hover {
  background: light-dark(#ffffff, #202020);
  border-color: light-dark(#aeb7c2, #575757);
  color: light-dark(#283340, #eeeeee);
}
.theme-toggle:active { transform: scale(.95); }
.theme-toggle:focus-visible { outline: 2px solid light-dark(#64748b, #a3aab4); outline-offset: 4px; }
.theme-icon { position: relative; width: 21px; height: 21px; }
.theme-icon svg { position: absolute; inset: 0; width: 100%; height: 100%; transition: opacity .22s ease, transform .3s ease; }
.sun { opacity: 0; transform: rotate(-45deg) scale(.65); }
.moon { opacity: 1; transform: rotate(0) scale(1); }
.is-light .sun { opacity: 1; transform: rotate(0) scale(1); }
.is-light .moon { opacity: 0; transform: rotate(35deg) scale(.65); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { .theme-toggle, .theme-toggle * { transition: none; } }
</style>
