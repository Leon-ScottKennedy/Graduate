import { onMounted, onUnmounted, ref, type Ref } from 'vue'

export function useScrollProgress(target: Ref<HTMLElement | null>) {
  const progress = ref(0)
  const reducedMotion = ref(false)
  let frame = 0
  let observer: ResizeObserver | undefined
  let preference: MediaQueryList | undefined

  function update() {
    frame = 0
    const element = target.value
    if (!element) return
    const rect = element.getBoundingClientRect()
    const anchor = window.innerHeight * 0.5
    progress.value = Math.max(0, Math.min(1, (anchor - rect.top) / rect.height))
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update)
  }

  function updatePreference() {
    reducedMotion.value = preference?.matches ?? false
  }

  onMounted(() => {
    preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    updatePreference()
    preference.addEventListener('change', updatePreference)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    observer = new ResizeObserver(schedule)
    if (target.value) observer.observe(target.value)
    update()
  })

  onUnmounted(() => {
    cancelAnimationFrame(frame)
    observer?.disconnect()
    preference?.removeEventListener('change', updatePreference)
    window.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
  })

  return { progress, reducedMotion }
}
