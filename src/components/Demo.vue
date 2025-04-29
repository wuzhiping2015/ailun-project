<template>
  <div id="container">
    <div id="gui">
      <div ref="info">加载模型中...</div>
      <el-collapse v-model="activeNames">
        <el-collapse-item title="选择模型" name="1">
          {{ meshNameIndex }}
          <el-button :disabled="modelLoading" @click="handleModelButtonClick(0)"
            >模型1</el-button
          >
          <el-button :disabled="modelLoading" @click="handleModelButtonClick(1)"
            >模型2</el-button
          >
          <el-button :disabled="modelLoading" @click="handleModelButtonClick(2)"
            >模型3</el-button
          >
          <el-button :disabled="modelLoading" @click="handleModelButtonClick(3)"
            >模型4</el-button
          >
          <el-button :disabled="modelLoading" @click="handleModelButtonClick(4)"
            >模型5</el-button
          >
        </el-collapse-item>
        <el-collapse-item title="模型控制" name="3">
          <div class="model-controls">
            <el-button @click="resetCamera">重置视角</el-button>
            <el-button @click="toggleAutoRotate">{{ autoRotate ? '停止旋转' : '自动旋转' }}</el-button>
          </div>
        </el-collapse-item>
        <el-collapse-item title="模型自带动画" name="2">
          <el-button
            :disabled="!data.mesh"
            @click="isMixersPlay = !isMixersPlay"
            >{{ isMixersPlay ? "已启用" : "已关闭" }}</el-button
          >
        </el-collapse-item>
        <el-collapse-item title="其他" name="4">
          <p>
            <el-button
              :disabled="!data.mesh || modelLoading"
              v-if="!isMeshDecompose"
              @click="decomposeMesh()"
              >拆解模型</el-button
            >
            <el-button
              :disabled="!data.mesh || modelLoading"
              v-if="isMeshDecompose"
              @click="mergeMesh()"
              >合并模型</el-button
            >
          </p>
          <p>
            <el-button
              :disabled="!data.mesh || modelLoading"
              @click="setColor()"
              >随机颜色</el-button
            >
            <el-button
              :disabled="!data.mesh || modelLoading"
              @click="resetColor()"
              >原始颜色</el-button
            >
          </p>
          <p style="margin: 0">
            <el-button
              :disabled="!data.mesh || modelLoading"
              @click="setVertexColors(!isVertexColors)"
              >{{
                isVertexColors ? "关闭模型顶点颜色" : "启用模型顶点颜色"
              }}</el-button
            >
          </p>
        </el-collapse-item>
        <el-collapse-item title="部件列表" name="5">
          <p v-if="subMeshes.length === 0">暂无可用部件</p>
          <p
            class="submesh"
            v-for="(item, inx) in subMeshes"
            @mouseenter="setSelectedMesh(item)"
            @click="setClickedMesh(item)"
            :key="inx"
          >
            <span>{{ item.name }}</span>
          </p>
        </el-collapse-item>
      </el-collapse>
    </div>
    <div v-if="selectedPart" class="info-panel">
      <h3>{{ selectedPart.name }}</h3>
      <p>材质: {{ selectedPart.material?.type || '无材质信息' }}</p>
      <p>位置: X:{{ selectedPart.position.x.toFixed(2) }} Y:{{ selectedPart.position.y.toFixed(2) }} Z:{{ selectedPart.position.z.toFixed(2) }}</p>
    </div>
  </div>
</template>
<script setup>
/* eslint-disable */
import { onMounted, ref, shallowReactive, watch } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import { LoadingManager } from "three";
import Timer from "../assets/Timer";
import Stats from 'stats-js';

const meshNameIndex = ref(0);
const activeNames = ref(["1", "2", "3", "4", "5"]);
const dialogVisible = ref(false);
const isMixersPlay = ref(true); // 是否开启模型自带动画
const isMeshDecompose = ref(false); // 是否分解模型
const isVertexColors = ref(false); // 是否启用模型顶点颜色
const timer = new Timer();
const subMeshes = shallowReactive([]); // 模型的各个子部件
const info = ref(null);
const modelLoading = ref(false); // 添加模型加载状态
const data = {
  scene: new THREE.Scene(),
  camera: null,
  outlinePass: null, // 高亮特效外框
  orbitControls: null, // 轨道相机控制器
  directionalLight: null,
  // 确保模型文件路径正确，使用相对路径或绝对路径
  //   meshNameList: ["cube.glb", "sphere.glb", "torus.glb", "teapot.glb"],
  meshNameList: [
    "untitled.gltf",  // 修改为实际的模型文件名
    "阀门.gltf",
    "阀门红色材质.gltf",
    "阀门2.gltf",
    "K60发电机.gltf"
  ],
  mesh: null, // 模型
  gltfLoader: new GLTFLoader(), // 模型加载器
  fBXLoader: new FBXLoader(),
  box: new THREE.Box3(), // 模型外包围盒
  center: new THREE.Vector3(), // 模型中心位置
  dis: 0, // 模型对角线尺寸
  mixers: [], // 模型自带动画
  up: new THREE.Vector3(0, 1, 0), // 主光源相对于相机的位置
  clickedMesh: { name: "", material_0: { type: "" } }, // 修复初始数据结构
  texture: null, // 被选中的部件的纹理贴图
  // 添加性能监控
  stats: null,
  // 添加加载进度条
  progressBar: null,
  // 添加重试机制
  retryCount: 0,
  maxRetries: 3
};

// 添加新的响应式变量
const autoRotate = ref(false);
const selectedPart = ref(null);

onMounted(() => {
  const container = document.getElementById("container");
  
  // 添加性能监控
  data.stats = new Stats();
  data.stats.showPanel(0);
  container.appendChild(data.stats.dom);
  
  // 添加加载进度条
  data.progressBar = document.createElement('div');
  data.progressBar.className = 'model-progress-bar';
  container.appendChild(data.progressBar);
  
  // 设置场景
  data.scene.background = new THREE.Color(0xf0f0f0);
  const width = container.clientWidth;
  const height = container.clientHeight;

  // 优化相机设置
  data.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
  data.camera.position.set(10, 10, 10);
  data.camera.lookAt(0, 0, 0);

  // 优化光照设置
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  
  // 主平行光
  data.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  data.directionalLight.position.set(100, 100, 100);
  data.directionalLight.castShadow = true;
  data.directionalLight.shadow.mapSize.width = 2048;
  data.directionalLight.shadow.mapSize.height = 2048;
  
  // 添加辅助平行光
  const secondaryLight = new THREE.DirectionalLight(0xffffff, 0.5);
  secondaryLight.position.set(-100, 100, -100);
  
  // 添加环境半球光
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
  hemiLight.position.set(0, 200, 0);

  data.scene.add(ambientLight, data.directionalLight, secondaryLight, hemiLight);

  // 设置渲染器
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    logarithmicDepthBuffer: true,
    alpha: true
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  // 优化轨道控制器设置
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
      info.value.innerHTML =
        '<span style="color: #f22">初始加载失败，将显示默认模型</span>';
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

  // 后期处理--outlinePass
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(data.scene, data.camera);
  composer.addPass(renderPass);
  const outlinePass = (data.outlinePass = new OutlinePass(
    new THREE.Vector2(width, height),
    data.scene,
    data.camera
  ));
  outlinePass.visibleEdgeColor.setRGB(1, 0.75, 0.2); // 颜色
  outlinePass.edgeGlow = 2.5; // 光粗
  outlinePass.edgeThickness = 5; // 光晕粗
  outlinePass.pulsePeriod = 2; // 闪烁
  composer.addPass(data.outlinePass);

  // 消除锯齿
  const fxaaPass = new ShaderPass(FXAAShader);
  const pixelRatio = renderer.getPixelRatio();
  fxaaPass.material.uniforms["resolution"].value.x = 1 / (width * pixelRatio);
  fxaaPass.material.uniforms["resolution"].value.y = 1 / (height * pixelRatio);
  composer.addPass(fxaaPass);

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let isMouseMoved = false;
  let isMouseDown = false;
  data.texture = drawTexture("rgb(255, 255, 255)", "rgb(120, 120, 120)");

  // 鼠标移动时的特效
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  function onPointerMove(event) {
    isMouseMoved = true;
    if (event.isPrimary === false || isMouseDown) return;

    mouse.x = (event.offsetX / container.clientWidth) * 2 - 1;
    mouse.y = -(event.offsetY / container.clientHeight) * 2 + 1;

    checkMousePass();
  }
  // 鼠标移动时的特效
  function checkMousePass() {
    raycaster.setFromCamera(mouse, data.camera);
    const intersects = raycaster.intersectObjects(subMeshes, false);
    if (
      intersects.length > 0 &&
      data.outlinePass.selectedObjects[0] !== intersects[0].object
    ) {
      setSelectedMesh(intersects[0].object);
    } else if (
      intersects.length === 0 &&
      data.outlinePass.selectedObjects.length
    ) {
      resetMtl(data.outlinePass.selectedObjects[0]);
      setOpacity(1);
      data.outlinePass.selectedObjects.length = 0;
      info.value.innerHTML = "";
    }
  }

  // 鼠标点击时的特效
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  function onPointerDown(event) {
    isMouseDown = true;
    if (event.isPrimary === false) return;
    isMouseMoved = false;
  }
  function onPointerUp(event) {
    isMouseDown = false;
    if (event.isPrimary === false || isMouseMoved) return;
    mouse.x = (event.offsetX / container.clientWidth) * 2 - 1;
    mouse.y = -(event.offsetY / container.clientHeight) * 2 + 1;

    checkMouseClick();
  }
  // 鼠标点击时的特效
  function checkMouseClick() {
    raycaster.setFromCamera(mouse, data.camera);
    const intersects = raycaster.intersectObjects(subMeshes, false);
    if (intersects.length > 0) {
      console.log(intersects[0]);
      setClickedMesh(intersects[0].object);
    }
  }

  // 添加鼠标滚轮缩放
  renderer.domElement.addEventListener('wheel', (event) => {
    event.preventDefault();
    const zoomSpeed = 0.1;
    const delta = event.deltaY * zoomSpeed;
    data.camera.position.z += delta;
  });

  // 持续渲染
  function animate() {
    requestAnimationFrame(animate);
    data.stats.begin();

    data.orbitControls.update();
    data.directionalLight.position.copy(data.camera.position.clone().add(data.up));

    let delta = timer.tick();
    if (isMixersPlay.value) {
      for (let mixer of data.mixers) {
        mixer.update(delta);
      }
    }

    // 更新自动旋转
    if (autoRotate.value) {
      data.orbitControls.update();
    }

    let time = Math.abs((timer.elapsedTime % 2.0) - 1.0);
    if (data.outlinePass.selectedObjects[0]) {
      data.outlinePass.selectedObjects[0].material.uniforms.time.value = time;
    }

    composer.render();
    data.stats.end();
  }
  animate();
});
watch([meshNameIndex], () => {
  loadMesh();
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
  data.progressBar.style.width = '0%';
  data.progressBar.style.display = 'block';

  // 创建加载管理器
  const manager = new LoadingManager();
  manager.onProgress = (url, itemsLoaded, itemsTotal) => {
    const progress = Math.floor((itemsLoaded / itemsTotal) * 100);
    data.progressBar.style.width = `${progress}%`;
    if (info.value) {
      info.value.innerHTML = progress >= 100 ? "处理模型中..." : progress + "% 已加载";
    }
  };

  manager.onError = (url) => {
    console.error('加载错误:', url);
    if (info.value) {
      info.value.innerHTML = '<span style="color: #f22">加载失败: ' + name + '</span>';
    }
    modelLoading.value = false;
    data.progressBar.style.display = 'none';
    createDefaultMesh();
  };

  // 修改模型路径
  let modelPath = `/${name}`;
  let loader = name.endsWith(".fbx") ? data.fBXLoader : data.gltfLoader;

  // 设置加载器的管理器
  loader.manager = manager;

  // 使用 Promise 包装加载过程
  const loadPromise = new Promise((resolve, reject) => {
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

          // 优化模型处理
          group.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              
              if (child.material) {
                // 保持原始材质属性
                const originalMaterial = child.material;
                child.material = new THREE.MeshStandardMaterial({
                  color: originalMaterial.color || new THREE.Color(0xcccccc),
                  map: originalMaterial.map,
                  metalness: originalMaterial.metalness !== undefined ? originalMaterial.metalness : 0.5,
                  roughness: originalMaterial.roughness !== undefined ? originalMaterial.roughness : 0.5,
                  transparent: true,
                  opacity: 1.0,
                  side: THREE.DoubleSide,
                  envMapIntensity: 1.0
                });

                // 如果有法线贴图
                if (originalMaterial.normalMap) {
                  child.material.normalMap = originalMaterial.normalMap;
                  child.material.normalScale = originalMaterial.normalScale || new THREE.Vector2(1, 1);
                }

                // 如果有环境贴图
                if (originalMaterial.envMap) {
                  child.material.envMap = originalMaterial.envMap;
                }
              }
            }
          });

          // 计算模型包围盒并调整相机位置
          const box = new THREE.Box3().setFromObject(group);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const fov = data.camera.fov * (Math.PI / 180);
          let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
          
          // 调整相机和控制器
          data.camera.position.set(center.x, center.y + maxDim * 0.5, center.z + cameraZ);
          data.camera.lookAt(center);
          data.orbitControls.target.copy(center);
          data.orbitControls.update();

          // 添加到场景
          if (data.mesh) {
            data.scene.remove(data.mesh);
            disposeModel(data.mesh);
          }

          data.mesh = group;
          data.scene.add(group);

          // 居中模型
          group.position.sub(center);

          // 装载动画
          data.mixers.length = 0;
          let mixer;
          if (res.animations && res.animations.length) {
            for (let clip of res.animations) {
              mixer = new THREE.AnimationMixer(group);
              mixer.clipAction(clip.optimize()).play();
            }
          }
          if (mixer) data.mixers.push(mixer);

          // 设置材质
          setMtl(
            new THREE.MeshPhongMaterial({
              transparent: true,
              side: THREE.DoubleSide,
              vertexColors: isVertexColors.value,
            })
          );

          // 计算模型尺寸和位置
          updateModelPosition(group);

          setTimeout(() => {
            getSubMeshes();
          }, 0);

          if (info.value) {
            info.value.innerHTML = "模型加载完成: " + name;
          }

          resolve(group);
        } catch (err) {
          console.error("处理模型时出错:", err);
          reject(err);
        }
      },
      (xhr) => {
        if (!info.value) return;
        const progress = xhr.total ? Math.floor((xhr.loaded / xhr.total) * 100) : 0;
        data.progressBar.style.width = `${progress}%`;
        info.value.innerHTML = progress >= 100 ? "处理模型中..." : progress + "% 已加载";
      },
      (err) => {
        console.error("模型加载失败", err);
        reject(err);
      }
    );
  });

  // 设置加载超时
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error("加载超时"));
    }, 30000);
  });

  // 使用 Promise.race 处理超时
  Promise.race([loadPromise, timeoutPromise])
    .then(() => {
      modelLoading.value = false;
      data.progressBar.style.display = 'none';
    })
    .catch((err) => {
      console.error("模型加载失败:", err);
      modelLoading.value = false;
      data.progressBar.style.display = 'none';
      if (info.value) {
        info.value.innerHTML = '<span style="color: #f22">加载失败: ' + name + '</span>';
      }
      createDefaultMesh();
    });
}
// 递归遍历子模型
function getSubMeshes(mesh) {
  if (!mesh) {
    // 清除历史模型的几何体、材质缓存
    subMeshes.forEach((v) => {
      if (v.geometry) v.geometry.dispose();
      if (v.material) {
        v.material.map = null;
        v.material.dispose();
      }
      if (v.material_0) {
        v.material_0.map = null;
        v.material_0.dispose();
      }
    });
    subMeshes.length = 0;
    if (data.mesh) mesh = data.mesh;
    else return;
  }
  if (mesh.isMesh) {
    subMeshes.push(mesh);
    // 缓存模型初始位置、初始颜色，设置拆解时的方向
    mesh.position_0 = mesh.position.clone();
    mesh.color_0 = mesh.material.color.clone();

    data.box.setFromObject(mesh);
    let center = new THREE.Vector3();
    data.box.getCenter(center);
    let direction = center.sub(data.center);
    mesh.decomposeDirection = direction;
  } else if (mesh.children) {
    mesh.children.forEach((v) => {
      if (v) getSubMeshes(v);
    });
  }
}
// 设置模型材质
function setMtl(mtl, mesh) {
  if (!mesh) {
    if (data.mesh) mesh = data.mesh;
    else return;
  }
  if (mesh.isMesh) {
    let newMtl = mtl.clone();
    let color = mesh.material.color.clone();
    let max = Math.max(color.r, color.g, color.b);
    if (max < 1) {
      color.multiplyScalar(1 / max);
    }
    // newMtl.color.copy(color);
    if (!mesh.material_0) mesh.material_0 = newMtl;
    // 只保留第一次设置的材质
    if (mesh.material !== mesh.material_0) {
      mesh.material.map = null;
      mesh.material.dispose();
    }
    mesh.material = newMtl;
  } else if (mesh.children) {
    mesh.children.forEach((v) => {
      if (v) setMtl(mtl, v);
    });
  }
}
// 还原模型材质
function resetMtl(mesh) {
  if (!mesh) {
    if (data.mesh) mesh = data.mesh;
    else return;
  }
  if (mesh.isMesh && mesh.material_0) {
    mesh.material.map = null;
    mesh.material.dispose();
    mesh.material = mesh.material_0; // 第一次设置的材质
  } else if (mesh.children) {
    mesh.children.forEach((v) => {
      if (v) resetMtl(v);
    });
  }
}
// 设置模型颜色
function setColor(color, mesh) {
  if (!mesh) {
    if (data.mesh) mesh = data.mesh;
    else return;
  }
  if (mesh.isMesh) {
    mesh.material.color.copy(
      color || new THREE.Color(Math.random() * 16777216)
    );
  } else if (mesh.children) {
    mesh.children.forEach((v) => {
      if (v) setColor(color, v);
    });
  }
}
// 还原模型颜色
function resetColor(mesh) {
  if (!mesh) {
    if (data.mesh) mesh = data.mesh;
    else return;
  }
  if (mesh.isMesh && mesh.color_0) {
    mesh.material.color.copy(mesh.color_0);
  } else if (mesh.children) {
    mesh.children.forEach((v) => {
      if (v) resetColor(v);
    });
  }
}
// 设置模型透明度
function setOpacity(value, mesh) {
  if (!mesh) {
    if (data.mesh) mesh = data.mesh;
    else return;
  }
  if (mesh.isMesh) {
    mesh.material.opacity = value;
    if (value < 1) mesh.material.depthWrite = false;
    else mesh.material.depthWrite = true;
  } else if (mesh.children) {
    mesh.children.forEach((v) => {
      if (v) setOpacity(value, v);
    });
  }
}
// 拆解模型
function decomposeMesh() {
  if (data.mesh) {
    isMeshDecompose.value = true;
    let time = 0;
    let itv = setInterval(() => {
      if (time < 10) {
        subMeshes.forEach((v) => {
          v.position.add(v.decomposeDirection);
        });
        time++;
      } else {
        clearInterval(itv);
      }
    }, 50);
  }
}
// 合并模型
function mergeMesh() {
  if (data.mesh) {
    isMeshDecompose.value = false;
    let time = 0;
    let itv = setInterval(() => {
      if (time < 10) {
        subMeshes.forEach((v) => {
          v.position.sub(v.decomposeDirection);
        });
        time++;
      } else {
        subMeshes.forEach((v) => {
          v.position.copy(v.position_0);
        });
        clearInterval(itv);
      }
    }, 50);
  }
}
// 设置模型是否启用顶点颜色
function setVertexColors(isOpen, mesh) {
  if (!mesh) {
    isVertexColors.value = isOpen;
    if (data.mesh) mesh = data.mesh;
    else return;
  }
  if (mesh.isMesh) {
    mesh.material.vertexColors = isOpen;
    mesh.material_0.vertexColors = isOpen;
  } else if (mesh.children) {
    mesh.children.forEach((v) => {
      if (v) setVertexColors(isOpen, v);
    });
  }
}
// 选中某个部件
function setSelectedMesh(mesh) {
  if (data.outlinePass.selectedObjects[0]) {
    resetMtl(data.outlinePass.selectedObjects[0]);
  } else {
    setOpacity(0.1);
  }
  
  selectedPart.value = mesh;
  setMtl(
    new THREE.ShaderMaterial({
      uniforms: {
        u_color: {
          value: new THREE.Color(0xff0000),
        },
        time: {
          value: 0,
        },
      },
      side: THREE.DoubleSide,
      vertexShader: `
      varying vec2 vUv;
      varying vec3 p;
      void main() {
        vUv = uv;
        p = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
      fragmentShader: `
      precision mediump float;
      uniform float time;
      varying vec2 vUv;
      varying vec3 p;
      void main() {
        float x = vUv.x;
        if (x < 0.1) x = abs(p.x) / 2.0;
        float y = vUv.y;
        if (y < 0.1) y = abs(p.y) / 2.0;
        gl_FragColor = vec4(time, x, y, 1.0);
      }`,
    }),
    mesh
  );
  data.outlinePass.selectedObjects[0] = mesh;
  if (info.value) {
    info.value.innerHTML = mesh.name;
  }
}
// 点击某个部件
function setClickedMesh(mesh) {
  data.clickedMesh = mesh;
  dialogVisible.value = true;
}
// 绘制渐变纹理 colors: ['rgba(0, 100, 255, 1)', 'rgb(0, 200, 255)', ...]
function drawTexture(...colors) {
  let canvas = document.createElement("canvas");
  let size = 1000;
  canvas.width = canvas.height = size;
  let ctx = canvas.getContext("2d");

  let v1 = [0, 0];
  let v2 = [0, 1];
  let gradient = ctx.createLinearGradient(
    v1[0] * size,
    v1[1] * size,
    v2[0] * size,
    v2[1] * size
  );
  if (!colors.length) {
    // 没有传参数，默认渐变颜色为天空蓝
    gradient.addColorStop(0, "rgba(50, 150, 255, 1)");
    gradient.addColorStop(0.5, "rgba(100, 150, 200, 1)");
    gradient.addColorStop(1, "rgba(150, 150, 150, 1)");
  } else if (colors.length === 1) {
    // 参数中只有一种颜色时
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[0]);
  } else {
    let step = 1 / (colors.length - 1);
    let progress = 0;
    for (let color of colors) {
      gradient.addColorStop(progress, color);
      progress += step;
    }
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  let texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  return texture;
}
// 处理点击模型按钮事件
function handleModelButtonClick(index) {
  if (modelLoading.value) {
    if (info.value) {
      info.value.innerHTML =
        '<span style="color: #f22">请等待当前模型加载完成</span>';
    }
    return;
  }
  meshNameIndex.value = index;
}
// 添加创建默认模型的方法
function createDefaultMesh() {
  try {
    // 移除旧模型
    if (data.mesh) {
      data.scene.remove(data.mesh);
      disposeModel(data.mesh);
    }

    // 创建一个简单的立方体作为默认模型
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshPhongMaterial({
      color: 0x3080ff,
      transparent: true,
      side: THREE.DoubleSide,
      vertexColors: isVertexColors.value,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "默认立方体";

    data.mesh = mesh;
    data.scene.add(mesh);

    // 更新模型位置
    updateModelPosition(mesh);

    // 更新子模型列表
    getSubMeshes();

    if (info.value) {
      info.value.innerHTML = "已创建默认模型";
    }

    console.log("创建默认模型成功");
  } catch (err) {
    console.error("创建默认模型失败", err);
  }
}
// 修改模型优化函数
function optimizeModel(model) {
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      // 优化几何体
      if (child.geometry) {
        if (child.geometry.attributes && child.geometry.attributes.position) {
          child.geometry.computeVertexNormals();
        }
      }
      
      // 优化材质
      if (child.material) {
        // 保存原始材质属性
        const originalColor = child.material.color ? child.material.color.clone() : new THREE.Color(0xcccccc);
        const originalMap = child.material.map;
        const originalMetalness = child.material.metalness !== undefined ? child.material.metalness : 0.5;
        const originalRoughness = child.material.roughness !== undefined ? child.material.roughness : 0.5;

        // 创建新的PBR材质
        child.material = new THREE.MeshStandardMaterial({
          color: originalColor,
          map: originalMap,
          metalness: originalMetalness,
          roughness: originalRoughness,
          transparent: true,
          opacity: 1.0,
          side: THREE.DoubleSide,
          envMapIntensity: 1.0
        });
      }
    }
  });
}

// 添加新的方法
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

function toggleAutoRotate() {
  autoRotate.value = !autoRotate.value;
  data.orbitControls.autoRotate = autoRotate.value;
}

// 添加资源释放函数
function disposeModel(model) {
  model.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => {
            if (material.map) material.map.dispose();
            material.dispose();
          });
        } else {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      }
    }
  });
}

// 添加模型位置更新函数
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

// 添加环境贴图加载
function loadEnvironmentMap() {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const envMapTexture = new THREE.TextureLoader().load(
    '/envmap.jpg',  // 确保有这个环境贴图文件
    (texture) => {
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      data.scene.environment = envMap;
      texture.dispose();
      pmremGenerator.dispose();
    }
  );
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

.submesh {
  margin: 0;
  padding: 10px 0;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.submesh:hover {
  background-color: #6af;
  color: white;
}

/* 添加模型控制按钮样式 */
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

/* 添加高亮效果样式 */
.highlight {
  outline: 2px solid #ff0000;
  outline-offset: 2px;
}

/* 添加加载动画样式 */
.loading-spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 50px;
  height: 50px;
  border: 5px solid #f3f3f3;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: translate(-50%, -50%) rotate(0deg); }
  100% { transform: translate(-50%, -50%) rotate(360deg); }
}

/* 添加信息面板样式 */
.info-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.9);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  max-width: 300px;
  z-index: 2;
}

.info-panel h3 {
  margin: 0 0 10px 0;
  color: #333;
}

.info-panel p {
  margin: 5px 0;
  color: #666;
}

/* 添加性能监控样式 */
#stats {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 2;
}

/* 添加进度条样式 */
.model-progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 4px;
  background: #4CAF50;
  width: 0%;
  transition: width 0.3s ease;
  z-index: 2;
}

/* 添加加载状态样式 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3;
}
</style>
