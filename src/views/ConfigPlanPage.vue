<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { accountUser, getAccountConfigs, deleteAccountConfig, type AccountConfig } from '../services/account'
import LoginDialog from '../components/LoginDialog.vue'

import { getConfigPlans } from '../services/catalogService'


const plans = getConfigPlans()

const route = useRoute()
const activeTab = ref(route.query.tab === 'mine' ? 'mine' : 'recommended')
const savedConfigs = ref<AccountConfig[]>([])
const savedError = ref('')
const loadingSaved = ref(false)
let requestVersion = 0
async function loadSavedConfigs() {
  const version = ++requestVersion
  savedConfigs.value = []; savedError.value = ''
  if (!accountUser.value || activeTab.value !== 'mine') { loadingSaved.value = false; return }
  loadingSaved.value = true
  try { const result = await getAccountConfigs(); if (version === requestVersion) savedConfigs.value = result.configs }
  catch (issue) { if (version === requestVersion) savedError.value = issue instanceof Error ? issue.message : '加载失败' }
  finally { if (version === requestVersion) loadingSaved.value = false }
}
async function removeSavedConfig(id: string) {
  try { await deleteAccountConfig(id); await loadSavedConfigs() }
  catch (issue) { savedError.value = issue instanceof Error ? issue.message : '删除失败' }
}
watch([accountUser, activeTab], loadSavedConfigs, { immediate: true })
watch(() => route.query.tab, value => { if (value === 'mine') activeTab.value = 'mine' })
const loginOpen = ref(false)
const loginTrigger = ref<HTMLButtonElement | null>(null)
async function closeLogin() {
  loginOpen.value = false
  await nextTick()
  loginTrigger.value?.focus()
}



</script>

<template>
  <section class="config_plan">
    <div class="config_plan_inner">
      <header class="config_plan_head">
        <span class="config_plan_kicker">CONFIG PLANS</span>
        <h2 class="config_plan_title">配置方案</h2>
        <p class="config_plan_subtitle">按使用场景挑选方案，进入智能装机查看并调整完整配置</p>
      </header>
      <nav class="plan-tabs" :class="{ 'is-mine': activeTab === 'mine' }" aria-label="配置方案分类">
        <button type="button" :aria-pressed="activeTab === 'recommended'" @click="activeTab = 'recommended'">推荐方案 <span>{{ plans.length }}</span></button>
        <button type="button" :aria-pressed="activeTab === 'mine'" @click="activeTab = 'mine'">我的配置 <svg v-if="!accountUser" width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5 1h6v2h2v4h1v8H2V7h1V3h2V1Zm0 2v4h6V3H5Zm2 6v4h2V9H7Z"/></svg></button>
        <span class="plan-tab-indicator" aria-hidden="true"></span>
      </nav>
      <div class="plan-panels">
      <div v-if="activeTab === 'mine' && !accountUser" class="plan-locked">
        <svg class="locked-icon" width="32" height="32" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" shape-rendering="crispEdges"><path d="M5 1h6v2h2v4h1v8H2V7h1V3h2V1Zm0 2v4h6V3H5Zm2 6v4h2V9H7Z"/></svg>
        <h3>登录后查看你的配置</h3>
        <p>个人配置需要登录后使用。你仍可浏览推荐方案，或直接开始装机。</p>
        <div><button ref="loginTrigger" type="button" @click="loginOpen = true">登录</button><router-link to="/smart-build">先去装机 ↗</router-link></div>
      </div>
      <div v-if="activeTab === 'mine' && accountUser" class="saved-plans">
        <p v-if="loadingSaved" role="status">正在加载你的配置…</p>
        <p v-if="savedError" role="alert">{{ savedError }}</p>
        <div v-if="!loadingSaved && !savedError && !savedConfigs.length" class="plan-locked"><h3>还没有保存的配置</h3><p>在智能装机中点击“保存配置”，即可在这里查看。</p><router-link to="/smart-build">开始装机 ↗</router-link></div>
        <article v-for="config in savedConfigs" :key="config.id" class="saved-card">
          <h3>{{ config.name }}</h3><p>{{ config.snapshot.usage }} · 预算 ¥{{ config.snapshot.budget.toLocaleString() }}</p>
          <div><router-link :to="{ path: '/smart-build', query: { saved: config.id } }">查看并编辑 →</router-link><button type="button" @click="removeSavedConfig(config.id)">删除</button></div>
        </article>
      </div>

      <div class="config_plan_grid" :class="{ 'is-inactive': activeTab !== 'recommended' }" :inert="activeTab !== 'recommended'" :aria-hidden="activeTab !== 'recommended'">
        <div
          v-for="plan in plans"
          :key="plan.name"
          class="config_plan_card"
          :class="{ featured: plan.featured }"
        >
          <h3 class="config_plan_name">{{ plan.name }}</h3>
          <div class="config_plan_price">{{ plan.price }}</div>
          <p class="config_plan_desc">{{ plan.desc }}</p>
          <dl class="config_plan_specs">
            <div v-for="item in plan.detail.filter(item => ['处理器', '显卡', '内存', '固态硬盘'].includes(item.part))" :key="item.part" class="plan-hardware-row">
              <dt>{{ item.part }}</dt><dd>{{ item.name }}</dd>
            </div>
          </dl>
          <router-link class="config_plan_link" :to="{ path: '/smart-build', query: { plan: plan.name } }">查看完整配置 →</router-link>
        </div>
      </div>

      </div>

    </div>
    <LoginDialog v-if="loginOpen" @close="closeLogin" />
  </section>
</template>

<style>
body:has(.config_plan) {
  background: light-dark(#f7f8fa, #090909);
}
</style>

<style scoped>
.config_plan { --plan-line: light-dark(#cbd1da, #333333); --plan-muted: light-dark(#687384, #999999); flex: 1; min-height: calc(100dvh - 80px); padding: 56px 32px 80px; background: light-dark(#f7f8fa, #090909); color: light-dark(#263241, #eeeeee); }
.config_plan .config_plan_inner { max-width: 1320px; width: 100%; margin: auto; padding: 0; }
.config_plan .config_plan_head { text-align: left; margin-bottom: 32px; }
.config_plan .config_plan_kicker { color: var(--plan-muted); font-size: 10px; letter-spacing: 2px; }
.config_plan .config_plan_title { display: flex; align-items: center; gap: 14px; margin: 12px 0; color: inherit; font-size: 30px; text-shadow: none; }
.config_plan .config_plan_title::after { display: none; }
.config_plan .config_plan_title::before { content: ''; width: 7px; height: 7px; background: currentColor; box-shadow: 3px 3px 0 light-dark(#aeb7c4, #555555); }
.config_plan .config_plan_subtitle { color: var(--plan-muted); font-size: 13px; }
.plan-tabs { position: relative; display: flex; gap: 28px; border-bottom: 1px solid var(--plan-line); margin-bottom: 28px; }
.plan-tabs button { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 2px; border: 0; border-bottom: 3px solid transparent; background: transparent; color: var(--plan-muted); font: inherit; font-size: 14px; cursor: pointer; }
.plan-tabs button { box-sizing: border-box; width: 90px; justify-content: center; flex: 0 0 90px; transition: color 220ms ease; }
.plan-tabs button[aria-pressed='true'] { color: light-dark(#263241, #eeeeee); font-weight: 650; }
.plan-tab-indicator { position: absolute; left: 0; bottom: -1px; width: 90px; height: 3px; background: light-dark(#263241, #eeeeee); transform: translateX(0); transition: transform 300ms cubic-bezier(.22,.8,.25,1); pointer-events: none; }
.plan-tabs.is-mine .plan-tab-indicator { transform: translateX(118px); }
@media (prefers-reduced-motion: reduce) { .plan-tab-indicator, .plan-tabs button { transition: none; } }
.plan-tabs button span { font: 11px ui-monospace, Consolas, monospace; }
.plan-panels { display: grid; }
.plan-panels > .config_plan_grid, .plan-panels > .plan-locked, .plan-panels > .saved-plans { grid-area: 1 / 1; min-width: 0; }
.saved-plans { display: grid; align-content: start; gap: 16px; }
.saved-card { padding: 22px; border: 1px solid var(--plan-line); background: light-dark(#ffffff, #141414); }
.saved-card h3 { margin: 0 0 12px; }
.saved-card p { margin-bottom: 18px; color: var(--plan-muted); font-size: 13px; }
.saved-card > div { display: flex; justify-content: space-between; align-items: center; }
.saved-card a { color: inherit; font-size: 13px; }
.saved-card button { padding: 6px 12px; border: 1px solid var(--plan-line); background: transparent; color: inherit; cursor: pointer; }
.plan-panels > .is-inactive { visibility: hidden; pointer-events: none; }
.plan-panels > .plan-locked { justify-content: center; }
.config_plan .config_plan_grid { padding: 0; gap: 20px; }
.config_plan .config_plan_card { position: relative; display: flex; flex-direction: column; padding: 28px 24px 24px; border: 1px solid var(--plan-line); border-radius: 0; background: light-dark(#ffffff, #141414); color: inherit; box-shadow: inset 0 1px 0 light-dark(#ffffff, #ffffff0a); text-align: left; transform: none; clip-path: none; }
.config_plan .config_plan_card:hover { border-color: light-dark(#7b8798, #777777); transform: none; box-shadow: none; }
.config_plan .config_plan_card.featured { border-color: light-dark(#8e99a8, #777777); }
.config_plan .config_plan_name { color: inherit; margin-top: 20px; font-size: 19px; }
.config_plan .config_plan_price { color: inherit; margin: 18px 0 10px; font: 700 27px ui-monospace, Consolas, monospace; }
.config_plan .config_plan_desc, .config_plan .config_plan_specs li { color: var(--plan-muted); }
.config_plan .config_plan_desc { font-size: 12px; }
.config_plan .config_plan_specs { flex: 1; border-top: 1px solid var(--plan-line); margin: 20px 0; padding: 0; }
.plan-hardware-row { display: grid; grid-template-columns: 48px minmax(0, 1fr); align-content: start; gap: 12px; min-height: 72px; padding: 15px 0; border-bottom: 1px solid light-dark(#e5e8ed, #262626); }
.plan-hardware-row dt { color: var(--plan-muted); font-size: 11px; line-height: 1.8; }
.plan-hardware-row dd { min-width: 0; margin: 0; color: light-dark(#303c4d, #dddddd); font-size: 12px; line-height: 1.8; overflow-wrap: anywhere; }
.plan-hardware-row:nth-child(2) { min-height: 104px; }
.plan-hardware-row:nth-child(3) { min-height: 82px; }
.plan-hardware-row:last-child { border-bottom: 0; }
.config_plan .config_plan_link { width: 100%; padding: 10px; border: 1px solid light-dark(#aeb7c3, #515151); border-radius: 0; background: light-dark(#f1f3f6, #202020); color: inherit; text-align: left; font: inherit; font-size: 12px; cursor: pointer; }
.config_plan .config_plan_link:hover { color: inherit; background: light-dark(#e4e8ed, #303030); }
.plan-locked { display: flex; flex-direction: column; align-items: center; padding: 72px 24px; border: 1px solid var(--plan-line); background: light-dark(#ffffff, #111111); text-align: center; }
.locked-icon { box-sizing: content-box; padding: 16px; border: 2px solid light-dark(#aeb7c3, #555555); box-shadow: 4px 4px 0 light-dark(#dce1e8, #030303); color: var(--plan-muted); margin-bottom: 28px; }
.plan-locked h3 { margin: 0; font-size: 22px; }
.plan-locked p { max-width: 360px; margin: 16px 0 28px; color: var(--plan-muted); font-size: 13px; line-height: 1.9; }
.plan-locked > div { display: flex; align-items: center; gap: 24px; font-size: 13px; }
.plan-locked button { min-width: 96px; padding: 10px 20px; border: 2px solid light-dark(#8e98a6, #777777); background: light-dark(#e6e9ee, #303030); color: inherit; font: inherit; cursor: pointer; box-shadow: 0 3px 0 light-dark(#c7cdd6, #030303); }
.plan-locked a { color: inherit; text-decoration: none; }
button:focus-visible, a:focus-visible { outline: 2px solid light-dark(#536174, #bdbdbd); outline-offset: 4px; }
@media (max-width: 600px) { .config_plan { padding: 32px 16px 56px; } .config_plan .config_plan_grid { grid-template-columns: minmax(0, 1fr); } .plan-locked { padding: 48px 20px; } }
</style>
