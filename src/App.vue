<template>
  <div class="app-container">
    <div class="nav-menu">
      <button :class="{ active: currentView === 'demo' }" @click="currentView = 'demo'">原始Demo</button>
      <button :class="{ active: currentView === 'demo2' }" @click="currentView = 'demo2'">3D模型查看器</button>
    </div>
    <component :is="currentComponent" />
  </div>
</template>

<script>
import Demo from './components/Demo.vue'
import Demo2 from './components/Demo2.vue'

export default {
  name: 'App',
  components: {
    Demo,
    Demo2
  },
  data() {
    return {
      currentView: 'demo2'
    }
  },
  computed: {
    currentComponent() {
      return this.currentView === 'demo' ? 'Demo' : 'Demo2'
    }
  }
}
</script>

<style>
body {
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.nav-menu {
  display: flex;
  padding: 10px;
  background-color: #333;
  gap: 10px;
}

.nav-menu button {
  padding: 8px 16px;
  border: none;
  background: #555;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.nav-menu button:hover {
  background: #777;
}

.nav-menu button.active {
  background: #4a90e2;
}
</style>
