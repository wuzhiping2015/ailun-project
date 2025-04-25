import { createApp } from 'vue'
import './style.css'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'

// No need to modify main.js - App.vue will load Demo3.vue as a component

const app = createApp(App)

app.use(ElementPlus)
app.mount('#app')