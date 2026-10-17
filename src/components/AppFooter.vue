
<template>
  <footer class="nav_footer">
    <div class="nav_footer_inner">
      <div class="nav_footer_top">
        <div class="nav_footer_brand">
          <svg
            class="nav_footer_logo"
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M16 2L28 9V23L16 30L4 23V9L16 2Z"
              fill="url(#navFooterHexGradient)"
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
                id="navFooterHexGradient"
                x1="4"
                y1="2"
                x2="28"
                y2="30"
                gradientUnits="userSpaceOnUse"
              >
                <stop stop-color="#6c5ce7" />
                <stop offset="1" stop-color="#a29bfe" />
              </linearGradient>
            </defs>
          </svg>
          <div class="nav_footer_brand_text">
            <strong class="nav_footer_brand_name">NexBuild</strong>
            <span class="nav_footer_brand_sub">AI PC BUILDER</span>
          </div>
        </div>
        <nav class="nav_footer_links">
          <div class="nav_footer_col">
            <h4 class="nav_footer_col_title">产品</h4>
            <router-link to="/smart-build" class="nav_footer_link">智能装机</router-link>
            <router-link to="/ai-chat" class="nav_footer_link">AI 提问</router-link>
            <router-link to="/config-plan" class="nav_footer_link">配置方案</router-link>
            <router-link to="/hardware-compare" class="nav_footer_link">硬件对比</router-link>
          </div>
          <div class="nav_footer_col">
            <h4 class="nav_footer_col_title">关于</h4>
            <a href="#" class="nav_footer_link">关于我们</a>
            <a href="#" class="nav_footer_link">使用帮助</a>
            <a href="#" class="nav_footer_link">意见反馈</a>
          </div>
          <div class="nav_footer_col">
            <h4 class="nav_footer_col_title">联系</h4>
            <a href="#" class="nav_footer_link">GitHub</a>
            <a href="#" class="nav_footer_link">邮箱</a>
            <a href="#" class="nav_footer_link">QQ 群</a>
          </div>
        </nav>
      </div>
      <div class="nav_footer_bottom">
        <p class="nav_footer_copy">© 2026 NexBuild. 基于 AI 的智能装机配置平台.</p>
        <p class="nav_footer_tip">本站硬件数据仅供参考，实际价格以电商平台为准</p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.nav_footer {
  flex-shrink: 0;
  padding: 56px 24px 32px;
  border-top: 1px solid var(--border-divider);
  font-family: var(--font-family);
}

.nav_footer_inner {
  max-width: 1120px;
  margin: 0 auto;
}

.nav_footer_top {
  display: flex;
  justify-content: space-between;
  gap: 48px;
}

.nav_footer_brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav_footer_logo {
  flex-shrink: 0;
}

.nav_footer_brand_text {
  display: flex;
  flex-direction: column;
}

.nav_footer_brand_name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.nav_footer_brand_sub {
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--text-label);
}

/* 链接列 */
.nav_footer_links {
  display: flex;
  gap: 64px;
}

.nav_footer_col {
  display: flex;
  flex-direction: column;
}

.nav_footer_col_title {
  margin-bottom: 14px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.nav_footer_link {
  padding: 5px 0;
  font-size: 13px;
  color: var(--text-label);
  text-decoration: none;
  transition: color 0.2s ease;
}

.nav_footer_link:hover {
  color: var(--color-primary-light);
}

/* 底部分隔 + 版权 */
.nav_footer_bottom {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--border-divider);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav_footer_copy,
.nav_footer_tip {
  font-size: 12px;
  color: var(--text-hint);
}
</style>
