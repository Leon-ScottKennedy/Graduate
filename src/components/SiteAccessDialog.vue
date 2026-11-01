<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { accessOpen, accessBusy, accessError, cancelAccess, unlockAccess } from '../services/siteAccess'
const dialog = ref<HTMLDialogElement | null>(null)
const code = ref('')
watch(accessOpen, async (open) => {
  await nextTick()
  if (open && accessOpen.value) dialog.value?.showModal()
  else { dialog.value?.close(); code.value = '' }
})
async function submit() {
  const value = code.value
  code.value = ''
  await unlockAccess(value)
}
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="site-access" aria-labelledby="access-title" aria-describedby="access-description" @cancel.prevent="cancelAccess">
      <form @submit.prevent="submit">
        <h2 id="access-title">解锁在线功能</h2>
        <p id="access-description">请输入演示访问码，使用 AI 建议和商品补查。本地选配与对比可直接使用。</p>
        <label for="site-access-code">访问码</label>
        <input id="site-access-code" v-model="code" type="password" required maxlength="256" autocomplete="off" autofocus :disabled="accessBusy" />
        <p v-if="accessError" class="access-error" role="alert">{{ accessError }}</p>
        <div class="access-actions">
          <button type="button" @click="cancelAccess">暂不使用</button>
          <button type="submit" :disabled="accessBusy || !code">{{ accessBusy ? '验证中…' : '确认' }}</button>
        </div>
      </form>
    </dialog>
  </Teleport>
</template>

<style scoped>
.site-access { margin: auto; width: min(420px, calc(100vw - 32px)); padding: 28px; border: 1px solid #484848; border-radius: 8px; background: #141414; color: #eeeeee; box-shadow: 0 20px 80px #0005; }
.site-access::backdrop { background: #0008; }
h2 { font-size: 20px; margin: 0 0 12px; }
p { color: #aaa; font-size: 13px; line-height: 1.8; margin-bottom: 20px; }
label { display: block; margin-bottom: 8px; font-size: 13px; }
input { width: 100%; padding: 10px 12px; border: 1px solid #555; border-radius: 4px; background: #0e0e0e; color: #eee; }
.access-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }
button { padding: 8px 16px; border: 1px solid #555; border-radius: 4px; background: #252525; color: #eee; cursor: pointer; }
button:disabled { opacity: .5; cursor: wait; }
.access-error { color: #ff8585; margin-top: 12px; margin-bottom: 0; }
input:focus-visible, button:focus-visible { outline: 2px solid #aaa; outline-offset: 3px; }
</style>
