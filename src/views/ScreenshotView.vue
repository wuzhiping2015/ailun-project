<template>
  <div class="screenshot-view">
    <div class="page-header">
      <h1>模型截图管理</h1>
      <p class="description">
        在此页面管理您拍摄的所有模型截图，可以查看、下载或删除截图。
      </p>
    </div>
    
    <!-- 截图列表组件 -->
    <ScreenshotList />
  </div>
</template>

<script setup>
import ScreenshotList from '../components/ScreenshotList.vue';
</script>

<style scoped>
.screenshot-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-header {
  padding: 20px;
  background-color: #f8f8f8;
  border-bottom: 1px solid #e1e1e1;
}

.page-header h1 {
  margin: 0 0 10px 0;
  font-size: 24px;
  color: #333;
}

.description {
  margin: 0;
  color: #666;
  font-size: 14px;
}
</style> 