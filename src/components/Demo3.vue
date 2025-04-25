<template>
  <div class="model-container">
    <div id="model-viewer"></div>
    <div class="loading-indicator" v-if="!modelLoaded">
      <div class="spinner"></div>
      <span>加载中... {{ loadingProgress }}%</span>
    </div>
    <div class="error-message" v-if="loadError">{{ loadError }}</div>
    
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
    </div>
  </div>
</template>

<script setup>
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"; // 导入GLTFLoader    
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"; // 导入OrbitControls
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js"; // 导入DRACOLoader
import { markRaw, ref, reactive, onMounted, onBeforeUnmount } from "vue"; // 导入Vue组合式API相关函数

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
});
const showGrid = ref(true);
const showAxes = ref(true);
const showBoundingBox = ref(false);
const metalness = ref(0.8);  // 默认金属度
const roughness = ref(0.2);  // 默认粗糙度

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
    // 优化阴影质量
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 500;
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
      logarithmicDepthBuffer: true
    }));
    
    rendererObj.setSize(container.clientWidth, container.clientHeight);
    rendererObj.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererObj.shadowMap.enabled = true;
    rendererObj.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererObj.outputColorSpace = THREE.SRGBColorSpace;
    rendererObj.toneMapping = THREE.ACESFilmicToneMapping;
    
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
  
  console.log("开始加载阀门.gltf模型");
  
  // 清理旧模型资源
  cleanupModel();
  
  const loader = new GLTFLoader();
  
  // 添加DRACO压缩支持
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  dracoLoader.setDecoderConfig({ type: 'js' });
  loader.setDRACOLoader(dracoLoader);
  
  loader.load(
    '阀门.gltf',
    (gltf) => {
      try {
        console.log("阀门.gltf模型加载成功:", {
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
        
        processModel(sceneObj);
      } catch (err) {
        console.error("模型处理错误:", err);
        loadError.value = `模型处理错误: ${err.message}`;
      }
    },
    (xhr) => {
      const percent = xhr.loaded / xhr.total;
      loadingProgress.value = Math.round(percent * 100);
      console.log(`加载进度: ${loadingProgress.value}%`);
    },
    (error) => {
      console.error("阀门.gltf模型加载错误:", error);
      loadError.value = `模型加载错误: ${error instanceof Error ? error.message : "未知错误"}`;
    }
  );
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
    modelObj.position.y -= 2; // 稍微下移，让模型处于网格平面上
    
    // 遍历模型所有网格并添加金属质感
    modelObj.traverse((object) => {
      if (object.isMesh) {
        // 为所有网格添加金属质感材质
        object.material = new THREE.MeshStandardMaterial({
          color: object.material ? object.material.color : 0x888888,
          metalness: metalness.value,
          roughness: roughness.value,
          envMapIntensity: 1.0
        });
        
        // 保留原始纹理(如果有)
        if (object.material && object.material.map) {
          object.material.map = object.material.map;
          object.material.map.anisotropy = 16;
        }
        
        // 启用阴影
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

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
    
  } catch (err) {
    console.error("处理模型时出错:", err);
    loadError.value = `处理模型错误: ${err.message}`;
    throw err;
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
    currentScene.remove(oldModel);
    
    // 递归处理模型以释放内存
    oldModel.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }
      
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => {
            disposeMaterial(material);
          });
        } else {
          disposeMaterial(object.material);
        }
      }
    });
  }

  const oldBoxHelper = currentScene.getObjectByName("modelBoxHelper");
  if (oldBoxHelper) {
    currentScene.remove(oldBoxHelper);
  }
};

// 辅助函数来处理材质及其相关纹理
const disposeMaterial = (material) => {
  if (!material) return;
  
  // 处理材质纹理
  if (material.map) material.map.dispose();
  if (material.lightMap) material.lightMap.dispose();
  if (material.bumpMap) material.bumpMap.dispose();
  if (material.normalMap) material.normalMap.dispose();
  if (material.displacementMap) material.displacementMap.dispose();
  if (material.specularMap) material.specularMap.dispose();
  if (material.emissiveMap) material.emissiveMap.dispose();
  if (material.alphaMap) material.alphaMap.dispose();
  if (material.aoMap) material.aoMap.dispose();
  if (material.metalnessMap) material.metalnessMap.dispose();
  if (material.roughnessMap) material.roughnessMap.dispose();
  if (material.envMap) material.envMap.dispose();
  
  // 释放材质本身
  material.dispose();
};

// 清理所有资源
const cleanup = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // 获取非响应式引用
  const currentRenderer = nonReactiveObjects.renderer;
  const currentScene = nonReactiveObjects.scene;
  const currentControls = nonReactiveObjects.controls;

  // 清理模型资源
  cleanupModel();

  // 清理渲染器
  if (currentRenderer) {
    currentRenderer.dispose();
    const container = document.getElementById("model-viewer");
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
    currentScene.clear();
  }
  
  // 重置非响应式对象
  Object.assign(nonReactiveObjects, {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    model: null
  });
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

// 切换包围盒显示
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
};

// 生命周期钩子
onMounted(() => {
  initThreeJS();
  loadModel();
  window.addEventListener("resize", onWindowResize);
});
 // 卸载前清理
onBeforeUnmount(() => {
  window.removeEventListener("resize", onWindowResize);
  cleanup();
});
</script>

<style scoped>
.model-container {
  width: 100%;
  height: 600px;
  position: relative;
  background-color: #222;
  overflow: hidden;
  border: 1px solid #444;
}

#model-viewer {
  width: 100%;
  height: 100%;
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
</style> 