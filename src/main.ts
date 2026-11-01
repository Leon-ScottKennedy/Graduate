import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/styles/main.css'
import './assets/styles/nav_top.css'
import './assets/styles/hero.css'
import './assets/styles/smart_build.css'
import './assets/styles/config_plan.css'
import './assets/styles/hardware_compare.css'
import './assets/styles/visual.css'
import './assets/styles/home-theme.css'
import './assets/styles/theme.css'
import { initializeTheme } from './services/theme'

initializeTheme()

const app = createApp(App)

app.use(router)

app.mount('#app')
