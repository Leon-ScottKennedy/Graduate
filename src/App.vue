<script setup lang="ts">
import NavTop from './components/NavTop.vue'
import AppFooter from './components/AppFooter.vue'
</script>

<template>
  <div class="app">
    <NavTop />
    <main class="app_main">
      <router-view />
    </main>
    <AppFooter />
  </div>
</template>

<style scoped>
/* 页面随内容增长，短页面的页脚保持在视口底部。 */
.app {
  min-height: 100vh;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
}

.app_main {
  flex: 1 0 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

</style>
