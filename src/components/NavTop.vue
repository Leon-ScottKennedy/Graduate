<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ThemeToggle from './ThemeToggle.vue'
import LoginDialog from './LoginDialog.vue'
import { accountUser, refreshAccount, logoutAccount } from '../services/account'
const accountError = ref('')
async function signOut() {
  try { await logoutAccount(); menuOpen.value = false; accountError.value = '' }
  catch { accountError.value = '退出失败，请重试' }
}

const links = [
  { path: '/', label: '首页' },
  { path: '/smart-build', label: '智能装机' },
  { path: '/config-plan', label: '配置方案' },
]
const route = useRoute()
const menuOpen = ref(false)
const loginOpen = ref(false)
const header = ref<HTMLElement | null>(null)
const menuButton = ref<HTMLButtonElement | null>(null)
const loginButton = ref<HTMLButtonElement | null>(null)
function closeMenu(event: PointerEvent) {
  if (!header.value?.contains(event.target as Node)) menuOpen.value = false
}
function keyboard(event: KeyboardEvent) {
  if (event.key === 'Escape' && menuOpen.value) {
    menuOpen.value = false
    menuButton.value?.focus()
  }
}
async function openMenu(event: KeyboardEvent) {
  if (event.key !== 'ArrowDown') return
  event.preventDefault()
  menuOpen.value = true
  await nextTick()
  header.value?.querySelector<HTMLAnchorElement>('.site-links a')?.focus()
}
async function closeLogin() {
  loginOpen.value = false
  await nextTick()
  loginButton.value?.focus()
}
watch(() => route.fullPath, () => { menuOpen.value = false })
onMounted(() => {
  void refreshAccount()
  document.addEventListener('pointerdown', closeMenu)
  document.addEventListener('keydown', keyboard)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', closeMenu)
  document.removeEventListener('keydown', keyboard)
})
</script>

<template>
  <header ref="header" class="site-header">
    <div class="site-bar">
      <router-link to="/" class="site-brand" aria-label="NEXBUILD 首页">
        <svg class="brand-pixel" viewBox="0 0 28 28" fill="none" aria-hidden="true" shape-rendering="crispEdges"><path d="M4 4h8v4h4v4h4V4h4v20h-8v-4h-4v-4H8v8H4V4Z" fill="currentColor"/></svg>
        <span>NEXBUILD<small>你的装机工作台</small></span>
      </router-link>
      <div class="site-actions">
        <ThemeToggle />
        <span class="action-divider" aria-hidden="true"></span>
        <button v-if="!accountUser" ref="loginButton" class="login-trigger" type="button" aria-haspopup="dialog" @click="loginOpen = true; menuOpen = false">
          登录
        </button>
        <router-link v-else to="/config-plan?tab=mine" class="account-name"
          :class="{ 'is-active': route.path === '/config-plan' && route.query.tab === 'mine' }"
          :title="`${accountUser.email} · 我的配置`" :aria-label="`${accountUser.email.split('@')[0]}，查看我的配置`" @click="menuOpen = false">
          <span class="account-status" aria-hidden="true"></span>
          <span class="account-label">{{ accountUser.email.split('@')[0] }}</span>
          <svg class="account-arrow" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" shape-rendering="crispEdges"><path d="M4 2h2v2h2v4H6v2H4V8h2V4H4V2Z"/></svg>
        </router-link>
        <button ref="menuButton" class="mobile-menu" type="button" :aria-expanded="menuOpen" aria-controls="main-site-links" :aria-label="menuOpen ? '关闭导航菜单' : '打开导航菜单'" @click="menuOpen = !menuOpen" @keydown="openMenu">
          <span class="hamburger-lines" :class="{ 'is-open': menuOpen }" aria-hidden="true"><i></i><i></i><i></i></span>
        </button>
        <Transition name="menu-pop">
          <nav v-if="menuOpen" id="main-site-links" class="site-links" aria-label="主导航" :inert="!menuOpen">
            <router-link v-for="(link, index) in links" :key="link.path" :style="{ '--item-index': index + 1 }" :to="link.path" :class="{ active: route.path === link.path }" :aria-current="route.path === link.path ? 'page' : undefined" @click="menuOpen = false">{{ link.label }}<span v-if="route.path === link.path" class="current-mark" aria-hidden="true"></span></router-link>
            <button v-if="accountUser" type="button" class="logout-button" @click="signOut">退出登录</button>
            <p v-if="accountError" role="alert">{{ accountError }}</p>
          </nav>
        </Transition>
      </div>
    </div>
    <LoginDialog v-if="loginOpen" @close="closeLogin" />
  </header>
</template>

<style scoped>
.site-header { position: sticky; top: 0; z-index: 60; flex-shrink: 0; border: 0; background: transparent; color: light-dark(#202733, #ededed); pointer-events: none; }
.site-bar { box-sizing: border-box; height: 80px; width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 0 32px; }
.site-brand, .site-actions { pointer-events: auto; }
.site-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: inherit; flex-shrink: 0; }
.brand-pixel { width: 30px; height: 30px; }
.site-brand > span { font-size: 16px; font-weight: 750; letter-spacing: 2px; line-height: 1.35; }
.site-brand small { display: block; margin-top: 3px; font-size: 10px; font-weight: 400; letter-spacing: 1px; color: light-dark(#737b88, #858585); }
.site-links { position: absolute; top: calc(100% + 18px); right: 0; display: grid; width: min(220px, calc(100vw - 32px)); padding: 10px; border: 1px solid light-dark(#b7bfc9, #505050); background: light-dark(#fafbfc, #131313); box-shadow: 4px 4px 0 light-dark(#d5d9df, #030303), 0 16px 40px #0002; transform-origin: top right; }
.site-links a { position: relative; display: flex; align-items: center; justify-content: space-between; min-height: 44px; padding: 0 12px; text-decoration: none; white-space: nowrap; font-size: 14px; color: light-dark(#667080, #989898); transition: color 150ms, background 150ms; }
.site-links a:hover, .site-links a.active { color: light-dark(#202733, #ffffff); }
.site-links a:hover, .site-links a.active { background: light-dark(#e6e9ed, #262626); }
.site-links a.active { font-weight: 650; }
.current-mark { width: 5px; height: 5px; background: currentColor; }
.site-actions { position: relative; display: flex; align-items: center; gap: 16px; margin-left: auto; min-width: 0; }
.account-name {
  --account-cut: polygon(3px 0,calc(100% - 3px) 0,calc(100% - 3px) 3px,100% 3px,100% calc(100% - 3px),calc(100% - 3px) calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,3px calc(100% - 3px),0 calc(100% - 3px),0 3px,3px 3px);
  position: relative; isolation: isolate; display: inline-flex; align-items: center; gap: 9px;
  height: 36px; min-width: 0; max-width: 184px; padding: 0 12px;
  clip-path: var(--account-cut); background: light-dark(#aab5c3,#4b4e55); color: light-dark(#293444,#e8ecf2);
  text-decoration: none; font-size: 13px; font-weight: 600; line-height: 1;
  transition: background-color 160ms ease,color 160ms ease;
}
.account-name::before { content: ''; position: absolute; inset: 1px; z-index: -1; clip-path: inherit;
  background: light-dark(#f1f4f8,#090909); box-shadow: inset 0 -2px 0 light-dark(#dce2ea,#030303);
  transition: background-color 160ms ease; }
.account-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: .2px; font-variant-numeric: tabular-nums; }
.account-status { width: 5px; height: 5px; flex: 0 0 5px; background: light-dark(#43836b,#9cc5b1); }
.account-arrow { width: 12px; height: 12px; flex: 0 0 12px; color: light-dark(#718095,#8d98a8); transition: transform 160ms ease,color 160ms ease; }
.account-name:hover, .account-name.is-active { background: light-dark(#6d7d92,#939eae); color: light-dark(#172333,#ffffff); }
.account-name:hover::before, .account-name.is-active::before { background: light-dark(#e3eaf3,#171717); }
.account-name:hover .account-arrow { transform: translateX(2px); color: inherit; }
.account-name:active { translate: 0 1px; }
.account-name:focus-visible { outline-offset: -4px; }
.site-actions :deep(.theme-toggle), .mobile-menu { flex-shrink: 0; }
.logout-button { min-height: 40px; padding: 0 12px; border: 0; border-top: 1px solid light-dark(#d9dde3, #333333); background: transparent; color: inherit; text-align: left; font-size: 13px; }
.action-divider { height: 20px; width: 1px; background: light-dark(#d9dde3, #343434); }
button { font: inherit; cursor: pointer; }
.login-trigger { display: flex; align-items: center; justify-content: center; gap: 9px; height: 36px; min-width: 88px; padding: 0 16px; border: 0; background: light-dark(#272d36, #e4e4e4); color: light-dark(#ffffff, #111111); font-size: 13px; font-weight: 650; clip-path: polygon(4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px), 0 4px, 4px 4px); }
.login-trigger { position: relative; isolation: isolate; background: light-dark(#939daa, #e4e4e4); color: light-dark(#293341, #111111); }
.login-trigger::before { content: ''; position: absolute; inset: 1px; z-index: -1; background: light-dark(#edf0f4, #e4e4e4); clip-path: inherit; box-shadow: inset 0 1px 0 light-dark(#ffffff, transparent), inset 0 -2px 0 light-dark(#d5dae2, transparent); pointer-events: none; transition: background-color 150ms ease; }
.login-trigger:hover { background: light-dark(#657386, #ffffff); }
.login-trigger:hover::before { background: light-dark(#dfe5ec, #ffffff); }
.login-trigger:active { transform: translateY(2px); }
a:focus-visible, button:focus-visible { outline: 2px solid light-dark(#546174, #d1d1d1); outline-offset: 4px; }
.login-trigger:focus-visible { outline-offset: -4px; }
.mobile-menu { display: grid; place-items: center; border: 1px solid light-dark(#c9ced6, #444444); color: inherit; background: transparent; width: 36px; height: 36px; }
.mobile-menu:hover, .mobile-menu[aria-expanded='true'] { background: light-dark(#e6e9ed, #262626); border-color: light-dark(#939eac, #777777); }
.hamburger-lines { position: relative; display: block; width: 18px; height: 18px; }
.hamburger-lines i { position: absolute; left: 0; display: block; width: 18px; height: 2px; background: currentColor; transform-origin: center; transition: transform 280ms cubic-bezier(.2,.8,.2,1), opacity 180ms ease; }
.hamburger-lines i:nth-child(1) { top: 3px; }
.hamburger-lines i:nth-child(2) { top: 8px; }
.hamburger-lines i:nth-child(3) { top: 13px; }
.hamburger-lines.is-open i:nth-child(1) { transform: translateY(5px) rotate(45deg); }
.hamburger-lines.is-open i:nth-child(2) { opacity: 0; transform: scaleX(.3); }
.hamburger-lines.is-open i:nth-child(3) { transform: translateY(-5px) rotate(-45deg); }
.menu-pop-enter-active { transition: opacity .2s ease, transform .72s cubic-bezier(.2,.8,.2,1); }
.menu-pop-leave-active { transition: opacity .18s ease .43s, transform .22s ease .43s; pointer-events: none; }
.menu-pop-enter-from, .menu-pop-leave-to { opacity: 0; transform: translateY(-10px) scale(.94); }
.menu-pop-enter-active > a {
  transition: opacity .28s ease, transform .36s cubic-bezier(.2,.8,.2,1), filter .28s ease;
  transition-delay: calc(100ms + var(--item-index) * 65ms);
}
.menu-pop-leave-active > a {
  transition: opacity .18s ease, transform .22s ease, filter .18s ease;
  transition-delay: calc((5 - var(--item-index)) * 55ms);
}
.menu-pop-enter-from > a, .menu-pop-leave-to > a {
  opacity: 0;
  transform: translateY(-10px);
  filter: blur(3px);
}
@media (max-width: 700px) {
  .site-bar { height: 64px; width: 100%; padding-inline: 16px; gap: 12px; justify-content: space-between; }
  .site-brand > span { font-size: 13px; letter-spacing: 1px; }
  .site-brand small { display: none; }
  .brand-pixel { width: 24px; height: 24px; }
  .site-actions { gap: 10px; }
  .action-divider { display: none; }
  .login-trigger { min-width: 60px; padding: 0 10px; }
  .account-name { max-width: 140px; gap: 6px; padding-inline: 9px; font-size: 12px; }
  .site-links { top: calc(100% + 14px); }
}
@media (prefers-reduced-motion: reduce) {
  .account-name, .account-name::before, .account-arrow,
  .login-trigger::before, .hamburger-lines i, .site-links a, .menu-pop-enter-active, .menu-pop-leave-active,
  .menu-pop-enter-active > a, .menu-pop-leave-active > a { transition: none; }
}
</style>
