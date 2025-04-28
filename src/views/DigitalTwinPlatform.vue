<template>
  <div class="digital-twin-platform">
    <el-container class="main-container">
      <!-- 顶部导航栏 -->
      <el-header class="platform-header">
        <div class="logo-container">
          <h1 class="platform-title">船舶/工业设备数字孪生监控平台</h1>
        </div>
        <div class="header-controls">
          <el-dropdown>
            <span class="user-profile">
              <i class="el-icon-user"></i>
              工程师
              <i class="el-icon-arrow-down"></i>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item>个人信息</el-dropdown-item>
                <el-dropdown-item>设置</el-dropdown-item>
                <el-dropdown-item>退出</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      
      <el-container class="content-container">
        <!-- 左侧菜单 -->
        <el-aside width="220px" class="platform-sidebar">
          <el-menu
            default-active="monitor"
            class="menu"
            background-color="#1e293b"
            text-color="#e2e8f0"
            active-text-color="#3b82f6"
          >
            <el-menu-item index="overview" @click="changeTab('overview')">
              <i class="el-icon-monitor"></i>
              <span>概览</span>
            </el-menu-item>
            <el-menu-item index="monitor" @click="changeTab('monitor')">
              <i class="el-icon-view"></i>
              <span>3D监控</span>
            </el-menu-item>
            <el-menu-item index="data" @click="changeTab('data')">
              <i class="el-icon-data-line"></i>
              <span>数据分析</span>
            </el-menu-item>
            <el-menu-item index="alarm" @click="changeTab('alarm')">
              <i class="el-icon-warning"></i>
              <span>告警管理</span>
            </el-menu-item>
            <el-menu-item index="maintenance" @click="changeTab('maintenance')">
              <i class="el-icon-set-up"></i>
              <span>预测性维护</span>
            </el-menu-item>
            <el-menu-item index="reports" @click="changeTab('reports')">
              <i class="el-icon-document"></i>
              <span>报表中心</span>
            </el-menu-item>
          </el-menu>
        </el-aside>
        
        <!-- 主内容区域 -->
        <el-main class="platform-main">
          <component :is="activeComponent"></component>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted } from 'vue';
import DigitalTwinMonitor from '../components/digital-twin/DigitalTwinMonitor.vue';
import DigitalTwinOverview from '../components/digital-twin/DigitalTwinOverview.vue';
import DigitalTwinData from '../components/digital-twin/DigitalTwinData.vue';
import DigitalTwinAlarm from '../components/digital-twin/DigitalTwinAlarm.vue';
import DigitalTwinMaintenance from '../components/digital-twin/DigitalTwinMaintenance.vue';
import DigitalTwinReports from '../components/digital-twin/DigitalTwinReports.vue';

// 当前激活的组件
const activeComponent = shallowRef(DigitalTwinMonitor);

// 当前选中的标签页
const currentTab = ref('monitor');

// 切换标签页
const changeTab = (tab) => {
  currentTab.value = tab;
  
  // 根据选中的标签页，显示对应的组件
  switch(tab) {
    case 'overview':
      activeComponent.value = DigitalTwinOverview;
      break;
    case 'monitor':
      activeComponent.value = DigitalTwinMonitor;
      break;
    case 'data':
      activeComponent.value = DigitalTwinData;
      break;
    case 'alarm':
      activeComponent.value = DigitalTwinAlarm;
      break;
    case 'maintenance':
      activeComponent.value = DigitalTwinMaintenance;
      break;
    case 'reports':
      activeComponent.value = DigitalTwinReports;
      break;
    default:
      activeComponent.value = DigitalTwinMonitor;
  }
};

// 组件挂载时的初始化
onMounted(() => {
  // 默认显示监控页面
  changeTab('monitor');
});
</script>

<style>
.digital-twin-platform {
  height: 100%;
  min-height: 100vh;
  width: 100%;
  overflow: hidden;
}

.main-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.platform-header {
  background-color: #0f172a;
  color: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 60px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.logo-container {
  display: flex;
  align-items: center;
}

.logo {
  height: 40px;
  margin-right: 10px;
}

.platform-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.header-controls {
  display: flex;
  align-items: center;
}

.user-profile {
  display: flex;
  align-items: center;
  cursor: pointer;
  color: #e2e8f0;
}

.content-container {
  flex: 1;
  overflow: hidden;
}

.platform-sidebar {
  background-color: #1e293b;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
}

.menu {
  border-right: none;
}

.platform-main {
  background-color: #f1f5f9;
  padding: 20px;
  height: calc(100vh - 60px);
  overflow-y: auto;
}

/* 自定义 Element Plus 图标 */
.el-icon-monitor:before {
  content: "📊";
}
.el-icon-view:before {
  content: "👁️";
}
.el-icon-data-line:before {
  content: "📈";
}
.el-icon-warning:before {
  content: "⚠️";
}
.el-icon-set-up:before {
  content: "🔧";
}
.el-icon-document:before {
  content: "📄";
}
.el-icon-user:before {
  content: "👤";
}
.el-icon-arrow-down:before {
  content: "▼";
}
</style> 