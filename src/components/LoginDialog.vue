<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, useId } from 'vue'
import { authenticate, sendRegistrationCode } from '../services/account'
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()
const emailId = useId()
const passwordId = useId()
const confirmationId = useId()
const mode = ref<'login' | 'register'>('login')
const passwordVisible = ref(false)
const closing = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | undefined
function finishClose() {
  clearTimeout(closeTimer)
  emit('close')
}
function requestClose() {
  if (closing.value) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finishClose(); return }
  if (dialog.value) {
    const current = getComputedStyle(dialog.value)
    dialog.value.style.setProperty('--close-transform', current.transform)
    dialog.value.style.setProperty('--close-opacity', current.opacity)
  }
  closing.value = true
  closeTimer = setTimeout(finishClose, 360)
}
function handleAnimationEnd(event: AnimationEvent) {
  if (closing.value && event.target === dialog.value && event.animationName === 'account-dialog-exit') finishClose()
}
const email = ref('')
const password = ref('')
const confirmation = ref('')
const code = ref('')
const codeId = useId()
const busy = ref(false)
const sending = ref(false)
const error = ref('')
const message = ref('')
const cooldown = ref(0)
let resendAt = 0
const cooldownTimer = setInterval(() => { cooldown.value = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)) }, 500)
async function sendCode() {
  if (sending.value || cooldown.value) return
  error.value = ''; message.value = ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { error.value = '请先填写有效邮箱地址'; return }
  sending.value = true
  try {
    const result = await sendRegistrationCode(email.value.trim())
    resendAt = Date.now() + result.retryAfter * 1000
    cooldown.value = result.retryAfter
    message.value = result.message
  } catch (issue) { error.value = issue instanceof Error ? issue.message : '发送失败，请稍后重试' }
  finally { sending.value = false }
}
async function submit() {
  if (busy.value) return
  error.value = ''; message.value = ''
  if (mode.value === 'register' && password.value !== confirmation.value) { error.value = '两次输入的密码不一致'; return }
  busy.value = true
  try {
    await authenticate(email.value.trim(), password.value, mode.value === 'register' ? code.value : undefined)
    password.value = ''; confirmation.value = ''; code.value = ''
    requestClose()
  } catch (issue) { error.value = issue instanceof Error ? issue.message : '操作失败，请稍后重试' }
  finally { busy.value = false }
}
async function switchMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  passwordVisible.value = false
  password.value = ''; confirmation.value = ''; code.value = ''; error.value = ''; message.value = ''
  await nextTick()
  document.getElementById(emailId)?.focus()
}
let previousOverflow = ''
onMounted(() => {
  previousOverflow = document.body.style.overflow
  dialog.value?.showModal()
  document.body.style.overflow = 'hidden'
})
onUnmounted(() => {
  clearTimeout(closeTimer)
  clearInterval(cooldownTimer)
  dialog.value?.close()
  document.body.style.overflow = previousOverflow
})
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="login-dialog" :class="{ 'is-closing': closing }" :aria-labelledby="titleId" @animationend="handleAnimationEnd" @cancel.prevent="requestClose" @click="($event.target === dialog) && requestClose()">
      <button class="login-close" type="button" aria-label="关闭账号窗口" @click="requestClose">×</button>
      <div class="login-emblem" aria-hidden="true"><svg viewBox="0 0 28 28" fill="currentColor" shape-rendering="crispEdges"><path d="M4 4h8v4h4v4h4V4h4v20h-8v-4h-4v-4H8v8H4V4Z"/></svg></div>
      <p class="login-eyebrow">NEXBUILD ACCOUNT</p>
      <h2 :id="titleId">{{ mode === 'login' ? '欢迎回来' : '创建账号' }}</h2>
      <p class="login-subtitle">{{ mode === 'login' ? '登录你的装机工作台' : '开启你的专属装机工作台' }}</p>
      <form :key="mode" @submit.prevent="submit">
        <label :for="emailId">邮箱</label>
        <input :id="emailId" v-model="email" type="email" autocomplete="username" placeholder="输入邮箱地址" maxlength="254" required autofocus :disabled="busy || sending" />
        <template v-if="mode === 'register'">
          <label :for="codeId">邮箱验证码</label>
          <div class="code-field"><input :id="codeId" v-model="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="6 位验证码" required :disabled="busy" /><button type="button" :disabled="busy || sending || cooldown > 0" @click="sendCode">{{ sending ? '发送中…' : cooldown > 0 ? `${cooldown}s 后重发` : '发送验证码' }}</button></div>
        </template>
        <label :for="passwordId">密码</label>
        <div class="password-field">
          <input :id="passwordId" v-model="password" :type="passwordVisible ? 'text' : 'password'" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" placeholder="8–128 位密码" minlength="8" maxlength="128" required :disabled="busy" />
          <button type="button" :aria-label="passwordVisible ? '隐藏密码' : '显示密码'" :title="passwordVisible ? '隐藏密码' : '显示密码'" :aria-pressed="passwordVisible" @click="passwordVisible = !passwordVisible">
            <svg class="password-eye" :class="{ 'is-open': passwordVisible }" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <g class="eye-open"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></g>
              <g class="eye-closed"><path d="M3 9c2 4 5 6 9 6s7-2 9-6M5 12l-2 3m6-1-1 4m7-4 1 4m3-6 2 3"/></g>
            </svg>
          </button>
        </div>
        <template v-if="mode === 'register'">
          <label :for="confirmationId">确认密码</label>
          <input :id="confirmationId" v-model="confirmation" :type="passwordVisible ? 'text' : 'password'" autocomplete="new-password" placeholder="再次输入密码" minlength="8" maxlength="128" required :disabled="busy" />
        </template>
        <p v-if="error" class="account-error" role="alert">{{ error }}</p>
        <p v-if="message" class="login-status" role="status">{{ message }}</p>
        <button type="submit" class="login-submit" :disabled="busy || sending">{{ busy ? '处理中…' : mode === 'login' ? '登录' : '注册并登录' }}</button>
        <p class="login-status">{{ mode === 'login' ? '登录后可保存和查看个人配置。' : '验证码 5 分钟有效，注册成功后自动登录。' }}</p>
      </form>
      <div class="account-switch"><span>{{ mode === 'login' ? '还没有账号？' : '已有账号？' }}</span><button type="button" :disabled="busy || sending" @click="switchMode">{{ mode === 'login' ? '注册账号' : '返回登录' }}</button></div>
      <button class="continue-button" type="button" @click="requestClose">继续浏览 <span aria-hidden="true">→</span></button>
    </dialog>
  </Teleport>
</template>

<style scoped>
.login-dialog { position: fixed; box-sizing: border-box; width: min(420px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow-y: auto; margin: auto; padding: 36px; border: 2px solid light-dark(#9aa2ad, #626262); border-radius: 0; background: light-dark(#ffffff, #101010); color: light-dark(#202733, #eeeeee); box-shadow: 6px 6px 0 #0003, 0 24px 100px #0005; }
.login-dialog::backdrop { background: #0008; backdrop-filter: blur(6px); }
.login-dialog[open] { animation: account-dialog-enter 460ms cubic-bezier(.22,1,.36,1) both; }
.login-dialog[open]::backdrop { animation: account-backdrop-enter 360ms ease-out both; }
.login-dialog[open].is-closing { animation: account-dialog-exit 300ms cubic-bezier(.4,0,.8,.4) both; pointer-events: none; }
.login-dialog[open].is-closing::backdrop { animation: account-backdrop-exit 300ms ease-in both; }
@keyframes account-dialog-exit {
  from { opacity: var(--close-opacity, 1); transform: var(--close-transform, translateY(0) scale(1)); }
  to { opacity: 0; transform: translateY(40px) scale(.9); }
}
@keyframes account-backdrop-exit {
  from { background: #0008; backdrop-filter: blur(6px); }
  to { background: #0000; backdrop-filter: blur(0); }
}
@keyframes account-dialog-enter {
  0% { opacity: 0; transform: translateY(40px) scale(.9); }
  70% { opacity: 1; transform: translateY(-4px) scale(1.01); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes account-backdrop-enter {
  from { background: #0000; backdrop-filter: blur(0); }
  to { background: #0008; backdrop-filter: blur(6px); }
}
@media (prefers-reduced-motion: reduce) {
  .login-dialog[open], .login-dialog[open]::backdrop, .login-dialog[open].is-closing, .login-dialog[open].is-closing::backdrop { animation: none; }
}
.login-close { position: absolute; top: 14px; right: 14px; width: 30px; height: 30px; border: 1px solid light-dark(#d0d5dc, #404040); background: transparent; color: inherit; font-size: 22px; cursor: pointer; }
.login-emblem { display: grid; place-items: center; width: 48px; height: 48px; border: 2px solid light-dark(#aab2bd, #555555); box-shadow: 3px 3px 0 light-dark(#e0e4e9, #030303); }
.login-emblem svg { width: 30px; height: 30px; }
.login-eyebrow { margin: 24px 0 10px; font-size: 10px; letter-spacing: 2px; color: light-dark(#727c8a, #888888); }
h2 { margin: 0; font-size: 26px; letter-spacing: 1px; }
.login-subtitle { margin: 10px 0 28px; color: light-dark(#687381, #999999); font-size: 13px; }
label { display: block; margin: 18px 0 8px; font-size: 13px; font-weight: 600; }
input { box-sizing: border-box; width: 100%; height: 44px; padding: 10px 12px; border: 1px solid light-dark(#bfc6d0, #454545); border-radius: 0; background: light-dark(#f7f8fa, #090909); color: inherit; font: inherit; font-size: 13px; }
input::placeholder { color: light-dark(#8a929d, #737373); }
.password-field { position: relative; }
.password-field input { padding-right: 48px; }
.password-field button { display: grid; place-items: center; width: 44px; }
.password-eye g { transform-origin: 12px 12px; transition: transform 240ms cubic-bezier(.25,.7,.25,1), opacity 160ms ease; }
.eye-open { opacity: 0; transform: scaleY(.08); }
.eye-closed { opacity: 1; transform: scaleY(1); }
.password-eye.is-open .eye-open { opacity: 1; transform: scaleY(1); }
.password-eye.is-open .eye-closed { opacity: 0; transform: scaleY(.08); }
@media (prefers-reduced-motion: reduce) { .password-eye g { transition: none; } }
.password-field button { position: absolute; top: 0; right: 0; height: 44px; padding: 0 12px; border: 0; background: transparent; color: light-dark(#606c7b, #a5a5a5); font-size: 12px; cursor: pointer; }
.login-submit { width: 100%; min-height: 44px; margin-top: 24px; border: 0; border-radius: 0; background: light-dark(#3d4653, #d2d2d2); color: light-dark(#ffffff, #171717); font: inherit; font-size: 14px; font-weight: 650; cursor: not-allowed; }
.login-status { margin: 12px 0 0; color: light-dark(#717b89, #999999); font-size: 11px; line-height: 1.8; }
.login-submit:not(:disabled) { cursor: pointer; }
.login-submit:disabled { opacity: .55; }
.code-field { display: flex; gap: 8px; }
.code-field input { min-width: 0; flex: 1; }
.code-field button { flex-shrink: 0; padding: 0 10px; border: 1px solid light-dark(#aeb7c3, #555555); background: light-dark(#edf0f4, #252525); color: inherit; font: inherit; font-size: 12px; cursor: pointer; }
.code-field button:disabled { opacity: .5; cursor: default; }
.account-error { color: light-dark(#ad3030, #ffaaaa); margin-top: 14px; font-size: 12px; line-height: 1.7; }
.account-switch { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 22px; padding-top: 18px; border-top: 1px solid light-dark(#d9dde3, #333333); font-size: 12px; color: light-dark(#717b89, #999999); }
.account-switch button { padding: 4px; border: 0; background: transparent; color: light-dark(#293341, #eeeeee); font: inherit; font-weight: 600; cursor: pointer; text-decoration: underline; text-underline-offset: 4px; }
.continue-button { display: block; margin: 24px auto 0; padding: 6px 10px; border: 0; background: transparent; color: light-dark(#4b5767, #bdbdbd); font: inherit; font-size: 12px; cursor: pointer; }
.continue-button span { margin-left: 8px; }
button:focus-visible, input:focus-visible { outline: 2px solid light-dark(#536174, #cccccc); outline-offset: 3px; }
@media (max-width: 480px) { .login-dialog { padding: 28px 24px; } }
</style>
