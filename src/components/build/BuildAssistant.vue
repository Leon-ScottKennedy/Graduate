<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { postJson } from '../../services/apiClient'
import { checkBuildCompatibility } from '../../services/buildCompatibility'
import type { PartOption } from '../../types/hardware'

const props = defineProps<{
  build: Record<string, PartOption>
  budget: number
  usage: string
  total: number
  questions: string[]
}>()
type Source = { title: string; url: string }
const messages = ref<
  { role: 'user' | 'assistant'; content: string; sources?: Source[]; searched?: boolean }[]
>([])
const busy = ref(false)
const error = ref('')
const body = ref<HTMLDivElement | null>(null)
let controller: AbortController | undefined
async function scroll() {
  await nextTick()
  body.value?.scrollTo({ top: body.value.scrollHeight })
}
async function ask(question: string, retry = false) {
  if (busy.value || !question.trim()) return
  if (retry) messages.value.pop()
  const history = messages.value
    .slice(-10)
    .map(({ role, content }) => ({ role, content: content.slice(0, 1800) }))
  messages.value.push({ role: 'user', content: question })
  messages.value = messages.value.slice(-40)
  draft.value = ''
  error.value = ''
  busy.value = true
  const request = new AbortController()
  controller = request
  const facts = Object.fromEntries([
    ...Object.entries(props.build).flatMap(([category, option]) =>
      Object.entries(option)
        .filter(([key, value]) => key !== 'id' && value !== undefined)
        .map(([key, value]) => [
          `build.${category}.${key}`,
          typeof value === 'string'
            ? value
            : JSON.stringify(
                key === 'priceSource'
                  ? {
                      shop: option.priceSource?.shop,
                      platform: option.priceSource?.platform,
                      observedAt: option.priceSource?.observedAt,
                      basis: option.priceSource?.basis,
                    }
                  : value,
              ),
        ]),
    ),
    ['context.budget', String(props.budget)],
    ['context.total', String(props.total)],
    ['context.usage', props.usage],
    [
      'context.priceBasis',
      '未标 priceSource 的配件是预设参考价；标记 priceSource 的配件采用用户确认的人工店铺报价（含运费），时间见 observedAt，均不是实时价格。',
    ],
  ])
  void scroll()
  try {
    const result = await postJson<{ answer: string; sources: Source[]; searched: boolean }>(
      '/ai/chat',
      {
        facts,
        rules: checkBuildCompatibility(props.build),
        question,
        history,
      },
      request.signal,
    )
    if (!request.signal.aborted)
      messages.value.push({
        role: 'assistant',
        content: result.answer,
        sources: result.sources,
        searched: result.searched,
      })
  } catch (failure) {
    if (!request.signal.aborted)
      error.value = failure instanceof Error ? failure.message : '回答失败，请重试'
  } finally {
    if (controller === request) {
      busy.value = false
      void scroll()
    }
  }
}
function retry() {
  const last = messages.value.at(-1)
  if (last?.role === 'user') void ask(last.content, true)
}
watch(
  () => JSON.stringify([props.build, props.budget, props.usage, props.total]),
  () => {
    controller?.abort()
    controller = undefined
    busy.value = false
    messages.value = []
    error.value = ''
  },
)
const open = ref(false)
const draft = ref('')
const launcher = ref<HTMLButtonElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const hintVisible = ref(false)
const position = ref({ x: 80, y: 150 })
const size = ref({ width: 340, height: 420 })
let resizing: { id: number; x: number; y: number; width: number; height: number } | undefined
const bounds = ref({ top: 80, bottom: 700 })
const ballTop = ref(120)
let drag: { id: number; x: number; y: number; left: number; top: number } | undefined
function constrain() {
  const main = document.querySelector('.app_main')?.getBoundingClientRect()
  const nav = document.querySelector('.nav_top')?.getBoundingClientRect()
  const top = Math.max(8, main?.top ?? 0, nav?.bottom ?? 0)
  const bottom = Math.max(
    top,
    Math.min(window.innerHeight - 8, main?.bottom ?? window.innerHeight - 8),
  )
  bounds.value = { top, bottom }
  ballTop.value = Math.max(top, Math.min(top + 12, bottom - 44))
  const width = Math.min(size.value.width, window.innerWidth - 32)
  const height = Math.min(size.value.height, bottom - top)
  size.value = { width, height }
  position.value = {
    x: Math.max(16, Math.min(position.value.x, window.innerWidth - width - 16)),
    y: Math.max(top, Math.min(position.value.y, bottom - height)),
  }
}
function startDrag(event: PointerEvent) {
  if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
  drag = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    left: position.value.x,
    top: position.value.y,
  }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function moveDrag(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return
  position.value = { x: drag.left + event.clientX - drag.x, y: drag.top + event.clientY - drag.y }
  constrain()
}
function endDrag() {
  drag = undefined
}
function startResize(event: PointerEvent) {
  if (event.button !== 0) return
  resizing = { id: event.pointerId, x: event.clientX, y: event.clientY, ...size.value }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  event.preventDefault()
}
function resizeBy(width: number, height: number) {
  size.value = {
    width: Math.min(Math.max(280, width), window.innerWidth - position.value.x - 16),
    height: Math.min(Math.max(280, height), bounds.value.bottom - position.value.y),
  }
}
function moveResize(event: PointerEvent) {
  if (!resizing || resizing.id !== event.pointerId) return
  resizeBy(
    resizing.width + event.clientX - resizing.x,
    resizing.height + event.clientY - resizing.y,
  )
}
function endResize() {
  resizing = undefined
}
function keyboardResize(event: KeyboardEvent) {
  const changes: Record<string, [number, number]> = {
    ArrowRight: [20, 0],
    ArrowLeft: [-20, 0],
    ArrowDown: [0, 20],
    ArrowUp: [0, -20],
  }
  const change = changes[event.key]
  if (!change) return
  event.preventDefault()
  resizeBy(size.value.width + change[0], size.value.height + change[1])
}
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
  constrain()
  window.addEventListener('resize', constrain)
  window.addEventListener('scroll', constrain, true)
  showHint()
  reminderTimer = setInterval(showHint, 60000)
})
onUnmounted(() => {
  window.removeEventListener('resize', constrain)
  window.removeEventListener('scroll', constrain, true)
  controller?.abort()
  clearTimeout(hintTimer)
  clearInterval(reminderTimer)
})

async function toggle() {
  open.value = !open.value
  hintVisible.value = false
  clearTimeout(hintTimer)
  await nextTick()
  constrain()
  if (open.value) input.value?.focus()
  else launcher.value?.focus()
}
function send() {
  const question = draft.value.trim()
  if (!question) return
  void ask(question)
}
</script>

<template>
  <div
    class="nb-floating-assistant"
    :class="{ 'is-open': open }"
    :style="{
      top: `${ballTop}px`,
      visibility: bounds.bottom - bounds.top < 80 ? 'hidden' : undefined,
    }"
  >
    <Transition name="assistant-hint">
      <button v-if="hintVisible && !open" class="nb-assistant-hint" type="button" @click="toggle">
        有装机问题？问问助手 <span aria-hidden="true">→</span>
      </button>
    </Transition>
    <section
      v-if="open"
      id="build-chat"
      class="nb-chat"
      :style="{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
      }"
      role="dialog"
      aria-labelledby="build-chat-title"
      @keydown.esc.stop="toggle"
    >
      <header
        class="nb-chat-header"
        title="拖动标题栏移动对话框"
        @pointerdown="startDrag"
        @pointermove="moveDrag"
        @pointerup="endDrag"
        @pointercancel="endDrag"
        @lostpointercapture="endDrag"
      >
        <h2 id="build-chat-title">装机助手</h2>
        <button type="button" class="nb-chat-close" aria-label="关闭装机助手" @click="toggle">
          ×
        </button>
      </header>
      <div ref="body" class="nb-chat-body" aria-live="polite" :aria-busy="busy">
        <p v-if="!messages.length" class="nb-chat-placeholder">结合当前配置，有什么装机问题？</p>
        <div
          v-for="(message, index) in messages"
          :key="index"
          :class="message.role === 'user' ? 'nb-chat-question' : 'nb-chat-answer'"
        >
          <p>{{ message.content }}</p>
          <div v-if="message.sources?.length" class="nb-chat-sources">
            <span>参考来源</span>
            <a
              v-for="(source, i) in message.sources"
              :key="source.url"
              :href="source.url"
              target="_blank"
              rel="noopener noreferrer"
              >{{ i + 1 }}. {{ source.title }} ↗</a
            >
          </div>
          <small v-else-if="message.searched">已检索，未返回可引用来源</small>
        </div>
        <p v-if="busy" role="status">正在查阅资料并回答…</p>
        <p v-if="error" role="alert">
          {{ error }} <button type="button" @click="retry">重试</button>
        </p>
      </div>
      <div class="nb-chat-suggestions">
        <button
          v-for="item in questions"
          :key="item"
          type="button"
          :disabled="busy"
          @click="ask(item)"
        >
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
        <button type="submit" :disabled="busy || !draft.trim()" aria-label="发送问题">↑</button>
      </form>
      <button
        class="nb-chat-resize"
        type="button"
        aria-label="调整对话框大小，拖动或使用方向键"
        title="拖动调整大小"
        @pointerdown="startResize"
        @pointermove="moveResize"
        @pointerup="endResize"
        @pointercancel="endResize"
        @lostpointercapture="endResize"
        @keydown="keyboardResize"
      >
        <span aria-hidden="true">◢</span>
      </button>
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
  --assistant-right: max(18px, env(safe-area-inset-right));
  --assistant-bottom: max(18px, env(safe-area-inset-bottom));
  position: fixed;
  left: max(18px, env(safe-area-inset-left));
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
}
.nb-assistant-hint {
  position: absolute;
  left: 58px;
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
  width: 44px;
  height: 44px;
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
  width: min(340px, calc(100vw - 32px));
  height: min(420px, 65dvh);
  display: flex;
  flex-direction: column;
  background: #1c1a24;
  border: 1px solid #61516f;
  border-radius: 12px;
  box-shadow: 0 16px 60px #0007;
  overflow: hidden;
}
.nb-chat-header {
  cursor: grab;
  touch-action: none;
  user-select: none;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 18px;
  border-bottom: 1px solid #383140;
}
.nb-chat-header:active {
  cursor: grabbing;
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
  flex: 1;
  min-height: 0;
  overscroll-behavior: contain;
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
  white-space: pre-line;
  margin-bottom: 14px;
  color: #d2c7de;
  background: #28232f;
  padding: 11px 12px;
  border-radius: 2px 9px 9px;
  overflow-wrap: anywhere;
}
.nb-chat-sources {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #51405e;
  font-size: 11px;
  white-space: normal;
}
.nb-chat-sources a {
  display: block;
  color: #cbb6ec;
  margin-top: 5px;
}
.nb-chat-suggestions {
  flex-shrink: 0;
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
  flex-shrink: 0;
  display: flex;
  gap: 10px;
  align-items: center;
  border-top: 1px solid #383140;
  padding: 13px 24px 13px 16px;
}
.nb-chat-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 22px;
  height: 22px;
  border: 0;
  background: transparent;
  color: #a68abe;
  cursor: nwse-resize;
  touch-action: none;
  font-size: 14px;
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
@media (prefers-reduced-motion: reduce) {
  .assistant-hint-enter-active,
  .assistant-hint-leave-active {
    transition: none;
  }
}
</style>
