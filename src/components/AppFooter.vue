
<template>
  <footer class="nav_footer">
    <div class="nav_footer_inner">
      <div class="nav_footer_top">
        <div class="nav_footer_brand">
          <svg class="nav_footer_logo" width="30" height="30" viewBox="0 0 28 28" fill="currentColor" aria-hidden="true" shape-rendering="crispEdges"><path d="M4 4h8v4h4v4h4V4h4v20h-8v-4h-4v-4H8v8H4V4Z"/></svg>
          <div class="nav_footer_brand_text">
            <strong class="nav_footer_brand_name">NEXBUILD</strong>
            <span class="nav_footer_brand_sub">你的装机工作台</span>
          </div>
        </div>
        <div class="nav_footer_contact">
          <p>联系我们</p>
          <a
            class="nav_footer_github"
            href="https://github.com/Leon-ScottKennedy/Graduate"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .75a11.25 11.25 0 0 0-3.558 21.922c.562.104.768-.244.768-.542 0-.267-.01-.975-.015-1.914-3.13.68-3.79-1.508-3.79-1.508-.512-1.3-1.25-1.646-1.25-1.646-1.022-.699.077-.685.077-.685 1.13.08 1.725 1.16 1.725 1.16 1.005 1.722 2.636 1.225 3.278.937.103-.728.393-1.225.715-1.507-2.498-.284-5.124-1.25-5.124-5.565 0-1.23.44-2.232 1.16-3.02-.117-.284-.503-1.428.11-2.978 0 0 .945-.303 3.094 1.154a10.78 10.78 0 0 1 5.634 0c2.148-1.457 3.092-1.154 3.092-1.154.615 1.55.229 2.694.112 2.978.722.788 1.159 1.79 1.159 3.02 0 4.327-2.63 5.278-5.136 5.557.404.348.764 1.034.764 2.084 0 1.505-.014 2.72-.014 3.09 0 .3.203.65.774.54A11.252 11.252 0 0 0 12 .75Z" />
            </svg>
            <span>GitHub</span>
            <span class="nav_footer_external" aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
      <div class="nav_footer_bottom">
        <p class="nav_footer_copy">© 2026 NexBuild</p>
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
  min-height: 105px;
  display: flex;
  justify-content: space-between;
  gap: 48px;
  align-items: center;
}

.nav_footer_brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav_footer_logo {
  flex-shrink: 0;
  color: light-dark(#202733, #ededed);
}

.nav_footer_brand_text {
  display: flex;
  flex-direction: column;
}

.nav_footer_brand_name {
  font-size: 16px;
  font-weight: 750;
  letter-spacing: 2px;
  color: var(--text-primary);
}

.nav_footer_brand_sub {
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--text-label);
}
.nav_footer_github:hover {
  color: var(--text-primary);
  border-color: var(--text-label);
  background: color-mix(in srgb, currentColor 5%, transparent);
}
.nav_footer_github:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 4px;
}

.nav_footer_contact {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}
.nav_footer_contact > p {
  font-size: 12px;
  color: var(--text-label);
  margin-bottom: 12px;
}
.nav_footer_github {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 40px;
  padding: 9px 12px;
  border: 1px solid var(--border-divider);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color .18s ease, border-color .18s ease, background-color .18s ease;
}
.nav_footer_external { margin-left: 16px; font-size: 14px; color: var(--text-label); }

/* 底部分隔 + 版权 */
.nav_footer_bottom {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--border-divider);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.nav_footer_copy,
.nav_footer_tip {
  font-size: 12px;
  color: var(--text-hint);
}
@media (max-width: 640px) {
  .nav_footer_top { flex-direction: column; align-items: flex-start; gap: 20px; }
  .nav_footer_bottom { align-items: flex-start; flex-direction: column; }
}
</style>
