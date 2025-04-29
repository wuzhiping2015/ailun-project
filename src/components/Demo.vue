<template>
  <div id="container">
    <div id="gui">
      <div ref="info">加载模型中...</div>
      <el-collapse v-model="activeNames">
        <el-collapse-item title="选择模型" name="1">
          {{ meshNameIndex }}
          <el-button :disabled="modelLoading" @click="handleModelButtonClick(0)">模型1</el-button>
          <el-button :disabled="modelLoading" @click="handleModelButtonClick(1)">模型2</el-button>
          <el-button :disabled="modelLoading" @click="handleModelButtonClick(2)">模型3</el-button>
          <el-button :disabled="modelLoading" @click="handleModelButtonClick(3)">模型4</el-button>
          <el-button :disabled="modelLoading" @click="handleModelButtonClick(4)">模型5</el-button>
        </el-collapse-item>
        <el-collapse-item title="模型控制" name="3">
          <div class="model-controls">
            <el-button @click="resetCamera">重置视角</el-button>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

const meshNameIndex = ref(0);
const activeNames = ref(["1", "3"]);
const info = ref(null);
const modelLoading = ref(false);

const data = {
  scene: new THREE.Scene(),
  camera: null,
  orbitControls: null,
  meshNameList: [
    "6.gltf",
    "阀门.gltf",
    "阀门红色材质.gltf",
    "阀门2.gltf",
    "K60发电机.gltf"
  ],
  mesh: null,
  gltfLoader: new GLTFLoader(),
  fBXLoader: new FBXLoader(),
  box: new THREE.Box3(),
  center: new THREE.Vector3(),
  dis: 0
};

onMounted(() => {
  const container = document.getElementById("container");
  
  // 设置场景
  data.scene.background = new THREE.Color(0xeeeeee); // 更柔和的浅灰色背景
  const width = container.clientWidth;
  const height = container.clientHeight;

  // 添加环境光和主光源
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 20, 10);
  data.scene.add(ambientLight, directionalLight);

  // 设置相机
  data.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
  data.camera.position.set(10, 10, 10);
  data.camera.lookAt(0, 0, 0);

  // 设置渲染器
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // 设置轨道控制器
  data.orbitControls = new OrbitControls(data.camera, renderer.domElement);
  data.orbitControls.enableDamping = true;
  data.orbitControls.dampingFactor = 0.05;
  data.orbitControls.screenSpacePanning = true;
  data.orbitControls.minDistance = 5;
  data.orbitControls.maxDistance = 50;
  data.orbitControls.maxPolarAngle = Math.PI / 2;
  data.orbitControls.target.set(0, 0, 0);

  try {
    loadMesh();
  } catch (err) {
    console.error("初始加载模型失败", err);
    if (info.value) {
      info.value.innerHTML = '<span style="color: #f22">初始加载失败，将显示默认模型</span>';
    }
    createDefaultMesh();
  }

  // 响应窗口伸缩
  window.onresize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;

    data.camera.aspect = width / height;
    data.camera.updateProjectionMatrix();

    renderer.setSize(width, height);
  };

  // 渲染循环
  function animate() {
    requestAnimationFrame(animate);
    data.orbitControls.update();
    renderer.render(data.scene, data.camera);
  }
  animate();
});

// 加载模型
function loadMesh() {
  if (modelLoading.value) {
    console.warn("模型正在加载中，请稍后再试");
    return;
  }

  if (meshNameIndex.value < 0 || meshNameIndex.value >= data.meshNameList.length) {
    console.error("无效的模型索引:", meshNameIndex.value);
    return;
  }

  let name = data.meshNameList[meshNameIndex.value];
  if (!name) {
    console.error("模型名称为空");
    return;
  }

  if (info.value) {
    info.value.innerHTML = "开始加载模型: " + name;
  }

  modelLoading.value = true;

  // 修改模型路径
  let modelPath = `/${name}`;
  let loader = name.endsWith(".fbx") ? data.fBXLoader : data.gltfLoader;

  loader.load(
    modelPath,
    (res) => {
      try {
        if (!res) {
          throw new Error("加载结果为空");
        }

        const group = res.isObject3D ? res : res.scene;
        if (!group) {
          throw new Error("无法获取有效的模型组");
        }

        // 计算模型尺寸和位置
        const box = new THREE.Box3().setFromObject(group);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        // 计算合适的缩放比例
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = maxDim > 0 ? 10 / maxDim : 1;

        // 设置模型变换
        group.scale.setScalar(scale);
        group.position.copy(center).multiplyScalar(-scale);

        // 添加到场景
        if (data.mesh) {
          data.scene.remove(data.mesh);
          disposeModel(data.mesh);
        }

        data.mesh = group;
        data.scene.add(group);

        // 居中模型
        group.position.sub(center);

        // 更新相机位置以适应模型
        const distance = maxDim * 2;
        data.camera.position.set(distance, distance, distance);
        data.camera.lookAt(0, 0, 0);
        data.orbitControls.target.set(0, 0, 0);
        data.orbitControls.update();

        if (info.value) {
          info.value.innerHTML = "模型加载完成: " + name;
        }

        modelLoading.value = false;
      } catch (err) {
        console.error("处理模型时出错:", err);
        modelLoading.value = false;
        createDefaultMesh();
      }
    },
    (xhr) => {
      if (!info.value) return;
      const progress = xhr.total ? Math.floor((xhr.loaded / xhr.total) * 100) : 0;
      info.value.innerHTML = progress >= 100 ? "处理模型中..." : progress + "% 已加载";
    },
    (err) => {
      console.error("模型加载失败", err);
      modelLoading.value = false;
      createDefaultMesh();
    }
  );
}

// 创建默认模型
function createDefaultMesh() {
  try {
    if (data.mesh) {
      data.scene.remove(data.mesh);
      disposeModel(data.mesh);
    }

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x3080ff });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "默认立方体";

    data.mesh = mesh;
    data.scene.add(mesh);

    updateModelPosition(mesh);

    if (info.value) {
      info.value.innerHTML = "已创建默认模型";
    }
  } catch (err) {
    console.error("创建默认模型失败", err);
  }
}

// 处理点击模型按钮事件
function handleModelButtonClick(index) {
  if (modelLoading.value) {
    if (info.value) {
      info.value.innerHTML = '<span style="color: #f22">请等待当前模型加载完成</span>';
    }
    return;
  }
  meshNameIndex.value = index;
}

// 重置相机
function resetCamera() {
  if (data.mesh) {
    data.camera.position.set(
      data.center.x,
      data.center.y,
      data.center.z + data.dis
    );
    data.orbitControls.target.copy(data.center);
    data.orbitControls.update();
  }
}

// 释放模型资源
function disposeModel(model) {
  model.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  });
}

// 更新模型位置
function updateModelPosition(group) {
  data.box.setFromObject(group);
  data.dis = data.box.max.distanceTo(data.box.min);
  data.box.getCenter(data.center);

  data.camera.far = data.dis * 2;
  data.camera.updateProjectionMatrix();

  data.camera.position.set(
    data.center.x,
    data.center.y,
    data.center.z + data.dis
  );
  data.orbitControls.target.copy(data.center);
  data.orbitControls.update();
}
</script>

<style scoped>
#container {
  width: 100%;
  height: 100%;
  position: relative;
  background: #f0f0f0;
}

#gui {
  position: absolute;
  background: rgba(255, 255, 255, 0.9);
  padding: 0 1rem;
  height: 100%;
  overflow-y: auto;
  z-index: 1;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
}

.model-controls {
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 2;
  display: flex;
  gap: 10px;
}

.model-controls button {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.model-controls button:hover {
  background: #6af;
  color: white;
}
</style>
