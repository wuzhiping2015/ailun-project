<template>
  <div class="mapbox-maritime-map">
    <div ref="mapContainer" class="map-container"></div>

    <div class="control-panel">
      <button @click="toggleMapType">切换地图类型</button>
      <button @click="toggleWeather">
        天气显示: {{ weatherVisible ? "开" : "关" }}
      </button>
      <button @click="toggleShips">
        船舶显示: {{ shipsVisible ? "开" : "关" }}
      </button>
      <button @click="startSimulation" :disabled="simulationActive">
        开始模拟航行
      </button>
      <button @click="stopSimulation" :disabled="!simulationActive">
        停止模拟
      </button>
      <div class="zoom-control">
        <label>缩放级别: {{ zoomLevel.toFixed(1) }}</label>
        <input
          type="range"
          min="3"
          max="18"
          step="0.5"
          v-model="zoomLevel"
          @input="updateZoom"
        />
      </div>
      <div class="coordinates">
        <label>经度: {{ center[0].toFixed(4) }}</label>
        <label>纬度: {{ center[1].toFixed(4) }}</label>
      </div>
    </div>

    <div v-if="mapError" class="error-panel">
      <div class="error-content">
        <h3>地图加载错误</h3>
        <p class="error-message">{{ mapError }}</p>

        <!-- 关于Leaflet地图加载的问题 -->
        <div>
          <p class="error-tip">解决方案：</p>
          <ol>
            <li>检查网络连接，确保能够访问 unpkg.com 获取Leaflet库</li>
            <li>如果网络问题导致无法加载Leaflet，您可以下载Leaflet并本地引入</li>
            <li>如果您在中国大陆，可以考虑使用国内CDN：<code>https://cdn.bootcdn.net/ajax/libs/leaflet/1.9.4/leaflet.js</code></li>
          </ol>
          <p class="error-tip">
            优势提示:
            <ul>
              <li>✅ Leaflet + OpenStreetMap 无需API密钥</li>
              <li>✅ 不依赖第三方Cookie，避免Chrome浏览器限制</li>
              <li>✅ 开源、轻量，加载速度快</li>
            </ul>
          </p>
        </div>

        <button @click="retryMapLoad" class="retry-button">重试加载</button>
        <button @click="checkEnvironment" class="check-button">环境检查</button>
      </div>
    </div>

    <div class="info-panel" v-if="selectedShip">
      <div class="info-content">
        <h3>船舶信息</h3>
        <p><strong>ID:</strong> {{ selectedShip.id }}</p>
        <p><strong>名称:</strong> {{ selectedShip.name }}</p>
        <p><strong>速度:</strong> {{ selectedShip.speed }} 节</p>
        <p><strong>航向:</strong> {{ selectedShip.heading }}°</p>
        <button @click="closeInfoPanel">关闭</button>
      </div>
    </div>

    <div v-if="showEnvironmentInfo" class="env-panel">
      <div class="env-content">
        <h3>环境信息</h3>
        <p>
          <strong>Mapbox令牌状态：</strong>
          {{ mapboxToken ? "已设置" : "未设置" }}
        </p>
        <p>
          <strong>令牌值：</strong> <code>{{ maskToken(mapboxToken) }}</code>
        </p>
        <p v-if="hasQuotesInToken" class="warning-text">
          ⚠️ 检测到令牌包含引号，这可能导致认证失败
        </p>
        <p><strong>浏览器：</strong> {{ getBrowserInfo() }}</p>
        <p>
          <strong>Cookie设置：</strong>
          {{ areCookiesEnabled() ? "已启用" : "已禁用或部分禁用" }}
        </p>
        <button @click="closeEnvironmentPanel">关闭</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MapboxMaritimeMap',
  data() {
    return {
      map: null,
      mapLoaded: false,
      mapError: null,
      showEnvironmentInfo: false,
      // 尝试从环境变量获取token，如果不存在则使用默认值
      mapboxToken: "",
      center: [120.15, 30.26],
      zoomLevel: 5,
      currentMapType: 'standard', // 默认标准地图
      weatherVisible: true,
      shipsVisible: true,
      simulationActive: false,
      simulationInterval: null,
      ships: [
        { 
          id: 'ship1', 
          name: '海洋明珠号', 
          position: [120.15, 30.26], 
          speed: 15, 
          heading: 45,
          routeIndex: 0,
          marker: null
        },
        { 
          id: 'ship2', 
          name: '远洋探索者', 
          position: [121.0, 31.0], 
          speed: 12, 
          heading: 135,
          routeIndex: 0,
          marker: null
        }
      ],
      selectedShip: null,
      routes: {
        ship1: [
          [120.15, 30.26],
          [120.5, 30.5],
          [121.0, 31.0],
          [121.47, 31.23],
          [122.05, 32.05]
        ],
        ship2: [
          [121.0, 31.0],
          [120.8, 30.8],
          [120.5, 30.5],
          [120.3, 30.3],
          [120.15, 30.26]
        ]
      },
      weatherArea: null,
      routePolylines: {},
      ports: [],
      weatherMarker: null
    };
  },
  computed: {
    hasQuotesInToken() {
      return (
        this.mapboxToken &&
        (this.mapboxToken.includes('"') || this.mapboxToken.includes("'"))
      );
    },
  },
  mounted() {
    // 修改为加载Leaflet地图
    this.loadLeafletMap();
    
    // 监听窗口大小变化以调整地图大小
    window.addEventListener('resize', this.handleResize);
  },
  beforeUnmount() {
    // 清理资源
    this.cleanupResources();
  },
  methods: {
    loadLeafletMap() {
      // 动态加载Leaflet脚本和样式
      const linkElement = document.createElement('link');
      linkElement.rel = 'stylesheet';
      linkElement.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(linkElement);

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => {
        this.initMap();
      };
      script.onerror = (error) => {
        console.error('Leaflet地图加载失败:', error);
        this.mapError = 'Leaflet地图API加载失败，请检查网络连接';
      };
      document.head.appendChild(script);
    },
    
    initMap() {
      try {
        // 检查L(Leaflet)是否可用
        if (!window.L) {
          throw new Error('Leaflet地图API未正确加载，可能是网络问题');
        }
        
        // 创建Leaflet地图实例
        this.map = L.map(this.$refs.mapContainer).setView(this.center, this.zoomLevel);
        
        // 添加OpenStreetMap图层（免费，无需密钥）
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);
        
        // 地图加载完成
        this.mapLoaded = true;
        
        // 添加港口标记
        this.addPorts();
        
        // 添加天气区域
        this.addWeatherLayer();
        
        // 添加航线
        this.addRoutesLayer();
        
        // 添加船舶
        this.addShips();
        
        // 监听地图事件
        this.map.on('moveend', this.updateCenter);
        this.map.on('zoomend', this.updateZoomLevel);
      } catch (error) {
        console.error('地图初始化失败:', error);
        this.mapError = '地图初始化失败: ' + error.message;
      }
    },
    
    addPorts() {
      if (!this.mapLoaded || !window.L) return;
      
      // 添加港口标记
      const portData = [
        { name: '上海港', position: [31.23, 121.47] },  // 注意Leaflet使用[lat, lng]格式
        { name: '宁波舟山港', position: [29.86, 121.56] }
      ];
      
      portData.forEach(port => {
        const marker = L.marker(port.position).addTo(this.map);
        marker.bindPopup(port.name);
        this.ports.push(marker);
      });
    },
    
    addWeatherLayer() {
      if (!this.mapLoaded || !window.L) return;
      
      // 定义天气区域的坐标 (注意顺序：[lat, lng])
      const weatherCoords = [
        [29.5, 119.5],
        [29.5, 120.5],
        [30.5, 120.5],
        [30.5, 119.5]
      ];
      
      // 创建多边形
      this.weatherArea = L.polygon(weatherCoords, {
        color: '#FF0000',
        fillColor: '#FF0000',
        fillOpacity: 0.3
      }).addTo(this.map);
      
      // 创建标记显示天气信息
      this.weatherMarker = L.marker([30, 120]).addTo(this.map);
      this.weatherMarker.bindPopup('台风预警<br>风速: 25节<br>浪高: 3.5米').openPopup();
    },
    
    addRoutesLayer() {
      if (!this.mapLoaded || !window.L) return;
      
      // 添加船舶航线 (注意顺序：[lat, lng])
      Object.keys(this.routes).forEach(shipId => {
        // 转换坐标顺序为Leaflet格式
        const routeLatLng = this.routes[shipId].map(coord => [coord[1], coord[0]]);
        
        // 创建折线
        const polyline = L.polyline(routeLatLng, {
          color: '#00FF00',
          weight: 2,
          dashArray: '5, 5'
        }).addTo(this.map);
        
        // 保存航线引用
        this.routePolylines[shipId] = polyline;
      });
    },
    
    addShips() {
      if (!this.mapLoaded || !window.L) return;
      
      // 添加船舶图标
      this.ships.forEach(ship => {
        // Leaflet使用自定义图标
        const shipIcon = L.divIcon({
          html: `<div class="ship-icon" style="transform: rotate(${ship.heading}deg);">▲</div>`,
          className: 'ship-marker',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        
        // 坐标顺序转换为[lat, lng]
        const position = [ship.position[1], ship.position[0]];
        
        const marker = L.marker(position, {
          icon: shipIcon,
          title: ship.name
        }).addTo(this.map);
        
        // 绑定点击事件
        marker.on('click', () => {
          this.showShipInfo(ship.id);
        });
        
        // 保存标记引用
        ship.marker = marker;
      });
    },
    
    toggleMapType() {
      if (!this.map || !window.L) return;
      
      if (this.currentMapType === 'standard') {
        // 切换到卫星图 (使用Esri卫星图层，也是免费的)
        this.map.eachLayer(layer => {
          if (layer instanceof L.TileLayer) {
            this.map.removeLayer(layer);
          }
        });
        
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        }).addTo(this.map);
        
        this.currentMapType = 'satellite';
      } else {
        // 切换到标准图
        this.map.eachLayer(layer => {
          if (layer instanceof L.TileLayer) {
            this.map.removeLayer(layer);
          }
        });
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);
        
        this.currentMapType = 'standard';
      }
    },
    
    toggleWeather() {
      this.weatherVisible = !this.weatherVisible;
      
      if (this.weatherArea) {
        if (this.weatherVisible) {
          this.weatherArea.addTo(this.map);
          this.weatherMarker.addTo(this.map);
        } else {
          this.map.removeLayer(this.weatherArea);
          this.map.removeLayer(this.weatherMarker);
        }
      }
    },
    
    toggleShips() {
      this.shipsVisible = !this.shipsVisible;
      
      // 显示/隐藏所有船舶
      this.ships.forEach(ship => {
        if (ship.marker) {
          if (this.shipsVisible) {
            ship.marker.addTo(this.map);
          } else {
            this.map.removeLayer(ship.marker);
          }
        }
      });
      
      // 显示/隐藏所有航线
      Object.values(this.routePolylines).forEach(polyline => {
        if (this.shipsVisible) {
          polyline.addTo(this.map);
        } else {
          this.map.removeLayer(polyline);
        }
      });
    },
    
    updateZoom() {
      if (this.map) {
        this.map.setZoom(parseFloat(this.zoomLevel));
      }
    },
    
    updateZoomLevel() {
      if (this.map) {
        this.zoomLevel = this.map.getZoom();
      }
    },
    
    updateCenter() {
      if (this.map) {
        const center = this.map.getCenter();
        this.center = [center.lng, center.lat];
      }
    },
    
    handleResize() {
      if (this.map) {
        this.map.setZoom(parseFloat(this.zoomLevel));
      }
    },
    
    showShipInfo(shipId) {
      const ship = this.ships.find(s => s.id === shipId);
      if (ship) {
        this.selectedShip = ship;
      }
    },
    
    closeInfoPanel() {
      this.selectedShip = null;
    },
    
    startSimulation() {
      if (this.simulationActive) return;
      
      this.simulationActive = true;
      this.simulationInterval = setInterval(() => {
        // 更新每艘船的位置
        this.ships.forEach(ship => {
          const route = this.routes[ship.id];
          if (route && route.length > 0) {
            // 获取下一个位置点
            if (ship.routeIndex < route.length - 1) {
              ship.routeIndex++;
              ship.position = route[ship.routeIndex];
              
              // 计算航向（如果有下一个点）
              if (ship.routeIndex < route.length - 1) {
                const currentPos = route[ship.routeIndex];
                const nextPos = route[ship.routeIndex + 1];
                ship.heading = this.calculateHeading(currentPos, nextPos);
              }
            } else {
              // 到达终点，重置到起点
              ship.routeIndex = 0;
              ship.position = route[0];
              
              if (route.length > 1) {
                const nextPos = route[1];
                ship.heading = this.calculateHeading(route[0], nextPos);
              }
            }
            
            // 更新船舶标记位置和角度
            if (ship.marker) {
              ship.marker.setLatLng(ship.position);
              
              // 更新方向
              const content = `
                <div class="ship-icon" style="transform: rotate(${ship.heading}deg);">▲</div>
              `;
              ship.marker.getElement().innerHTML = content;
            }
          }
        });
      }, 2000); // 每2秒更新一次位置
    },
    
    stopSimulation() {
      if (this.simulationInterval) {
        clearInterval(this.simulationInterval);
        this.simulationInterval = null;
      }
      this.simulationActive = false;
    },
    
    calculateHeading(startPos, endPos) {
      // 计算两点之间的航向角度
      const startLng = startPos[0];
      const startLat = startPos[1];
      const endLng = endPos[0];
      const endLat = endPos[1];
      
      const y = Math.sin(endLng - startLng) * Math.cos(endLat);
      const x = Math.cos(startLat) * Math.sin(endLat) -
                Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
      
      let bearing = Math.atan2(y, x) * 180 / Math.PI;
      if (bearing < 0) {
        bearing += 360;
      }
      
      return bearing;
    },
    
    retryMapLoad() {
      this.mapError = null;
      if (this.map) {
        try {
          this.map.remove();
        } catch (e) {
          console.error("清除地图失败:", e);
        }
        this.map = null;
      }
      this.loadLeafletMap();
    },
    
    cleanupResources() {
      // 清理所有定时器和事件监听器
      if (this.simulationInterval) {
        clearInterval(this.simulationInterval);
        this.simulationInterval = null;
      }
      
      // 清理地图实例
      if (this.map) {
        this.map.remove();
        this.map = null;
      }
      
      // 移除窗口事件监听
      window.removeEventListener('resize', this.handleResize);
    },
    
    maskToken(token) {
      if (!token) return "未设置";
      const tokenStr = token.toString();
      if (tokenStr.length < 10) return tokenStr;
      // 只显示开头和结尾的部分，中间用星号代替
      return `${tokenStr.substring(0, 8)}...${tokenStr.substring(
        tokenStr.length - 8
      )}`;
    },
    
    getBrowserInfo() {
      const userAgent = navigator.userAgent;
      let browserName = "未知浏览器";

      if (
        userAgent.indexOf("Chrome") > -1 &&
        userAgent.indexOf("Edge") === -1
      ) {
        browserName = "Chrome";
      } else if (userAgent.indexOf("Firefox") > -1) {
        browserName = "Firefox";
      } else if (userAgent.indexOf("Edge") > -1) {
        browserName = "Edge";
      } else if (userAgent.indexOf("Safari") > -1) {
        browserName = "Safari";
      }

      return `${browserName} (${navigator.userAgent})`;
    },
    
    areCookiesEnabled() {
      try {
        document.cookie = "testcookie=1";
        const hasCookie = document.cookie.indexOf("testcookie=") !== -1;
        document.cookie = "testcookie=1; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        return hasCookie;
      } catch (e) {
        return false;
      }
    },
    
    checkEnvironment() {
      // 检查Leaflet地图API加载状态
      const leafletLoaded = window.L !== undefined;
      
      this.showEnvironmentInfo = true;
      
      // 在环境信息中添加Leaflet地图状态
      this.$nextTick(() => {
        const envContent = document.querySelector('.env-content');
        if (envContent) {
          const mapStatus = document.createElement('p');
          mapStatus.innerHTML = `<strong>Leaflet地图API状态：</strong> ${leafletLoaded ? '已加载' : '<span style="color: red">未加载</span>'}`;
          
          const openSourceInfo = document.createElement('p');
          openSourceInfo.innerHTML = '<strong>地图信息：</strong> <span style="color: green">使用开源Leaflet + OpenStreetMap，无需API密钥</span>';
          
          const cookieWarning = document.createElement('p');
          cookieWarning.innerHTML = '<strong>提示：</strong> <span style="color: green">OpenStreetMap不依赖第三方Cookie，避免了Chrome浏览器限制问题</span>';
          
          envContent.appendChild(mapStatus);
          envContent.appendChild(openSourceInfo);
          envContent.appendChild(cookieWarning);
        }
      });
    },
    
    closeEnvironmentPanel() {
      this.showEnvironmentInfo = false;
    }
  }
};
</script>

<style scoped>
.mapbox-maritime-map {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.map-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.control-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.8);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  max-width: 250px;
}

.control-panel button {
  display: block;
  width: 100%;
  margin: 8px 0;
  padding: 8px 12px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.control-panel button:hover {
  background: #2980b9;
}

.control-panel button:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

.zoom-control {
  margin: 12px 0;
}

.zoom-control label {
  display: block;
  margin-bottom: 5px;
  font-size: 14px;
}

.zoom-control input {
  width: 100%;
}

.coordinates {
  margin-top: 12px;
  font-size: 13px;
}

.coordinates label {
  display: block;
  margin-bottom: 5px;
}

.error-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(255, 255, 255, 0.9);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  max-width: 300px;
}

.error-panel h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #2c3e50;
}

.error-panel p {
  margin: 5px 0;
  font-size: 14px;
}

.error-tip {
  font-weight: bold;
  margin-top: 10px;
  color: #e74c3c;
}

.error-panel ol {
  margin: 5px 0 10px 20px;
  padding: 0;
  font-size: 13px;
}

.error-panel li {
  margin-bottom: 3px;
}

.error-panel a {
  color: #3498db;
  text-decoration: none;
}

.error-panel a:hover {
  text-decoration: underline;
}

.error-panel button {
  margin-top: 10px;
  padding: 6px 12px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.error-panel button:hover {
  background: #c0392b;
}

.info-panel {
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: rgba(255, 255, 255, 0.9);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  max-width: 300px;
}

.info-panel h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #2c3e50;
}

.info-panel p {
  margin: 5px 0;
  font-size: 14px;
}

.info-panel button {
  margin-top: 10px;
  padding: 6px 12px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.info-panel button:hover {
  background: #c0392b;
}

.error-message {
  margin: 5px 0;
  font-size: 14px;
  color: #e74c3c;
  font-weight: bold;
}

.code-example {
  background-color: #f8f9fa;
  padding: 10px;
  border-radius: 4px;
  margin: 10px 0;
  font-size: 12px;
}

.code-example pre {
  margin: 5px 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.code-example p {
  margin: 5px 0;
}

.error-panel ul {
  margin: 0 0 10px 20px;
  padding: 0;
  font-size: 13px;
}

.warning-text {
  color: #f39c12;
  font-weight: bold;
}

.env-panel {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.9);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  max-width: 400px;
}

.env-panel h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #2c3e50;
}

.env-panel p {
  margin: 5px 0;
  font-size: 14px;
}

.retry-button {
  margin-top: 10px;
  margin-right: 10px;
  padding: 6px 12px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.check-button {
  margin-top: 10px;
  padding: 6px 12px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

code {
  font-family: monospace;
  background-color: #f8f9fa;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 90%;
}

.ship-marker {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ship-icon {
  color: #2980b9;
  font-size: 20px;
  font-weight: bold;
  text-shadow: 1px 1px 2px white;
}

.port-label {
  font-size: 12px;
  background-color: rgba(255, 255, 255, 0.8);
  padding: 2px 4px;
  border-radius: 2px;
  border: 1px solid #ccc;
}

.weather-info {
  background-color: rgba(255, 255, 255, 0.8);
  border: 1px solid #e74c3c;
  padding: 5px;
  border-radius: 3px;
  font-size: 12px;
  color: #c0392b;
  width: 120px;
  text-align: center;
  line-height: 1.3;
}
</style>
