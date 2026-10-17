<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const navLinks = [
  { path: '/', label: '首页' },
  { path: '/smart-build', label: '智能装机' },
  { path: '/ai-chat', label: 'AI 提问' },
  { path: '/config-plan', label: '配置方案' }
]

const route = useRoute()

// 根据当前路由路径判断高亮项
const activePath = computed(() => route.path)
</script>

<template>
  <nav class="nav_top">
    <div class="nav_top_logo">
      <svg
        class="nav_top_logo_icon"
        width="36"
        height="36"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M16 2L28 9V23L16 30L4 23V9L16 2Z"
          fill="url(#navTopHexGradient)"
          stroke="#8B7CFF"
          stroke-width="1.5"
        />
        <path
          d="M11 16L15 20L21 12"
          stroke="white"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <defs>
          <linearGradient
            id="navTopHexGradient"
            x1="4"
            y1="2"
            x2="28"
            y2="30"
            gradientUnits="userSpaceOnUse"
          >
            <stop stop-color="#6C5CE7" />
            <stop offset="1" stop-color="#A29BFE" />
          </linearGradient>
        </defs>
      </svg>
      <div class="nav_top_logo_text">
        <span class="nav_top_logo_title">NexBuild</span>
        <span class="nav_top_logo_subtitle">AI PC BUILDER</span>
      </div>
    </div>
    <ul class="nav_top_links">
      <li v-for="link in navLinks" :key="link.path">
        <router-link
          :to="link.path"
          class="nav-link"
          :class="{ active: activePath === link.path }"
        >
          {{ link.label }}
        </router-link>
      </li>
    </ul>
    <div class="nav_top_action">
      <button class="nav_top_action_btn" aria-label="账户">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>
    </div>
  </nav>
</template>
