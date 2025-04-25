<template>
  <div class="model-container">
    <div id="model-viewer"></div>
    <div class="loading-indicator" v-if="!modelLoaded">
      <div class="spinner"></div>
      <span>加载中... {{ loadingProgress }}%</span>
      <div v-if="loadingProgress === 100 && !modelLoaded" class="loading-hint">
        模型加载完成，正在处理中...
        <button @click="retryLoading" class="retry-button">重试加载</button>
      </div>
    </div>
    <div class="error-message" v-if="loadError">
      <div>{{ loadError }}</div>
      <button @click="retryLoading" class="retry-button">重试加载</button>
    </div>
    
    <!-- 控制面板 -->
    <div class="controls-panel">
      <div class="control-group">
        <h3>视图控制</h3>
        <button @click="rotateCameraLeft">← 左旋转</button>
        <button @click="rotateCameraRight">右旋转 →</button>
        <button @click="zoomIn">放大 +</button>
        <button @click="zoomOut">缩小 -</button>
        <button @click="resetCamera">重置视图</button>
      </div>
      
      <div class="control-group">
        <h3>显示选项</h3>
        <label>
          <input type="checkbox" v-model="showGrid" @change="toggleGrid">
          显示网格
        </label>
        <label>
          <input type="checkbox" v-model="showAxes" @change="toggleAxes">
          显示坐标轴
        </label>
        <label>
          <input type="checkbox" v-model="showBoundingBox" @change="toggleBoundingBox">
          显示包围盒
        </label>
        <!-- 新增线框模式选项 -->
        <label>
          <input type="checkbox" v-model="showWireframe" @change="toggleWireframe">
          线框模式
        </label>
      </div>
      
      <!-- 材质控制 -->
      <div class="control-group">
        <h3>材质控制</h3>
        <div class="slider-container">
          <label>金属度</label>
          <input 
            type="range" 
            v-model="metalness" 
            min="0" 
            max="1" 
            step="0.01"
            @input="updateMaterial"
          >
          <span>{{ metalness }}</span>
        </div>
        <div class="slider-container">
          <label>粗糙度</label>
          <input 
            type="range" 
            v-model="roughness" 
            min="0" 
            max="1" 
            step="0.01"
            @input="updateMaterial"
          >
          <span>{{ roughness }}</span>
        </div>
      </div>

      <!-- 新增：性能优化控制 -->
      <div class="control-group">
        <h3>性能优化</h3>
        <label>
          <input type="checkbox" v-model="useSimplifiedModel">
          简化模型
        </label>
        <div class="slider-container" v-if="useSimplifiedModel">
          <label>简化率</label>
          <input 
            type="range" 
            v-model="simplificationRatio" 
            min="0.1" 
            max="0.9" 
            step="0.1"
          >
          <span>{{ simplificationRatio }}</span>
        </div>
        <button @click="reloadModel">重新加载模型</button>
      </div>

      <!-- 增加拆解模型按钮 -->
      <div class="control-group">
        <h3>模型操作</h3>
        <button v-if="!isMeshDecompose" @click="decomposeMesh">拆解模型</button>
        <button v-if="isMeshDecompose" @click="mergeMesh">合并模型</button>
      </div>
    </div>

    <!-- 部件列表面板 -->
    <div class="parts-panel" v-if="modelLoaded && partsList.length > 0">
      <h3>部件列表</h3>
      <div class="search-box">
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="搜索部件..."
        >
      </div>
      <div class="parts-list">
        <div 
          v-for="part in filteredParts" 
          :key="part.id"
          :class="['part-item', {active: selectedPart && selectedPart.id === part.id}]"
          @mouseenter="onPartMouseEnter(part)"
          @mouseleave="onPartMouseLeave(part)"
          @click="selectPart(part)"
        >
          <span class="part-name">{{ part.name }}</span>
        </div>
        <div v-if="filteredParts.length === 0" class="no-parts">
          没有找到匹配的部件
        </div>
      </div>
    </div>
    
    <!-- 部件详情面板 -->
    <div class="part-details-panel" v-if="selectedPart">
      <div class="panel-header">
        <h3>部件详情</h3>
        <button class="close-btn" @click="clearSelectedPart">&times;</button>
      </div>
      <div class="details-content">
        <div class="detail-item">
          <span>名称:</span>
          <span>{{ selectedPart.name }}</span>
        </div>
        <div class="detail-item">
          <span>类型:</span>
          <span>{{ selectedPart.type }}</span>
        </div>
        <div class="detail-item">
          <span>材质:</span>
          <span>{{ selectedPart.materialType }}</span>
        </div>
        <div class="detail-item">
          <span>尺寸:</span>
          <span>{{ selectedPart.dimensions }}</span>
        </div>
        <div class="detail-item">
          <span>位置:</span>
          <span>{{ formatVector(selectedPart.position) }}</span>
        </div>
        <div class="detail-item">
          <span>体积:</span>
          <span>{{ selectedPart.volume || '未知' }} m³</span>
        </div>
        <div class="detail-item">
          <span>描述:</span>
          <span>{{ selectedPart.description }}</span>
        </div>
      </div>
    </div>
    
    <!-- 悬停提示 -->
    <div class="hover-info" v-if="hoveredPart && (!selectedPart || hoveredPart.id !== selectedPart.id)">
      {{ hoveredPart.name }}
    </div>
    
    <!-- 模型信息面板 -->
    <div class="model-info-panel" v-if="modelLoaded">
      <h3>模型信息</h3>
      <div class="info-item">
        <span>顶点数量:</span>
        <span>{{ modelInfo.vertices }}</span>
      </div>
      <div class="info-item">
        <span>面片数量:</span>
        <span>{{ modelInfo.faces }}</span>
      </div>
      <div class="info-item">
        <span>材质数量:</span>
        <span>{{ modelInfo.materials }}</span>
      </div>
      <div class="info-item">
        <span>尺寸(m):</span>
        <span>{{ modelInfo.dimensions }}</span>
      </div>
      
      <!-- 新增：性能信息 -->
      <div class="performance-info">
        <div class="info-item">
          <span>FPS:</span>
          <span>{{ perfMonitor.fps }}</span>
        </div>
        <div class="info-item" v-if="perfMonitor.memoryUsage">
          <span>内存:</span>
          <span>{{ perfMonitor.memoryUsage }} MB</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { markRaw, ref, reactive, onMounted, onBeforeUnmount, computed, nextTick } from "vue";

// 新增：几何体简化
import { SimplifyModifier } from "three/examples/jsm/modifiers/SimplifyModifier.js";
// 新增：加载进度管理
import { LoadingManager } from "three";

// 状态定义
const scene = ref(null);
const camera = ref(null);
const renderer = ref(null);
const controls = ref(null);
const model = ref(null);
let animationFrameId = null;
const clock = new THREE.Clock();
const initialCameraPosition = new THREE.Vector3(0, 0, 5);
const modelLoaded = ref(false);
const loadError = ref(null);
const loadingProgress = ref(0);
const modelInfo = reactive({
  vertices: 0,
  faces: 0,
  materials: 0,
  dimensions: '0 x 0 x 0'
});
const nonReactiveObjects = reactive({
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  model: null,
  originalMaterials: new Map(),
  mouse: { x: 0, y: 0 },
  raycaster: null,
});
const showGrid = ref(true);
const showAxes = ref(true);
const showBoundingBox = ref(false);
const metalness = ref(0.8);  // 默认金属度
const roughness = ref(0.2);  // 默认粗糙度
const partsList = ref([]);
const hoveredPart = ref(null);
const selectedPart = ref(null);
const isMeshDecompose = ref(false); // 是否拆解模型
const searchQuery = ref(''); // 搜索查询
let highlightMaterial = null; // 高亮材质
let selectedMaterial = null; // 选中材质
const showWireframe = ref(false); // 新增：显示线框
const useSimplifiedModel = ref(false); // 新增：使用简化模型
const simplificationRatio = ref(0.5); // 新增：简化比例

// 新增：定义LOD层级
const LOD_LEVELS = {
  HIGH: 0,   // 原始模型
  MEDIUM: 0.5, // 中等简化
  LOW: 0.8   // 高度简化
};

// 新增：性能监控对象
const perfMonitor = reactive({
  fps: 0,
  lastFrameTime: 0,
  frameCount: 0,
  lastFpsUpdateTime: 0,
  memoryUsage: 0
});

// 过滤部件列表
const filteredParts = computed(() => {
  if (!searchQuery.value) return partsList.value;
  const query = searchQuery.value.toLowerCase();
  return partsList.value.filter(part => 
    part.name.toLowerCase().includes(query) || 
    part.type.toLowerCase().includes(query)
  );
});

// 初始化Three.js
const initThreeJS = () => {
  try {
    const sceneObj = markRaw(new THREE.Scene());
    sceneObj.background = new THREE.Color(0x222222);
    
    // 环境光照
    const ambientLight = markRaw(new THREE.AmbientLight(0xffffff, 0.4));
    sceneObj.add(ambientLight);

    // 主平行光（模拟太阳光）
    const mainLight = markRaw(new THREE.DirectionalLight(0xffffff, 1.0));
    mainLight.position.set(5, 10, 7.5);
    mainLight.castShadow = true;
    
    // 优化阴影质量 - 针对性能优化降低阴影贴图分辨率
    mainLight.shadow.mapSize.width = 1024; // 从2048降低到1024
    mainLight.shadow.mapSize.height = 1024; // 从2048降低到1024
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 500;
    // 优化阴影相机视锥体，减少阴影计算范围
    mainLight.shadow.camera.left = -10;
    mainLight.shadow.camera.right = 10;
    mainLight.shadow.camera.top = 10;
    mainLight.shadow.camera.bottom = -10;
    sceneObj.add(mainLight);

    // 添加填充光（背光）
    const fillLight = markRaw(new THREE.DirectionalLight(0xffffff, 0.4));
    fillLight.position.set(-5, 5, -7.5);
    sceneObj.add(fillLight);

    // 添加环境半球光
    const hemiLight = markRaw(new THREE.HemisphereLight(0xffffff, 0x444444, 0.4));
    hemiLight.position.set(0, 20, 0);
    sceneObj.add(hemiLight);

    nonReactiveObjects.scene = sceneObj;
    scene.value = sceneObj;
    
    // 获取容器并设置相机
    const container = document.getElementById("model-viewer");
    if (!container) {
      throw new Error("找不到model-viewer容器元素");
    }

    // 设置相机
    const cameraObj = markRaw(new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    ));
    cameraObj.position.copy(initialCameraPosition);
    cameraObj.lookAt(0, 0, 0);
    
    nonReactiveObjects.camera = cameraObj;
    camera.value = cameraObj;

    // 创建渲染器
    const rendererObj = markRaw(new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true,
      powerPreference: "high-performance" // 新增：优先选择高性能GPU
    }));
    
    rendererObj.setSize(container.clientWidth, container.clientHeight);
    rendererObj.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 确保不超过2的像素比
    rendererObj.shadowMap.enabled = true;
    rendererObj.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererObj.outputColorSpace = THREE.SRGBColorSpace;
    rendererObj.toneMapping = THREE.ACESFilmicToneMapping;
    
    // 新增：优化渲染器性能设置
    rendererObj.sortObjects = false; // 禁用对象排序，提高性能
    rendererObj.physicallyCorrectLights = false; // 关闭物理正确光照，降低计算量
    
    nonReactiveObjects.renderer = rendererObj;
    renderer.value = rendererObj;

    container.appendChild(rendererObj.domElement);

    // 设置轨道控制器
    const controlsObj = markRaw(new OrbitControls(cameraObj, rendererObj.domElement));
    controlsObj.enableDamping = true;
    controlsObj.dampingFactor = 0.05;
    controlsObj.enablePan = true;
    controlsObj.minDistance = 1;
    controlsObj.maxDistance = 20;
    controlsObj.maxPolarAngle = Math.PI / 1.5;
    controlsObj.update();
    
    nonReactiveObjects.controls = controlsObj;
    controls.value = controlsObj;

    // 添加网格辅助线
    const gridHelper = markRaw(new THREE.GridHelper(20, 20, 0x555555, 0x333333));
    gridHelper.name = "gridHelper";
    sceneObj.add(gridHelper);

    // 添加坐标轴辅助
    const axesHelper = markRaw(new THREE.AxesHelper(5));
    axesHelper.name = "axesHelper";
    sceneObj.add(axesHelper);

    // 初始化射线投射器
    nonReactiveObjects.raycaster = markRaw(new THREE.Raycaster());

    // 添加鼠标事件监听
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('click', onMouseClick);

    // 创建高亮材质
    const highlightMat = markRaw(new THREE.MeshStandardMaterial({
      color: 0xff9500,
      emissive: 0xff4400,
      emissiveIntensity: 0.4,
      metalness: 0.8,
      roughness: 0.2,
      transparent: true,
      opacity: 0.9
    }));
    
    // 创建选中材质
    const selectMat = markRaw(new THREE.MeshStandardMaterial({
      color: 0x44aaff,
      emissive: 0x0088ff,
      emissiveIntensity: 0.6,
      metalness: 0.8,
      roughness: 0.2,
      transparent: true,
      opacity: 1
    }));
    
    // 设置材质引用
    highlightMaterial = highlightMat;
    selectedMaterial = selectMat;

    // 开始动画循环
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      const currentCamera = nonReactiveObjects.camera;
      const currentScene = nonReactiveObjects.scene;
      const currentRenderer = nonReactiveObjects.renderer;
      const currentControls = nonReactiveObjects.controls;
      
      if (currentControls) {
        currentControls.update();
      }

      // 新增：性能监控
      const now = performance.now();
      perfMonitor.frameCount++;
      
      // 每秒更新一次FPS计数
      if (now - perfMonitor.lastFpsUpdateTime > 1000) {
        perfMonitor.fps = Math.round((perfMonitor.frameCount * 1000) / (now - perfMonitor.lastFpsUpdateTime));
        perfMonitor.frameCount = 0;
        perfMonitor.lastFpsUpdateTime = now;
        
        // 更新内存使用情况（如果浏览器支持）
        if (window.performance && performance.memory) {
          perfMonitor.memoryUsage = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
        }
      }

      // 检查鼠标射线交点 - 性能优化：降低射线投射频率
      if (perfMonitor.frameCount % 2 === 0) { // 每两帧检查一次
        checkIntersection();
      }

      if (currentScene && currentCamera && currentRenderer) {
        currentRenderer.render(currentScene, currentCamera);
      }
    };
    
    animate();
  } catch (err) {
    console.error("初始化Three.js错误:", err);
    loadError.value = `初始化错误: ${err.message}`;
  }
};

// 加载模型
const loadModel = () => {
  modelLoaded.value = false;
  loadError.value = null;
  loadingProgress.value = 0;
  
  console.log("开始加载阀门.gltf模型，当前路径：", window.location.href);
  
  // 清理旧模型资源
  cleanupModel();
  
  // 新增：创建加载管理器
  const loadingManager = new LoadingManager();
  loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
    loadingProgress.value = Math.round((itemsLoaded / itemsTotal) * 100);
    console.log(`加载进度: ${loadingProgress.value}% (${url})`);
  };
  
  loadingManager.onError = (url) => {
    console.error("加载出错:", url);
    loadError.value = `加载出错: ${url}`;
  };

  loadingManager.onLoad = () => {
    console.log("所有资源加载完成");
  };
  
  const loader = new GLTFLoader(loadingManager);
  
  // 添加DRACO压缩支持
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  dracoLoader.setDecoderConfig({ type: 'js' });
  loader.setDRACOLoader(dracoLoader);

  // 尝试多种可能的路径
  const possiblePaths = [
    './阀门.gltf',
    '/阀门.gltf',
    '阀门.gltf',
    '/public/阀门.gltf',
    '../public/阀门.gltf',
    // 添加带时间戳的URL，避免缓存问题
    `/阀门.gltf?t=${Date.now()}`,
    // 添加绝对路径
    `${window.location.origin}/阀门.gltf`,
    // 尝试加载其他可用模型
    '/阀门.gltf',
    '/PrimaryIonDrive.glb'
  ];
  
  console.log("尝试加载以下路径:", possiblePaths);
  
  // 使用第一个路径尝试加载
  tryLoadModel(loader, possiblePaths, 0);
};

// 尝试按顺序加载不同路径的模型
const tryLoadModel = (loader, paths, index) => {
  if (index >= paths.length) {
    loadError.value = "所有可能的模型路径均加载失败";
    console.error("所有路径都尝试失败");
    return;
  }
  
  const path = paths[index];
  console.log(`尝试加载路径 (${index+1}/${paths.length}): ${path}`);
  
  loader.load(
    path,
    (gltf) => {
      try {
        console.log(`${path} 模型加载成功:`, gltf);
        console.log({
          animations: gltf.animations?.length || 0,
          scenes: gltf.scenes?.length || 0,
          cameras: gltf.cameras?.length || 0,
          assets: gltf.asset
        });
        
        if (!gltf.scene) {
          throw new Error("加载的模型没有场景数据");
        }
        
        // 使用markRaw防止Vue的响应式系统代理Three.js对象
        const sceneObj = markRaw(gltf.scene);
        
        // 新增：根据选项决定是否简化模型
        if (useSimplifiedModel.value) {
          console.log("开始简化模型...");
          // 使用延迟处理，避免阻塞主线程
          simplifyModelAsync(sceneObj).then(simplifiedModel => {
            console.log("模型简化完成，正在处理...");
            processModel(simplifiedModel);
          }).catch(err => {
            console.error("模型简化错误:", err);
            loadError.value = `模型简化错误: ${err.message}`;
            // 如果简化失败，使用原始模型
            processModel(sceneObj);
          });
        } else {
          processModel(sceneObj);
        }
      } catch (err) {
        console.error(`${path} 模型处理错误:`, err);
        loadError.value = `模型处理错误: ${err.message}`;
        // 尝试下一个路径
        tryLoadModel(loader, paths, index + 1);
      }
    },
    // 进度回调
    (xhr) => {
      if (xhr.lengthComputable) {
        const progressPercentage = Math.round((xhr.loaded / xhr.total) * 100);
        console.log(`${path} 加载进度: ${progressPercentage}%`);
      }
    },
    // 错误回调
    (error) => {
      console.error(`${path} 模型加载错误:`, error);
      // 尝试下一个路径
      tryLoadModel(loader, paths, index + 1);
    }
  );
};

// 新增：模型简化函数
const simplifyModelAsync = (modelObj) => {
  return new Promise((resolve, reject) => {
    try {
      // 使用setTimeout让UI有机会更新并显示加载进度
      setTimeout(() => {
        try {
          // 克隆模型以避免修改原始模型
          const simplifiedModel = modelObj.clone();
          const modifier = new SimplifyModifier();
          let simplificationErrors = 0;
          
          // 遍历模型中的所有网格
          simplifiedModel.traverse((object) => {
            if (object.isMesh && object.geometry) {
              // 只处理顶点数量超过阈值的网格
              const vertexCount = object.geometry.attributes.position.count;
              if (vertexCount > 100) {
                try {
                  console.log(`简化前顶点数: ${vertexCount}`);
                  
                  // 检查几何体是否有效，避免处理非索引几何体
                  if (!object.geometry.index) {
                    console.warn(`跳过非索引几何体 (${object.name})`);
                    return;
                  }
                  
                  // 计算要保留的顶点数
                  const targetCount = Math.max(100, Math.floor(vertexCount * (1 - simplificationRatio.value * 0.5)));
                  
                  // 保存原始UV，法线等属性
                  const hasUV = object.geometry.attributes.uv !== undefined;
                  const hasNormal = object.geometry.attributes.normal !== undefined;
                  
                  // 尝试执行简化
                  const originalGeometry = object.geometry.clone();
                  try {
                    object.geometry = modifier.modify(object.geometry, targetCount);
                    console.log(`简化后顶点数: ${object.geometry.attributes.position.count}`);
                  } catch (simplifyError) {
                    console.warn(`简化网格几何体失败 (${object.name}):`, simplifyError);
                    // 恢复原始几何体
                    object.geometry = originalGeometry;
                    simplificationErrors++;
                  }
                  
                  // 如果有法线但简化后丢失，重新计算
                  if (hasNormal && !object.geometry.attributes.normal) {
                    object.geometry.computeVertexNormals();
                  }
                  
                  // UV丢失是常见的，可能需要在材质中处理
                  if (hasUV && !object.geometry.attributes.uv) {
                    console.warn("UV坐标在简化过程中丢失，可能影响纹理显示");
                  }
                } catch (simplifyError) {
                  console.warn(`简化网格时出错 (${object.name}):`, simplifyError);
                  simplificationErrors++;
                  // 如果简化失败，继续使用原始几何体
                }
              }
            }
          });
          
          if (simplificationErrors > 0) {
            console.warn(`${simplificationErrors}个网格简化出错，但处理继续进行`);
          }
          
          resolve(simplifiedModel);
        } catch (err) {
          console.error("模型简化过程中出现严重错误:", err);
          // 如果简化过程完全失败，返回原始模型
          resolve(modelObj.clone());
        }
      }, 100);
    } catch (err) {
      reject(err);
    }
  });
};

// 处理模型
const processModel = (modelObj) => {
  try {
    // Ensure model is not reactive
    modelObj = markRaw(modelObj);
    
    const currentScene = nonReactiveObjects.scene;
    if (!currentScene) {
      throw new Error("场景未初始化");
    }

    // 清除旧模型
    const oldModel = currentScene.getObjectByName("loadedModel");
    if (oldModel) {
      currentScene.remove(oldModel);
    }
    
    // 设置模型名称
    modelObj.name = "loadedModel";
    
    // 计算包围盒
    const box = markRaw(new THREE.Box3().setFromObject(modelObj));
    const size = markRaw(new THREE.Vector3());
    const center = markRaw(new THREE.Vector3());
    box.getSize(size);
    box.getCenter(center);
    
    // 计算合适的缩放比例
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? 5 / maxDim : 1;
    
    // 设置模型变换
    modelObj.scale.setScalar(scale);
    modelObj.position.copy(center).multiplyScalar(-scale);
    
    // 确保模型居中显示在场景中
    const adjustedBox = new THREE.Box3().setFromObject(modelObj);
    const adjustedCenter = new THREE.Vector3();
    adjustedBox.getCenter(adjustedCenter);
    modelObj.position.sub(adjustedCenter);
    
    // 清空部件列表
    partsList.value = [];
    nonReactiveObjects.originalMaterials.clear();
    
    // 新增：实例化材质复用映射
    const materialCache = new Map();
    
    // 遍历模型所有网格并添加金属质感
    let partId = 0;
    let totalVertices = 0;
    let geometryCache = new Map(); // 几何体缓存，用于复用相同的几何体
    
    modelObj.traverse((object) => {
      if (object.isMesh) {
        // 统计顶点数用于性能评估
        if (object.geometry.attributes.position) {
          totalVertices += object.geometry.attributes.position.count;
        }
        
        // 复用几何体：如果几何体相同，直接引用而不是创建新实例
        const geoKey = object.geometry.uuid;
        if (!geometryCache.has(geoKey)) {
          geometryCache.set(geoKey, object.geometry);
        } else {
          // 如果该几何体已经存在，使用缓存的实例
          object.geometry = geometryCache.get(geoKey);
        }
        
        // 为所有网格添加金属质感材质
        const originalMaterial = object.material;
        
        // 获取材质的唯一键（考虑颜色和纹理）
        const matKey = originalMaterial ? 
          (originalMaterial.color ? originalMaterial.color.getHex() : 0) + 
          (originalMaterial.map ? originalMaterial.map.uuid : '')
          : 'default';
        
        // 如果材质已经在缓存中，直接使用
        if (materialCache.has(matKey)) {
          object.material = materialCache.get(matKey);
        } else {
          // 创建新材质
          const newMaterial = new THREE.MeshStandardMaterial({
            color: originalMaterial ? originalMaterial.color : 0x888888,
            metalness: metalness.value,
            roughness: roughness.value,
            envMapIntensity: 1.0,
            wireframe: showWireframe.value,
            // 新增：优化性能的材质设置
            flatShading: true, // 平面着色可以减少一些GPU负担
            dithering: false, // 关闭抖动
          });
          
          // 保留原始纹理(如果有)
          if (originalMaterial && originalMaterial.map) {
            newMaterial.map = originalMaterial.map;
            newMaterial.map.anisotropy = 4; // 降低各向异性过滤，提高性能
          }
          
          // 缓存材质以便复用
          materialCache.set(matKey, newMaterial);
          object.material = newMaterial;
        }
        
        // 启用阴影 - 根据对象大小决定是否投射阴影，小物体不投射可提高性能
        const boundingBox = new THREE.Box3().setFromObject(object);
        const objSize = boundingBox.getSize(new THREE.Vector3());
        const objVolume = objSize.x * objSize.y * objSize.z;
        
        if (objVolume > 0.1) { // 只有较大的对象才投射阴影
          object.castShadow = true;
        } else {
          object.castShadow = false;
        }
        object.receiveShadow = true;
        
        // 新增：保存原始材质
        nonReactiveObjects.originalMaterials.set(object.uuid, object.material);
        
        // 新增：为每个网格设置唯一ID，并加入部件列表
        object.userData.partId = partId++;
        
        // 获取部件名称
        const partName = object.name || `部件 ${object.userData.partId}`;
        
        // 添加到部件列表
        const partPosition = new THREE.Vector3();
        object.getWorldPosition(partPosition);
        
        const partBox = new THREE.Box3().setFromObject(object);
        const partSize = new THREE.Vector3();
        partBox.getSize(partSize);
        
        // 只添加一定大小以上的部件到列表，减少部件数量
        const partVolume = partSize.x * partSize.y * partSize.z;
        if (partVolume > 0.01) {
          partsList.value.push({
            id: object.userData.partId,
            name: partName,
            object: object,
            position: partPosition,
            dimensions: `${partSize.x.toFixed(2)} x ${partSize.y.toFixed(2)} x ${partSize.z.toFixed(2)}`,
            materialType: '金属材质',
            type: object.userData.type || '标准部件',
            description: object.userData.description || '这是发电机的标准部件',
            volume: partVolume.toFixed(3) // 新增部件体积信息
          });
        }
      }
    });
    
    console.log(`处理完成: 总顶点数${totalVertices}, 部件数${partsList.value.length}`);
    
    // 对部件列表进行排序
    partsList.value.sort((a, b) => a.name.localeCompare(b.name));

    // 添加到场景
    currentScene.add(modelObj);
    
    // 更新包围盒辅助对象
    const boundingBox = markRaw(new THREE.BoxHelper(modelObj, 0xff0000));
    boundingBox.name = "modelBoxHelper";
    boundingBox.visible = showBoundingBox.value;
    currentScene.add(boundingBox);
    
    // 强制渲染一帧
    const currentRenderer = nonReactiveObjects.renderer;
    const currentCamera = nonReactiveObjects.camera;
    if (currentRenderer && currentScene && currentCamera) {
      currentRenderer.render(currentScene, currentCamera);
    }
    
    modelLoaded.value = true;
    loadError.value = null;
    
    // 保存模型引用
    nonReactiveObjects.model = modelObj;
    model.value = modelObj;
    
    // 更新模型信息
    updateModelInfo(modelObj);
    
    // 如果部件列表不为空，自动聚焦到第一个部件
    if (partsList.value.length > 0) {
      // 延迟聚焦，确保模型已完全加载
      setTimeout(() => {
        focusOnPart(partsList.value[0]);
      }, 1000);
    }
    
    // 清理不再需要的缓存
    geometryCache.clear();
    materialCache.clear();
    
    // 确保模型在视野内
    setTimeout(() => {
      fitCameraToModel(modelObj);
    }, 500);
    
  } catch (err) {
    console.error("处理模型时出错:", err);
    loadError.value = `处理模型错误: ${err.message}`;
    throw err;
  }
};

// 新增：自动调整相机以显示整个模型
const fitCameraToModel = (modelObj) => {
  if (!modelObj) return;
  
  // 计算包围盒
  const box = new THREE.Box3().setFromObject(modelObj);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  
  // 计算视角距离
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = nonReactiveObjects.camera.fov * (Math.PI / 180);
  const cameraDistance = Math.abs(maxDim / (2 * Math.tan(fov / 2)));
  
  // 设置相机位置和控制器目标
  const controls = nonReactiveObjects.controls;
  const camera = nonReactiveObjects.camera;
  
  if (controls && camera) {
    // 设置控制器目标为模型中心
    controls.target.copy(center);
    
    // 计算相机位置
    const cameraPosition = new THREE.Vector3(
      center.x,
      center.y,
      center.z + cameraDistance * 1.5 // 额外增加1.5倍距离确保全部可见
    );
    
    camera.position.copy(cameraPosition);
    controls.update();
  }
};

// 更新材质
const updateMaterial = () => {
  const currentModel = nonReactiveObjects.model;
  if (!currentModel) return;
  
  currentModel.traverse((object) => {
    if (object.isMesh && object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(mat => {
          if (mat.isMeshStandardMaterial) {
            mat.metalness = metalness.value;
            mat.roughness = roughness.value;
            mat.needsUpdate = true;
          }
        });
      } else if (object.material.isMeshStandardMaterial) {
        object.material.metalness = metalness.value;
        object.material.roughness = roughness.value;
        object.material.needsUpdate = true;
      }
    }
  });
};

// 清理模型资源
const cleanupModel = () => {
  const currentScene = nonReactiveObjects.scene;
  if (!currentScene) return;
  
  const oldModel = currentScene.getObjectByName("loadedModel");
  if (oldModel) {
    // 在删除模型前，确保从缓存中移除所有对应材质
    oldModel.traverse((object) => {
      if (object.isMesh) {
        if (nonReactiveObjects.originalMaterials.has(object.uuid)) {
          nonReactiveObjects.originalMaterials.delete(object.uuid);
        }
        
        // 清除所有自定义属性
        if (object.userData.partId !== undefined) {
          // 断开对象与部件列表中项目的双向关联
          const partIndex = partsList.value.findIndex(p => p.id === object.userData.partId);
          if (partIndex !== -1) {
            // 避免循环引用
            partsList.value[partIndex].object = null;
          }
        }
        
        // 清除拆解相关的属性
        if (object.position_0) {
          object.position_0 = null;
        }
        if (object.decomposeDirection) {
          object.decomposeDirection = null;
        }
      }
    });
    
    // 从场景中移除
    currentScene.remove(oldModel);
    
    // 递归处理模型以释放内存
    oldModel.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
        object.geometry = null;
      }
      
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => {
            disposeMaterial(material);
          });
          object.material.length = 0; // 清空数组
        } else {
          disposeMaterial(object.material);
          object.material = null;
        }
      }
    });
  }

  const oldBoxHelper = currentScene.getObjectByName("modelBoxHelper");
  if (oldBoxHelper) {
    currentScene.remove(oldBoxHelper);
  }
  
  // 清空部件列表
  partsList.value = [];
  
  // 清空材质缓存
  nonReactiveObjects.originalMaterials.clear();
  
  // 清空选中和悬停状态
  selectedPart.value = null;
  hoveredPart.value = null;
  
  // 移除射线投射缓存
  if (nonReactiveObjects.intersectMeshes) {
    nonReactiveObjects.intersectMeshes = null;
  }
  
  // 提示垃圾回收
  if (oldModel) {
    console.log('已清理模型资源，等待垃圾回收');
  }
};

// 辅助函数来处理材质及其相关纹理
const disposeMaterial = (material) => {
  if (!material) return;
  
  // 处理材质纹理
  const disposeTexture = (texture) => {
    if (!texture) return;
    
    // 释放GPU资源
    texture.dispose();
    
    // 清除可能的事件监听器
    if (texture.image && texture.image.removeEventListener) {
      texture.image.removeEventListener('load', null);
      texture.image.removeEventListener('error', null);
    }
  };
  
  // 处理所有可能的纹理
  if (material.map) disposeTexture(material.map);
  if (material.lightMap) disposeTexture(material.lightMap);
  if (material.bumpMap) disposeTexture(material.bumpMap);
  if (material.normalMap) disposeTexture(material.normalMap);
  if (material.displacementMap) disposeTexture(material.displacementMap);
  if (material.specularMap) disposeTexture(material.specularMap);
  if (material.emissiveMap) disposeTexture(material.emissiveMap);
  if (material.alphaMap) disposeTexture(material.alphaMap);
  if (material.aoMap) disposeTexture(material.aoMap);
  if (material.metalnessMap) disposeTexture(material.metalnessMap);
  if (material.roughnessMap) disposeTexture(material.roughnessMap);
  if (material.envMap) disposeTexture(material.envMap);
  
  // 清理其他可能的纹理引用
  if (material.gradientMap) disposeTexture(material.gradientMap);
  if (material.transmission) disposeTexture(material.transmissionMap);
  if (material.thicknessMap) disposeTexture(material.thicknessMap);
  if (material.sheenColorMap) disposeTexture(material.sheenColorMap);
  if (material.sheenRoughnessMap) disposeTexture(material.sheenRoughnessMap);
  if (material.clearcoatMap) disposeTexture(material.clearcoatMap);
  if (material.clearcoatNormalMap) disposeTexture(material.clearcoatNormalMap);
  if (material.clearcoatRoughnessMap) disposeTexture(material.clearcoatRoughnessMap);

  // 释放材质本身
  material.dispose();
};

// 清理所有资源
const cleanup = () => {
  try {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    // 获取非响应式引用
    const currentRenderer = nonReactiveObjects.renderer;
    const currentScene = nonReactiveObjects.scene;
    const currentControls = nonReactiveObjects.controls;

    // 清理鼠标事件监听
    const container = document.getElementById("model-viewer");
    if (container) {
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('click', onMouseClick);
    }

    // 清理模型资源
    cleanupModel();

    // 清理渲染器
    if (currentRenderer) {
      // 确保移除所有事件监听
      if (currentRenderer.domElement) {
        const element = currentRenderer.domElement;
        element.oncontextmenu = null;
        element.onfocus = null;
        element.onblur = null;
        element.onmousedown = null;
        element.onmouseup = null;
        element.onmousemove = null;
      }
      
      currentRenderer.dispose();
      
      if (container && container.contains(currentRenderer.domElement)) {
        container.removeChild(currentRenderer.domElement);
      }
    }

    // 清理控制器
    if (currentControls) {
      currentControls.dispose();
    }

    // 清理场景
    if (currentScene) {
      // 移除所有对象
      while(currentScene.children.length > 0) { 
        const object = currentScene.children[0];
        currentScene.remove(object);
        
        // 递归处理对象
        if (object.traverse) {
          object.traverse((child) => {
            if (child.geometry) {
              child.geometry.dispose();
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(disposeMaterial);
              } else {
                disposeMaterial(child.material);
              }
            }
          });
        }
      }
      currentScene.clear();
    }
    
    // 重置非响应式对象
    Object.assign(nonReactiveObjects, {
      scene: null,
      camera: null,
      renderer: null,
      controls: null,
      model: null,
      raycaster: null,
      mouse: { x: 0, y: 0 },
      originalMaterials: new Map(),
      intersectMeshes: null,
      lastModelUpdate: null
    });
    
    // 清空部件列表和状态
    partsList.value = [];
    selectedPart.value = null;
    hoveredPart.value = null;
    modelLoaded.value = false;
    loadError.value = null;
    loadingProgress.value = 0;
    
    console.log("清理完成，等待垃圾回收");
  } catch (err) {
    console.error("清理资源时出错:", err);
  }
};

// 窗口大小调整
const onWindowResize = () => {
  try {
    const container = document.getElementById("model-viewer");
    if (!container) return;
    
    const currentCamera = nonReactiveObjects.camera;
    const currentRenderer = nonReactiveObjects.renderer;
    
    if (!currentCamera || !currentRenderer) return;

    // 更新相机
    currentCamera.aspect = container.clientWidth / container.clientHeight;
    currentCamera.updateProjectionMatrix();
    
    // 更新渲染器
    currentRenderer.setSize(container.clientWidth, container.clientHeight);
  } catch (err) {
    console.error("窗口大小调整错误:", err);
  }
};

// 相机控制方法
const rotateCameraLeft = () => {
  const currentControls = nonReactiveObjects.controls;
  if (currentControls) {
    currentControls.rotateLeft(Math.PI / 12);
    currentControls.update();
  }
};

// 相机右转
const rotateCameraRight = () => {
  const currentControls = nonReactiveObjects.controls;
  if (currentControls) {
    currentControls.rotateLeft(-Math.PI / 12);
    currentControls.update();
  }
};

// 放大
const zoomIn = () => {
  const currentControls = nonReactiveObjects.controls;
  if (currentControls) {
    currentControls.dollyIn(1.2);
    currentControls.update();
  }
};

// 缩小
const zoomOut = () => {
  const currentControls = nonReactiveObjects.controls;
  if (currentControls) {
    currentControls.dollyOut(1.2);
    currentControls.update();
  }
};

// 重置相机
const resetCamera = () => {
  const currentCamera = nonReactiveObjects.camera;
  const currentControls = nonReactiveObjects.controls;
  
  if (currentCamera && currentControls) {
    currentCamera.position.copy(initialCameraPosition);
    currentCamera.lookAt(0, 0, 0);
    currentControls.target.set(0, 0, 0);
    currentControls.update();
  }
};

// 切换网格显示
const toggleGrid = () => {
  const currentScene = nonReactiveObjects.scene;
  if (currentScene) {
    const gridHelper = currentScene.getObjectByName("gridHelper");
    if (gridHelper) {
      gridHelper.visible = showGrid.value;
    }
  }
};

// 切换坐标轴显示
const toggleAxes = () => {
  const currentScene = nonReactiveObjects.scene;
  if (currentScene) {
    const axesHelper = currentScene.getObjectByName("axesHelper");
    if (axesHelper) {
      axesHelper.visible = showAxes.value;
    }
  }
};

// 清理包围盒
const toggleBoundingBox = () => {
  const currentScene = nonReactiveObjects.scene;
  if (currentScene) {
    const boundingBox = currentScene.getObjectByName("modelBoxHelper");
    if (boundingBox) {
      boundingBox.visible = showBoundingBox.value;
    }
  }
};

// 更新模型信息
const updateModelInfo = (modelObj) => {
  let vertices = 0;
  let faces = 0;
  let materials = 0;

  modelObj.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      if (object.geometry instanceof THREE.BufferGeometry) {
        const geometry = object.geometry;
        vertices += geometry.attributes.position ? geometry.attributes.position.count : 0;
        faces += geometry.index ? geometry.index.count / 3 : 0;
      }
      
      if (Array.isArray(object.material)) {
        materials += object.material.length;
      } else if (object.material) {
        materials++;
      }
    }
  });

  const box = markRaw(new THREE.Box3().setFromObject(modelObj));
  const size = markRaw(new THREE.Vector3());
  box.getSize(size);
  
  Object.assign(modelInfo, {
    vertices,
    faces,
    materials,
    dimensions: `${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`
  });
  
  // 根据模型大小调整相机的视锥体
  const maxDim = Math.max(size.x, size.y, size.z);
  const camera = nonReactiveObjects.camera;
  if (camera) {
    camera.near = 0.01;
    camera.far = Math.max(1000, maxDim * 20);
    camera.updateProjectionMatrix();
  }
};

// 新增：鼠标移动事件处理
const onMouseMove = (event) => {
  const container = document.getElementById("model-viewer");
  if (!container) return;
  
  // 计算鼠标在容器中的相对位置
  const rect = container.getBoundingClientRect();
  nonReactiveObjects.mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
  nonReactiveObjects.mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
};

// 新增：鼠标点击事件处理
const onMouseClick = () => {
  // 如果有悬停的部件，选中它
  if (hoveredPart.value) {
    selectPart(hoveredPart.value);
  } else {
    // 点击空白处取消选择
    clearSelectedPart();
  }
};

// 新增：检查射线与模型的交点
const checkIntersection = () => {
  try {
    if (!nonReactiveObjects.raycaster || !nonReactiveObjects.model || !modelLoaded.value) return;
    
    const raycaster = nonReactiveObjects.raycaster;
    const mouse = nonReactiveObjects.mouse;
    const camera = nonReactiveObjects.camera;
    
    if (!raycaster || !mouse || !camera) return;
    
    // 更新射线位置
    raycaster.setFromCamera(mouse, camera);
    
    // 新增：优化 - 设置射线检测阈值，过滤掉距离远的物体，提高性能
    raycaster.params.Line.threshold = 0.1;
    raycaster.params.Points.threshold = 0.1;
    
    // 优化：不每次都遍历所有网格，使用预先缓存的数组
    let meshes = nonReactiveObjects.intersectMeshes;
    
    // 如果缓存不存在或模型已更改，重建缓存
    if (!meshes || nonReactiveObjects.lastModelUpdate !== nonReactiveObjects.model.uuid) {
      meshes = [];
      nonReactiveObjects.model.traverse((object) => {
        if (object.isMesh && object.visible && object.userData.partId !== undefined) {
          meshes.push(object);
        }
      });
      nonReactiveObjects.intersectMeshes = meshes;
      nonReactiveObjects.lastModelUpdate = nonReactiveObjects.model.uuid;
    }
    
    // 检查meshes是否为空数组
    if (!meshes || meshes.length === 0) return;
    
    // 计算射线与网格的交点
    const intersects = raycaster.intersectObjects(meshes);
    
    // 重置所有悬停部件的材质
    if (hoveredPart.value && hoveredPart.value.object) {
      resetMaterial(hoveredPart.value.object);
      hoveredPart.value = null;
    }
    
    // 如果有交点，设置悬停部件，并应用高亮材质
    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object;
      if (!intersectedObject || !intersectedObject.userData) return;
      
      const partId = intersectedObject.userData.partId;
      if (partId === undefined) return;
      
      // 找到对应的部件
      const part = partsList.value.find(p => p.id === partId);
      if (part) {
        hoveredPart.value = part;
        
        // 如果当前没有选中部件，或者悬停的部件不是选中的部件，则应用高亮材质
        if (!selectedPart.value || selectedPart.value.id !== part.id) {
          applyMaterial(intersectedObject, highlightMaterial);
        }
      }
    }
  } catch (err) {
    console.error("检查交点时出错:", err);
    // 出错时不影响主程序运行
  }
};

// 新增：应用材质
const applyMaterial = (object, material) => {
  if (!object) return;
  if (object.material) {
    object.material = material;
  }
};

// 新增：重置材质
const resetMaterial = (object) => {
  if (!object) return;
  
  // 如果是选中的部件，保持选中状态
  if (selectedPart.value && object.userData.partId === selectedPart.value.id) {
    applyMaterial(object, selectedMaterial);
    return;
  }
  
  // 否则恢复原始材质
  const originalMaterial = nonReactiveObjects.originalMaterials.get(object.uuid);
  if (originalMaterial) {
    object.material = originalMaterial.clone();
    // 更新金属度和粗糙度
    if (object.material.isMeshStandardMaterial) {
      object.material.metalness = metalness.value;
      object.material.roughness = roughness.value;
    }
  }
};

// 新增：选中部件
const selectPart = (part) => {
  // 如果当前已经选中该部件，取消选择
  if (selectedPart.value && selectedPart.value.id === part.id) {
    clearSelectedPart();
    return;
  }
  
  // 先清除之前选中的部件
  clearSelectedPart();
  
  // 设置新的选中部件
  selectedPart.value = part;
  
  // 应用选中材质
  applyMaterial(part.object, selectedMaterial);
  
  // 聚焦到选中的部件
  focusOnPart(part, true);
};

// 新增：清除选中部件
const clearSelectedPart = () => {
  if (selectedPart.value && selectedPart.value.object) {
    resetMaterial(selectedPart.value.object);
  }
  selectedPart.value = null;
};

// 新增：聚焦到部件
const focusOnPart = (part, animate = false) => {
  try {
    if (!part || !part.object) return;
    
    const controls = nonReactiveObjects.controls;
    const camera = nonReactiveObjects.camera;
    if (!controls || !camera) return;
    
    // 获取部件的世界坐标
    const targetPosition = new THREE.Vector3();
    part.object.getWorldPosition(targetPosition);
    
    // 检查位置是否有效
    if (!isFinite(targetPosition.x) || !isFinite(targetPosition.y) || !isFinite(targetPosition.z)) {
      console.warn("部件位置无效，无法聚焦", part.name);
      return;
    }
    
    // 计算适当的相机距离
    const boundingBox = new THREE.Box3().setFromObject(part.object);
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    
    // 确保尺寸有效
    if (size.x === 0 && size.y === 0 && size.z === 0) {
      console.warn("部件尺寸为零，使用默认距离");
      size.set(1, 1, 1);
    }
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = Math.max(maxDim * 3, 1); // 确保最小距离为1
    
    // 设置相机位置
    if (animate) {
      // 使用自定义动画进行平滑过渡
      animateCameraMove(targetPosition, distance);
    } else {
      // 立即设置相机位置
      setCameraPosition(targetPosition, distance);
    }
    
    // 标记选中的部件
    if (!selectedPart.value || selectedPart.value.id !== part.id) {
      selectPart(part);
    }
  } catch (err) {
    console.error("聚焦部件时出错:", err);
  }
};

// 新增：动画移动相机
const animateCameraMove = (targetPosition, distance) => {
  try {
    const controls = nonReactiveObjects.controls;
    const camera = nonReactiveObjects.camera;
    
    if (!controls || !camera) return;
    
    // 获取当前相机位置和目标位置
    const currentPosition = camera.position.clone();
    const currentTarget = controls.target.clone();
    
    // 计算新的相机位置
    const direction = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    const newPosition = targetPosition.clone().add(direction.multiplyScalar(distance));
    
    // 检查新位置是否有效
    if (!isFinite(newPosition.x) || !isFinite(newPosition.y) || !isFinite(newPosition.z)) {
      console.warn("计算的相机位置无效，使用直接设置");
      setCameraPosition(targetPosition, distance);
      return;
    }
    
    // 设置动画时长（毫秒）
    const duration = 1000;
    const startTime = Date.now();
    
    // 定义动画函数
    const animate = () => {
      try {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        
        // 使用缓动函数使动画更平滑
        const easeProgress = easeOutCubic(progress);
        
        // 插值计算当前位置
        camera.position.lerpVectors(currentPosition, newPosition, easeProgress);
        controls.target.lerpVectors(currentTarget, targetPosition, easeProgress);
        controls.update();
        
        // 如果动画未完成，继续请求动画帧
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      } catch (animErr) {
        console.error("相机动画过程中出错:", animErr);
        // 发生错误时，直接设置到目标位置
        setCameraPosition(targetPosition, distance);
      }
    };
    
    // 开始动画
    animate();
  } catch (err) {
    console.error("设置相机动画时出错:", err);
    // 失败时尝试直接设置位置
    setCameraPosition(targetPosition, distance);
  }
};

// 缓动函数
const easeOutCubic = (t) => {
  return 1 - Math.pow(1 - t, 3);
};

// 新增：直接设置相机位置
const setCameraPosition = (targetPosition, distance) => {
  try {
    const controls = nonReactiveObjects.controls;
    const camera = nonReactiveObjects.camera;
    
    if (!controls || !camera) return;
    
    // 检查目标位置是否有效
    if (!isFinite(targetPosition.x) || !isFinite(targetPosition.y) || !isFinite(targetPosition.z)) {
      console.warn("目标位置无效，无法设置相机");
      return;
    }
    
    // 设置控制器目标
    controls.target.copy(targetPosition);
    
    // 计算并设置相机位置
    const direction = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
    
    // 如果方向向量是有效的
    if (direction.lengthSq() > 0.001) {
      const newPosition = targetPosition.clone().add(direction.multiplyScalar(distance));
      
      // 检查新位置是否有效
      if (isFinite(newPosition.x) && isFinite(newPosition.y) && isFinite(newPosition.z)) {
        camera.position.copy(newPosition);
      } else {
        // 如果新位置无效，使用默认位置
        console.warn("计算的相机位置无效，使用默认位置");
        camera.position.set(targetPosition.x, targetPosition.y + distance, targetPosition.z);
      }
    } else {
      // 方向向量无效时使用默认方向
      camera.position.set(targetPosition.x, targetPosition.y + distance, targetPosition.z);
    }
    
    controls.update();
  } catch (err) {
    console.error("设置相机位置时出错:", err);
  }
};

// 拆解模型
const decomposeMesh = () => {
  if (!nonReactiveObjects.model) return;
  
  isMeshDecompose.value = true;
  let time = 0;
  const duration = 20; // 动画持续时长（帧数）
  
  // 先给每个部件添加初始位置和拆解方向
  partsList.value.forEach(part => {
    if (part.object) {
      // 保存初始位置
      part.object.position_0 = part.object.position.clone();
      
      // 计算拆解方向（从模型中心向外）
      const center = new THREE.Vector3();
      nonReactiveObjects.model.getWorldPosition(center);
      
      const partPosition = new THREE.Vector3();
      part.object.getWorldPosition(partPosition);
      
      // 安全地计算方向，确保向量不为零
      const direction = new THREE.Vector3().subVectors(partPosition, center);
      if (direction.lengthSq() > 0.0001) {
        direction.normalize().multiplyScalar(0.5);
      } else {
        // 如果方向向量接近零，提供一个默认方向
        direction.set(0, 1, 0).multiplyScalar(0.5);
      }
      
      part.object.decomposeDirection = direction;
    }
  });
  
  const animate = () => {
    if (time < duration) {
      partsList.value.forEach(part => {
        if (part.object && part.object.decomposeDirection) {
          // 使用预计算的方向，而不是在动画中计算
          part.object.position.add(part.object.decomposeDirection);
        }
      });
      time++;
      requestAnimationFrame(animate);
    }
  };
  
  animate();
};

// 合并模型
const mergeMesh = () => {
  if (!nonReactiveObjects.model) return;
  
  isMeshDecompose.value = false;
  let time = 0;
  const duration = 20; // 动画持续时长（帧数）
  
  const animate = () => {
    if (time < duration) {
      partsList.value.forEach(part => {
        if (part.object && part.object.position_0) {
          // 使用lerp平滑插值回到原始位置
          part.object.position.lerp(part.object.position_0, 0.1);
        }
      });
      time++;
      requestAnimationFrame(animate);
    } else {
      // 动画结束，确保所有部件恢复到初始位置
      partsList.value.forEach(part => {
        if (part.object && part.object.position_0) {
          part.object.position.copy(part.object.position_0);
        }
      });
    }
  };
  
  animate();
};

// 部件悬停处理
const onPartMouseEnter = (part) => {
  if (!part || (selectedPart.value && selectedPart.value.id === part.id)) return;
  
  hoveredPart.value = part;
  
  // 应用高亮材质
  if (part.object) {
    applyMaterial(part.object, highlightMaterial);
  }
};

// 部件移出处理
const onPartMouseLeave = (part) => {
  if (!part || (selectedPart.value && selectedPart.value.id === part.id)) return;
  
  hoveredPart.value = null;
  
  // 重置材质
  if (part.object) {
    resetMaterial(part.object);
  }
};

// 格式化向量为字符串
const formatVector = (vector) => {
  if (!vector) return '0, 0, 0';
  return `${vector.x.toFixed(2)}, ${vector.y.toFixed(2)}, ${vector.z.toFixed(2)}`;
};

// 新增：切换线框显示
const toggleWireframe = () => {
  const currentModel = nonReactiveObjects.model;
  if (!currentModel) return;
  
  currentModel.traverse((object) => {
    if (object.isMesh && object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(mat => {
          if (mat.isMeshStandardMaterial) {
            mat.wireframe = showWireframe.value;
            mat.needsUpdate = true;
          }
        });
      } else if (object.material.isMeshStandardMaterial) {
        object.material.wireframe = showWireframe.value;
        object.material.needsUpdate = true;
      }
    }
  });
};

// 新增：重新加载模型（带简化）
const reloadModel = () => {
  // 重置模型加载状态
  modelLoaded.value = false;
  nonReactiveObjects.model = null;
  model.value = null;
  
  // 延迟加载，确保UI更新
  nextTick(() => {
    loadModel();
  });
};

// 生命周期钩子
onMounted(() => {
  console.log("组件挂载，开始初始化");
  // 检查WebGL兼容性
  checkWebGLCompatibility();
  
  initThreeJS();
  loadModel();
  window.addEventListener("resize", onWindowResize);
  
  // 修复：使用更通用的方法监听设备像素比变化
  const mediaQueryList = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  if (mediaQueryList.addEventListener) {
    mediaQueryList.addEventListener('change', onDevicePixelRatioChange);
  } else if (mediaQueryList.addListener) {
    // 兼容旧版浏览器
    mediaQueryList.addListener(onDevicePixelRatioChange);
  }
});

// 卸载前清理
onBeforeUnmount(() => {
  window.removeEventListener("resize", onWindowResize);
  
  // 移除鼠标事件监听
  const container = document.getElementById("model-viewer");
  if (container) {
    container.removeEventListener('mousemove', onMouseMove);
    container.removeEventListener('click', onMouseClick);
  }
  
  // 修复：移除像素比监听器，兼容不同浏览器
  const mediaQueryList = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  if (mediaQueryList.removeEventListener) {
    mediaQueryList.removeEventListener('change', onDevicePixelRatioChange);
  } else if (mediaQueryList.removeListener) {
    mediaQueryList.removeListener(onDevicePixelRatioChange);
  }
  
  cleanup();
});

// 新增：设备像素比变化处理函数
const onDevicePixelRatioChange = () => {
  const currentRenderer = nonReactiveObjects.renderer;
  if (currentRenderer) {
    currentRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
};

// 检查WebGL兼容性
const checkWebGLCompatibility = () => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) {
      loadError.value = "您的浏览器不支持WebGL，无法显示3D模型";
      console.error("浏览器不支持WebGL");
      return false;
    }
    
    // 检查最大纹理尺寸
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    console.log("最大纹理尺寸:", maxTextureSize);
    
    // 检查最大顶点属性
    const maxVertexAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    console.log("最大顶点属性:", maxVertexAttribs);
    
    // 其他可能的兼容性测试...
    return true;
  } catch (e) {
    console.error("WebGL兼容性检查错误:", e);
    loadError.value = "WebGL兼容性检查失败: " + e.message;
    return false;
  }
};

// 重试加载模型
const retryLoading = () => {
  console.log("重试加载模型");
  // 清理现有资源
  cleanup();
  // 重新初始化
  nextTick(() => {
    initThreeJS();
    loadModel();
  });
};
</script>

<style scoped>
/* 这些全局样式已经在App.vue中设置，在这里移除
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
}

#app {
  height: 100%;
  display: flex;
  flex-direction: column;
}
*/

.model-container {
  width: 100%;
  height: 100%;
  position: relative;
  background-color: #222;
  overflow: hidden;
  border: none;
  display: flex;
  flex-direction: column;
}

#model-viewer {
  width: 100%;
  flex: 1;
  margin: 0;
  padding: 0;
}

.loading-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 18px;
  background-color: rgba(0, 0, 0, 0.7);
  padding: 20px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-message {
  position: absolute;
  top: 10px;
  left: 10px;
  color: #ff4444;
  background-color: rgba(0, 0, 0, 0.7);
  padding: 10px;
  border-radius: 4px;
  max-width: 80%;
}

.controls-panel {
  position: absolute;
  right: 10px;
  top: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  padding: 10px;
  border-radius: 4px;
  color: white;
  max-width: 200px;
}

.control-group {
  margin-bottom: 15px;
}

.control-group h3 {
  margin: 0 0 5px 0;
  font-size: 14px;
}

.control-group button {
  display: block;
  width: 100%;
  padding: 5px 10px;
  margin-bottom: 5px;
  background-color: rgba(255, 255, 255, 0.15);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.control-group button:hover {
  background-color: rgba(255, 255, 255, 0.25);
}

.control-group label {
  display: block;
  margin-bottom: 5px;
  font-size: 12px;
  cursor: pointer;
}

.control-group input[type="checkbox"] {
  margin-right: 5px;
}

.slider-container {
  margin-bottom: 10px;
}

.slider-container label {
  display: block;
  margin-bottom: 2px;
}

.slider-container input[type="range"] {
  width: 100%;
  margin: 5px 0;
}

.model-info-panel {
  position: absolute;
  left: 10px;
  bottom: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  padding: 10px;
  border-radius: 4px;
  color: white;
  font-size: 12px;
  max-width: 200px;
}

.model-info-panel h3 {
  margin: 0 0 8px 0;
  font-size: 14px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.info-item span:first-child {
  color: #aaa;
  margin-right: 10px;
}

/* 新增：部件列表面板样式 */
.parts-panel {
  position: absolute;
  left: 10px;
  top: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  padding: 10px;
  border-radius: 4px;
  color: white;
  width: 200px;
  max-height: 50%;
  display: flex;
  flex-direction: column;
}

.parts-panel h3 {
  margin: 0 0 10px 0;
  font-size: 14px;
  text-align: center;
}

.search-box {
  margin-bottom: 10px;
}

.search-box input {
  width: 100%;
  padding: 5px;
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
}

.parts-list {
  overflow-y: auto;
  flex-grow: 1;
}

.part-item {
  padding: 6px 8px;
  margin-bottom: 2px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.part-item:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.part-item.active {
  background-color: rgba(255, 149, 0, 0.3);
  border-left: 3px solid #ff9500;
}

.part-name {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

/* 新增：部件详情面板样式 */
.part-details-panel {
  position: absolute;
  right: 10px;
  bottom: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  padding: 10px;
  border-radius: 4px;
  color: white;
  width: 250px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
}

.details-content {
  font-size: 12px;
}

.detail-item {
  display: flex;
  margin-bottom: 5px;
}

.detail-item span:first-child {
  color: #aaa;
  width: 70px;
  flex-shrink: 0;
}

.detail-item span:last-child {
  flex-grow: 1;
}

/* 新增：悬停提示样式 */
.hover-info {
  position: absolute;
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
  pointer-events: none;
  white-space: nowrap;
}

/* 为部件列表添加滚动条样式 */
.parts-list::-webkit-scrollbar {
  width: 6px;
}

.parts-list::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.parts-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.parts-list::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

.no-parts {
  text-align: center;
  padding: 10px;
  color: #999;
  font-style: italic;
  font-size: 12px;
}

/* 新增：性能信息面板样式 */
.performance-info {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.performance-info .info-item span:first-child {
  color: #ffaa44;
}

/* 移动设备响应式优化 */
@media (max-width: 768px) {
  .controls-panel, .parts-panel, .part-details-panel, .model-info-panel {
    max-width: 180px;
    font-size: 11px;
  }
  
  .parts-panel {
    max-height: 40%;
  }
  
  .control-group h3, .parts-panel h3, .panel-header h3, .model-info-panel h3 {
    font-size: 12px;
  }
}

/* 简化率滑块特殊样式 */
input[type="range"][v-model="simplificationRatio"] {
  accent-color: #ff5500;
}

/* 重新加载按钮样式 */
.control-group button[type="button"] {
  transition: all 0.2s;
}

.control-group button:active {
  transform: scale(0.95);
}

.retry-button {
  margin-top: 10px;
  background-color: #ff5500;
  color: white;
  border: none;
  padding: 5px 10px;
  cursor: pointer;
  transition: all 0.3s;
}

.retry-button:hover {
  background-color: #ff7700;
}
</style> 