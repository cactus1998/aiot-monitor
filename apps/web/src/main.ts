import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { createAppRouter } from './router/index.ts'
import { useConnectionStore } from './stores/connection.ts'
import './styles/base.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(createAppRouter())

// Pick the API client (http or in-browser mock) before the first render.
await useConnectionStore(pinia).init()
app.mount('#app')
