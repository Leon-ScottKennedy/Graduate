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
        .filter(([key, value]) => !['id', 'marketOffer', 'observedMarketOffer', 'referencePrice'].includes(key) && value !== undefined)
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
      'tag标明公开参考、海外参考或估算参考的价格不是店铺报价；估算包含同系列/容量换算等低置信度值。已采集商品展示价不含运费或资格优惠；priceSource为人工报价；其余为预设参考价。均非实时成交价。',
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
const position = ref({ x: 80, y: 150 })
const size = ref({ width: 480, height: 540 })
const bounds = ref({ top: 80, bottom: 700 })
let drag: { id: number; x: number; y: number; left: number; top: number } | undefined
function constrain() {
  const nav = document.querySelector('.nav_top')?.getBoundingClientRect()
  const top = Math.min(Math.max(16, nav?.bottom ?? 0), 80)
  const bottom = Math.max(top, window.innerHeight - 24)
  bounds.value = { top, bottom }
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
onMounted(() => {
  constrain()
  window.addEventListener('resize', constrain)
  window.addEventListener('scroll', constrain, true)
})
onUnmounted(() => {
  window.removeEventListener('resize', constrain)
  window.removeEventListener('scroll', constrain, true)
  controller?.abort()
})

async function toggle() {
  open.value = !open.value
  await nextTick()
  constrain()
  if (open.value) {
    position.value = {
      x: Math.max(16, (window.innerWidth - size.value.width) / 2),
      y: Math.max(bounds.value.top, bounds.value.top + (bounds.value.bottom - bounds.value.top - size.value.height) / 2),
    }
  }
  if (open.value) input.value?.focus()
  else launcher.value?.focus()
}
function send() {
  const question = draft.value.trim()
  if (!question) return
  void ask(question)
}
defineExpose({
  isOpen: open,
  show: () => {
    if (!open.value) {
      launcher.value = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null
      void toggle()
    } else input.value?.focus()
  },
})
</script>

<template>
  <Teleport to="body">
  <div
    class="nb-floating-assistant"
    :class="{ 'is-open': open }"
    :style="{
      visibility: bounds.bottom - bounds.top < 80 ? 'hidden' : undefined,
    }"
  >
    <Transition name="assistant-panel">
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
        <div class="nb-chat-heading"><h2 id="build-chat-title"><span aria-hidden="true">▪</span> 装机助手</h2><span>结合当前配置，为你解答</span></div>
        <button type="button" class="nb-chat-close" aria-label="关闭装机助手" @click="toggle">
          ×
        </button>
      </header>
      <div ref="body" class="nb-chat-body" aria-live="polite" :aria-busy="busy">
        <div
          v-for="(message, index) in messages"
          :key="index"
          :class="message.role === 'user' ? 'nb-chat-question' : 'nb-chat-answer'"
        >
          <span v-if="message.role === 'assistant'" class="nb-message-label">装机助手</span>
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
      <div v-if="!messages.length" class="nb-chat-suggestions">
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
    </section>
    </Transition>
  </div>
  </Teleport>
</template>

<style scoped>
.nb-floating-assistant {
  --assistant-right: max(18px, env(safe-area-inset-right));
  --assistant-bottom: max(18px, env(safe-area-inset-bottom));
  position: fixed;
  right: var(--assistant-right);
  bottom: var(--assistant-bottom);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 14px;
}
.nb-chat {
  --chat-edge: light-dark(#8b95a4, #909090);
  --chat-surface: light-dark(#ffffff, #101010);
  --chat-cut: polygon(0 8px, 4px 8px, 4px 4px, 8px 4px, 8px 0, calc(100% - 8px) 0, calc(100% - 8px) 4px, calc(100% - 4px) 4px, calc(100% - 4px) 8px, 100% 8px, 100% calc(100% - 8px), calc(100% - 4px) calc(100% - 8px), calc(100% - 4px) calc(100% - 4px), calc(100% - 8px) calc(100% - 4px), calc(100% - 8px) 100%, 8px 100%, 8px calc(100% - 4px), 4px calc(100% - 4px), 4px calc(100% - 8px), 0 calc(100% - 8px));
  position: fixed;
  isolation: isolate;
  width: min(340px, calc(100vw - 32px));
  height: min(420px, 65dvh);
  display: flex;
  flex-direction: column;
  background: transparent;
  border: 0;
  border-radius: 0;
  overflow: hidden;
}
.nb-chat::before, .nb-chat::after { content: ''; position: absolute; pointer-events: none; clip-path: var(--chat-cut); }
.nb-chat::before { inset: 0; z-index: -2; background: var(--chat-edge); }
.nb-chat::after { inset: 2px; z-index: -1; background: var(--chat-surface); }
.nb-chat-header { margin: 2px 8px 0; background: light-dark(#f3f5f8, #171717); }
.nb-chat-header {
  cursor: grab;
  touch-action: none;
  user-select: none;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 18px;
  border-bottom: 1px solid light-dark(#d8dee7, #303030);
}
.nb-chat-header:active {
  cursor: grabbing;
}
.nb-chat-header h2 {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: light-dark(#263241, #eeeeee);
}
.nb-chat-heading { flex: 1; display: grid; gap: 5px; }
.nb-chat-heading > span { color: light-dark(#64748b, #888888); font-size: 11px; }
.nb-chat-header h2 span { margin-right: 5px; }
.nb-chat-close {
  display: grid;
  place-items: center;
  border: 2px solid light-dark(#a2adbb, #555555);
  background: light-dark(#ffffff, #111111);
  color: light-dark(#475569, #cccccc);
  width: 28px;
  height: 28px;
  font-size: 23px;
}
.nb-chat-close:hover {
  color: white;
  background: #2c2c2c;
  border-radius: 0;
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
.nb-chat-question p, .nb-chat-answer p { margin: 0; }
.nb-chat button { cursor: pointer; }
.nb-chat button:disabled { opacity: .45; cursor: default; }
.nb-chat :is(button, input):focus-visible { outline: 2px solid light-dark(#64748b, #aaaaaa); outline-offset: 2px; }
.assistant-panel-enter-active, .assistant-panel-leave-active { transition: opacity .2s ease, transform .2s ease; }
.assistant-panel-enter-from, .assistant-panel-leave-to { opacity: 0; transform: translateY(14px) scale(.97); }
@media (prefers-reduced-motion: reduce) { .assistant-panel-enter-active, .assistant-panel-leave-active { transition: none; } }
.nb-chat-question {
  position: relative;
  isolation: isolate;
  padding: 12px 16px;
  margin: 0 0 20px auto;
  width: fit-content;
  max-width: 82%;
  box-sizing: border-box;
  background: transparent;
  color: light-dark(#253040, #e6e6e6);
  border-radius: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.nb-chat-question::before, .nb-chat-question::after {
  content: '';
  position: absolute;
  pointer-events: none;
  clip-path: var(--chat-cut);
}
.nb-chat-question::before { inset: 0; z-index: -2; background: light-dark(#9aa7b8, #737373); }
.nb-chat-question::after { inset: 2px; z-index: -1; background: light-dark(#e8edf3, #292929); }
.nb-chat-answer {
  white-space: pre-line;
  margin: 0 12px 24px 0;
  color: light-dark(#374151, #cbcbcb);
  background: transparent;
  padding: 0;
  border-radius: 0;
  overflow-wrap: anywhere;
}
.nb-message-label { display: block; margin-bottom: 6px; color: light-dark(#64748b, #999999); font-size: 10px; line-height: 1.5; font-weight: 600; }
.nb-chat-answer > .nb-message-label { margin-bottom: 10px; color: light-dark(#475569, #bbbbbb); }
.nb-chat-sources {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #464646;
  font-size: 11px;
  white-space: normal;
}
.nb-chat-sources a {
  display: block;
  color: light-dark(#52647b, #bebebe);
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
  border: 2px solid light-dark(#c0c8d3, #464646);
  border-radius: 0;
  padding: 6px 9px;
  font-size: 11px;
  background: light-dark(#f5f6f8, #181818);
  color: light-dark(#4b5563, #bdbdbd);
}
.nb-chat-suggestions button:hover {
  background: light-dark(#e6ebf1, #363636);
}
.nb-chat-form {
  flex-shrink: 0;
  display: flex;
  gap: 10px;
  align-items: center;
  border-top: 1px solid light-dark(#d8dee7, #303030);
  padding: 13px 16px;
}

.nb-chat-form input {
  width: 100%;
  min-width: 0;
  padding: 10px 12px;
  border: 2px solid light-dark(#aab4c2, #555555);
  border-radius: 0;
  background: light-dark(#f5f6f8, #0b0b0b);
  color: light-dark(#263241, #e9e9e9);
  font-size: 12px;
}
.nb-chat-form button {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  background: light-dark(#303946, #dddddd);
  color: light-dark(#ffffff, #111111);
  border: 0;
  border-radius: 0;
  font-size: 18px;
}
.nb-chat-suggestions button:not(:disabled):active, .nb-chat-form button:not(:disabled):active, .nb-chat-close:active { opacity: .8; }
.nb-chat-body { scrollbar-width: thin; scrollbar-color: light-dark(#9ba5b4, #626262) transparent; }
</style>
