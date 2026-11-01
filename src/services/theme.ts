import { readonly, ref } from 'vue'

export type Theme = 'dark' | 'light'
export const themeStorageKey = 'nexbuild-theme'
const activeTheme = ref<Theme>(typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
export const currentTheme = readonly(activeTheme)
export function setTheme(theme: Theme) {
  activeTheme.value = theme
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  try { localStorage.setItem(themeStorageKey, theme) } catch { /* Private/restricted storage still supports the active session. */ }
  window.dispatchEvent(new Event('nexbuild-theme-change'))
}
export function initializeTheme() {
  let theme: Theme = 'dark'
  try { if (localStorage.getItem(themeStorageKey) === 'light') theme = 'light' } catch { /* Keep the default dark appearance. */ }
  setTheme(theme)
}
