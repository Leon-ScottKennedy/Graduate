<script setup lang="ts">
import { ref, nextTick } from 'vue'

interface ChatMessage {
  role: 'user' | 'ai'
  text: string
}

const messages = ref<ChatMessage[]>([
  { role: 'user', text: '预算 6000，主要玩《黑神话：悟空》，该怎么配？' },
  {
    role: 'ai',
    text: '推荐 R5 7500F + RX 7700 XT 组合，2K 高画质可流畅运行，整机约 ¥5,980。预算优先向显卡倾斜，电源配 650W 金牌即可。'
  },
  { role: 'user', text: 'i5-14600KF 和 R7 9700X 怎么选？' },
  {
    role: 'ai',
    text: '纯游戏选 14600KF，帧率略高；做剪辑渲染选 9700X，多核更强且功耗更低。详细参数可到「硬件对比」查看。'
  }
])

const chips = ['6000 游戏主机', '设计渲染推荐', 'ITX 小钢炮', '电源功率怎么算']

const inputText = ref('')

const messagesEl = ref<HTMLElement | null>(null)

function sendMessage() {
  const text = inputText.value.trim()
  if (!text) return
  messages.value.push({ role: 'user', text })
  inputText.value = ''
  nextTick(() => {
    if (messagesEl.value) {
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight
    }
  })
}

function useChip(text: string) {
  inputText.value = text
}

const cubes = [
  { top: '22%', right: '8%', width: '38px', height: '38px', delay: '1.5s' },
  { bottom: '26%', left: '8%', width: '30px', height: '30px', delay: '0.8s' }
]
</script>

<template>
  <section class="ai_chat" id="ai-chat">
    <div class="section_bg">
      <span
        v-for="(cube, index) in cubes"
        :key="index"
        class="cube"
        :style="cube"
      ></span>
    </div>
    <div class="ai_chat_inner">
      <header class="ai_chat_head">
        <span class="ai_chat_kicker">AI CHAT</span>
        <h2 class="ai_chat_title">AI 装机助手</h2>
        <p class="ai_chat_subtitle">不懂硬件？直接问，AI 为你解答装机难题</p>
      </header>

      <div class="ai_chat_messages" ref="messagesEl">
        <div
          v-for="(msg, index) in messages"
          :key="index"
          class="ai_chat_msg"
          :class="msg.role === 'user' ? 'ai_chat_msg_user' : 'ai_chat_msg_ai'"
        >
          <span class="ai_chat_msg_role">{{ msg.role === 'user' ? '你' : 'AI' }}</span>
          <p class="ai_chat_msg_text">{{ msg.text }}</p>
        </div>
      </div>

      <div class="ai_chat_chips">
        <span
          v-for="chip in chips"
          :key="chip"
          class="ai_chat_chip"
          @click="useChip(chip)"
        >
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
