import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import HomePage from '../views/HomePage.vue'

const router = createRouter({
  history: import.meta.env.MODE === 'pages'
    ? createWebHashHistory(import.meta.env.BASE_URL)
    : createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior() {
    // 切换页面时回到顶部
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage
    },
    {
      path: '/smart-build',
      name: 'smart-build',
      component: () => import('../views/SmartBuildPage.vue')
    },
    {
      path: '/config-plan',
      name: 'config-plan',
      component: () => import('../views/ConfigPlanPage.vue')
    },
    {
      path: '/hardware-compare',
      name: 'hardware-compare',
      component: () => import('../views/HardwareComparePage.vue')
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

export default router
