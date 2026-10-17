<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

defineProps<{ question: string; reply: string; questions: string[] }>()
const emit = defineEmits<{ ask: [question: string] }>()
const open = ref(false)
const draft = ref('')
const launcher = ref<HTMLButtonElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const hintVisible = ref(false)
let hintTimer: ReturnType<typeof setTimeout> | undefined
let reminderTimer: ReturnType<typeof setInterval> | undefined

function showHint() {
  if (open.value || document.hidden) return
  hintVisible.value = true
  clearTimeout(hintTimer)
  hintTimer = setTimeout(() => {
    hintVisible.value = false
  }, 5000)
}
onMounted(() => {
  showHint()
  reminderTimer = setInterval(showHint, 60000)
})
onUnmounted(() => {
  clearTimeout(hintTimer)
  clearInterval(reminderTimer)
})

async function toggle() {
  open.value = !open.value
  hintVisible.value = false
  clearTimeout(hintTimer)
  await nextTick()
  if (open.value) input.value?.focus()
  else launcher.value?.focus()
}
function send() {
  const question = draft.value.trim()
  if (!question) return
  emit('ask', question)
  draft.value = ''
}
</script>

<template>
  <div class="nb-floating-assistant" :class="{ 'is-open': open }">
    <Transition name="assistant-hint">
      <button v-if="hintVisible && !open" class="nb-assistant-hint" type="button" @click="toggle">
        有装机问题？问问助手 <span aria-hidden="true">→</span>
      </button>
    </Transition>
    <section
      v-if="open"
      id="build-chat"
      class="nb-chat"
      role="dialog"
      aria-labelledby="build-chat-title"
      @keydown.esc.stop="toggle"
    >
      <header class="nb-chat-header">
        <h2 id="build-chat-title">装机助手</h2>
        <span class="nb-badge">AI 未接入</span>
        <button type="button" class="nb-chat-close" aria-label="关闭装机助手" @click="toggle">
          ×
        </button>
      </header>
      <div class="nb-chat-body" aria-live="polite">
        <p v-if="!question" class="nb-chat-placeholder">有什么装机问题？</p>
        <template v-else>
          <p class="nb-chat-question">{{ question }}</p>
          <p class="nb-chat-answer">{{ reply }}</p>
        </template>
      </div>
      <div class="nb-chat-suggestions">
        <button v-for="item in questions" :key="item" type="button" @click="emit('ask', item)">
          {{ item }}
        </button>
      </div>
      <form class="nb-chat-form" @submit.prevent="send">
        <input
          ref="input"
          v-model="draft"
          aria-label="装机问题"
          placeholder="输入问题…"
          maxlength="500"
        />
        <button type="submit" :disabled="!draft.trim()" aria-label="发送问题">↑</button>
      </form>
    </section>
    <button
      ref="launcher"
      class="nb-assistant-ball"
      type="button"
      :aria-label="open ? '收起装机助手' : '打开装机助手'"
      :aria-expanded="open"
      aria-controls="build-chat"
      aria-haspopup="dialog"
      title="装机助手"
      @click="toggle"
    >
      <svg v-if="!open" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 5h14v11H9l-4 3V5Z"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linejoin="round"
        />
        <path d="M9 9h6M9 12h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
      </svg>
      <span v-else aria-hidden="true">×</span>
    </button>
  </div>
</template>

<style scoped>
.nb-floating-assistant {
  --assistant-left: max(clamp(16px, 4vw, 110px), env(safe-area-inset-left));
  --assistant-top: clamp(100px, 12dvh, 160px);
  position: fixed;
  left: var(--assistant-left);
  top: var(--assistant-top);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
}
.nb-assistant-hint {
  position: absolute;
  left: 66px;
  top: 50%;
  transform: translateY(-50%);
  width: max-content;
  max-width: calc(100vw - 110px);
  padding: 11px 14px;
  border: 1px solid #665074;
  border-radius: 8px;
  background: #2a2233;
  color: #e2d2f1;
  box-shadow: 0 5px 20px #0004;
  font-size: 12px;
  line-height: 1.6;
  text-align: left;
}
.nb-assistant-hint::before {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  left: -5px;
  top: calc(50% - 4px);
  background: #2a2233;
  border-left: 1px solid #665074;
  border-bottom: 1px solid #665074;
  transform: rotate(45deg);
}
.assistant-hint-enter-active,
.assistant-hint-leave-active {
  transition: opacity 0.2s;
}
.assistant-hint-enter-from,
.assistant-hint-leave-to {
  opacity: 0;
}
.nb-assistant-ball {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid #b49dd9;
  background: linear-gradient(145deg, #8b6abb, #5b437e);
  color: #fff;
  box-shadow: 0 5px 22px #0005;
  transition:
    background 0.2s,
    box-shadow 0.2s;
}
.nb-assistant-ball:hover {
  background: #8b6abb;
  box-shadow: 0 5px 24px #8360b744;
}
.nb-assistant-ball svg {
  width: 25px;
  height: 25px;
}
.nb-assistant-ball span {
  font-size: 27px;
  line-height: 1;
}
.nb-chat {
  position: fixed;
  left: 20px;
  top: calc(var(--assistant-top) + 66px);
  width: 360px;
  max-height: calc(100dvh - var(--assistant-top) - 82px);
  display: flex;
  flex-direction: column;
  background: #1c1a24;
  border: 1px solid #61516f;
  border-radius: 12px;
  box-shadow: 0 16px 60px #0007;
  overflow: hidden;
}
.nb-chat-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 18px;
  border-bottom: 1px solid #383140;
}
.nb-chat-header h2 {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
}
.nb-chat-close {
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: #bdb1cb;
  width: 28px;
  height: 28px;
  font-size: 23px;
}
.nb-chat-close:hover {
  color: white;
  background: #34283f;
  border-radius: 4px;
}
.nb-chat-body {
  min-height: 155px;
  overflow-y: auto;
  padding: 18px;
  font-size: 12px;
  line-height: 1.9;
}
.nb-chat-placeholder {
  color: #a59ab2;
}
.nb-chat-question {
  padding: 9px 12px;
  margin-left: 30px;
  margin-bottom: 14px;
  background: #4b365e;
  color: #ede2f9;
  border-radius: 9px 9px 2px 9px;
  overflow-wrap: anywhere;
}
.nb-chat-answer {
  color: #d2c7de;
  background: #28232f;
  padding: 11px 12px;
  border-radius: 2px 9px 9px;
  overflow-wrap: anywhere;
}
.nb-chat-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding: 0 18px 15px;
}
.nb-chat-suggestions button {
  border: 1px solid #51405e;
  border-radius: 5px;
  padding: 6px 9px;
  font-size: 10px;
  background: #29212f;
  color: #cbb6dc;
}
.nb-chat-suggestions button:hover {
  background: #40304e;
}
.nb-chat-form {
  display: flex;
  gap: 10px;
  align-items: center;
  border-top: 1px solid #383140;
  padding: 13px 16px;
}
.nb-chat-form input {
  width: 100%;
  min-width: 0;
  padding: 8px 0;
  border: 0;
  background: transparent;
  color: #eee6f6;
  font-size: 12px;
}
.nb-chat-form button {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  background: #735395;
  color: #fff;
  border: 0;
  border-radius: 6px;
  font-size: 18px;
}
@media (max-width: 1100px) {
  .nb-floating-assistant {
    position: relative;
    left: auto;
    top: auto;
    height: 380px;
    margin-bottom: 24px;
  }
  .nb-assistant-ball {
    position: fixed;
    left: var(--assistant-left);
    top: var(--assistant-top);
  }
  .nb-assistant-hint {
    position: fixed;
    left: calc(var(--assistant-left) + 66px);
    top: calc(var(--assistant-top) + 26px);
  }
  .is-open .nb-assistant-ball {
    display: none;
  }
  .is-open .nb-chat {
    position: static;
    width: 100%;
    height: 380px;
    max-height: 380px;
  }
}
@media (max-width: 780px) {
  .nb-floating-assistant {
    --assistant-left: max(12px, env(safe-area-inset-left));
  }
  .nb-assistant-ball {
    width: 48px;
    height: 48px;
  }
  .nb-assistant-hint {
    left: calc(var(--assistant-left) + 60px);
  }
  .nb-chat {
    left: 16px;
    top: max(76px, env(safe-area-inset-top));
    max-height: calc(100dvh - max(76px, env(safe-area-inset-top)) - 16px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .assistant-hint-enter-active,
  .assistant-hint-leave-active {
    transition: none;
  }
}
</style>
