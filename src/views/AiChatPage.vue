<script setup lang="ts">
import { ref, nextTick } from 'vue'

interface ChatMessage {
  role: 'user' | 'ai'
  text: string
}

const messages = ref<ChatMessage[]>([
  {
    role: 'ai',
    text: '你好，我是 NexBuild AI 装机助手。告诉我你的预算和用途，我来帮你出配置方案。'
  }
])

const chips = ['6000 游戏主机', '设计渲染推荐', 'ITX 小钢炮', '电源功率怎么算']

const inputText = ref('')
const messagesEl = ref<HTMLElement | null>(null)
const thinking = ref(false)

// 简单的本地模拟回复，便于演示完整对话流程
const mockReplies: [string, string][] = [
  ['游戏', '游戏主机建议预算优先向显卡倾斜：6000 价位可选 R5 7500F + RX 7700 XT，2K 高画质流畅；预算充足可上 RTX 4070 SUPER。'],
  ['渲染', '设计渲染建议多核 CPU + 大内存：i7-14700KF 或 R9 7950X，搭配 64GB DDR5 与 RTX 4070 SUPER 以上显卡。'],
  ['ITX', 'ITX 小钢炮注意散热与电源尺寸：推荐 SFX 电源 + 下压式或 240 水冷，显卡留意长度限制（≤ 300mm 为宜）。'],
  ['电源', '电源功率估算：CPU 满载 + 显卡满载 + 150W 冗余。例如 14600KF(125W) + 4070S(220W)，650W 金牌即可。']
]

function getReply(text: string): string {
  for (const [key, reply] of mockReplies) {
    if (text.includes(key)) return reply
  }
  return `收到，已根据「${text}」生成初步思路：先确定预算分配比例（显卡约占 40-50%），再按用途选择 CPU 平台，最后匹配电源与散热。可补充预算与用途，我给出具体清单。`
}

async function scrollToBottom() {
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}

function sendMessage() {
  const text = inputText.value.trim()
  if (!text || thinking.value) return
  messages.value.push({ role: 'user', text })
  inputText.value = ''
  scrollToBottom()

  thinking.value = true
  setTimeout(() => {
    messages.value.push({ role: 'ai', text: getReply(text) })
    thinking.value = false
    scrollToBottom()
  }, 600)
}

function useChip(text: string) {
  inputText.value = text
  sendMessage()
}

const cubes = [
  { top: '22%', right: '8%', width: '38px', height: '38px', animationDelay: '1.5s' },
  { bottom: '26%', left: '8%', width: '30px', height: '30px', animationDelay: '0.8s' }
]
</script>

<template>
  <section class="ai_chat">
    <div class="section_bg">
      <span v-for="(cube, i) in cubes" :key="i" class="cube" :style="cube"></span>
    </div>
    <div class="ai_chat_inner">
      <header class="ai_chat_head">
        <span class="ai_chat_kicker">AI CHAT</span>
        <h2 class="ai_chat_title">AI 装机助手</h2>
        <p class="ai_chat_subtitle">不懂硬件？直接问，AI 为你解答装机难题</p>
      </header>

      <div class="ai_chat_messages ai_chat_messages_page" ref="messagesEl">
        <div
          v-for="(msg, index) in messages"
          :key="index"
          class="ai_chat_msg"
          :class="msg.role === 'user' ? 'ai_chat_msg_user' : 'ai_chat_msg_ai'"
        >
          <span class="ai_chat_msg_role">{{ msg.role === 'user' ? '你' : 'AI' }}</span>
          <p class="ai_chat_msg_text">{{ msg.text }}</p>
        </div>
        <div v-if="thinking" class="ai_chat_msg ai_chat_msg_ai">
          <span class="ai_chat_msg_role">AI</span>
          <p class="ai_chat_msg_text">正在思考…</p>
        </div>
      </div>

      <div class="ai_chat_chips">
        <span v-for="chip in chips" :key="chip" class="ai_chat_chip" @click="useChip(chip)">
          {{ chip }}
        </span>
      </div>

      <div class="ai_chat_input_bar">
        <input
          v-model="inputText"
          type="text"
          class="ai_chat_input"
          placeholder="描述你的需求，例如：预算 8000，主要做视频剪辑…"
          @keyup.enter="sendMessage"
        />
        <button class="ai_chat_send" @click="sendMessage">发送</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 完整页面：对话区限制高度并可滚动 */
.ai_chat_messages_page {
  max-height: 420px;
  overflow-y: auto;
}
</style>
