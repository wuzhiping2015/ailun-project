<template>
  <div class="mapbox-maritime-map">
    <div ref="mapContainer" class="map-container"></div>

    <div class="control-panel">
      <h3>海事地图控制台</h3>
      
      <div class="control-section">
        <h4>地图控制</h4>
        <button @click="toggleMapType">
          地图类型: {{ currentMapType === 'standard' ? '标准' : '卫星' }}
        </button>
        <button @click="toggleWeather">
          天气显示: {{ weatherVisible ? "开" : "关" }}
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
      </div>
      
      <div class="control-section">
        <h4>船舶控制</h4>
        <button @click="toggleShips">
          船舶显示: {{ shipsVisible ? "开" : "关" }}
        </button>
        <button @click="toggleTrackHistory">
          航迹显示: {{ showTrackHistory ? "开" : "关" }}
        </button>
        <button @click="togglePlannedRoute">
          计划航线: {{ showPlannedRoute ? "开" : "关" }}
        </button>
        
        <!-- 船舶类型图例 -->
        <div class="ship-legend">
          <h5>船舶类型图例</h5>
          <div class="legend-item">
            <div class="legend-icon" style="color: #3498db;">▲</div>
            <div class="legend-text">集装箱船</div>
          </div>
          <div class="legend-item">
            <div class="legend-icon" style="color: #e74c3c;">◆</div>
            <div class="legend-text">油轮</div>
          </div>
          <div class="legend-item">
            <div class="legend-icon" style="color: #f39c12;">■</div>
            <div class="legend-text">散货船</div>
          </div>
          <div class="legend-item">
            <div class="legend-icon" style="color: #27ae60;">●</div>
            <div class="legend-text">滚装船</div>
          </div>
          <div class="legend-item">
            <div class="legend-icon" style="color: #8e44ad;">▼</div>
            <div class="legend-text">渔船</div>
          </div>
        </div>
      </div>
      
      <div class="control-section">
        <h4>模拟控制</h4>
        <button @click="startSimulation" :disabled="simulationActive">
          开始模拟航行
        </button>
        <button @click="stopSimulation" :disabled="!simulationActive">
          停止模拟
        </button>
        
        <div class="speed-control">
          <label>模拟速度:</label>
          <div class="speed-buttons">
            <button 
              v-for="option in speedOptions" 
              :key="option.value"
              @click="changeSimulationSpeed(option.value)"
              :class="{ active: simulationSpeed === option.value }"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
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
        <h3>船舶详细信息</h3>
        <div class="info-grid">
          <div class="info-section basic-info">
            <h4>基本信息</h4>
            <div class="ship-id-block">
              <p><strong>M/N:</strong> {{ selectedShip.name }} ({{ selectedShip.nameEn }})</p>
              <p><strong>IMO:</strong> {{ selectedShip.imo }}</p>
              <p><strong>MMSI:</strong> {{ selectedShip.mmsi }}</p>
              <p><strong>CallSign:</strong> {{ selectedShip.callsign }}</p>
              <p><strong>船舶类型:</strong> {{ selectedShip.type }}</p>
              <p><strong>状态:</strong> {{ selectedShip.status }}</p>
              <p><strong>船旗:</strong> {{ selectedShip.flag }}</p>
            </div>
          </div>
          
          <div class="info-section navigation-info">
            <h4>航行信息</h4>
            <p><strong>经度:</strong> {{ selectedShip.position[0].toFixed(4) }}</p>
            <p><strong>纬度:</strong> {{ selectedShip.position[1].toFixed(4) }}</p>
            <p><strong>SOG:</strong> {{ selectedShip.sog }}</p>
            <p><strong>COG:</strong> {{ selectedShip.cog }}°</p>
            <p><strong>航向:</strong> {{ selectedShip.heading.toFixed(1) }}°</p>
            <p><strong>速度:</strong> {{ selectedShip.speed.toFixed(1) }} 节</p>
            <p><strong>目的地:</strong> {{ selectedShip.destination }}</p>
            <p><strong>预计到达:</strong> {{ selectedShip.eta }}</p>
          </div>
          
          <div class="info-section vessel-info">
            <h4>船舶规格</h4>
            <p><strong>长度:</strong> {{ selectedShip.length }}米</p>
            <p><strong>宽度:</strong> {{ selectedShip.width }}米</p>
            <p><strong>吃水:</strong> {{ selectedShip.draft }}米</p>
            <p><strong>载重量:</strong> {{ selectedShip.capacity }}</p>
            <p><strong>船首吃水:</strong> {{ selectedShip.fore_draft }}米</p>
            <p><strong>船尾吃水:</strong> {{ selectedShip.aft_draft }}米</p>
          </div>
          
          <div class="info-section status-info">
            <h4>运行状态</h4>
            <div class="gauge-container">
              <div class="gauge fuel-gauge">
                <div class="gauge-label">燃油剩余</div>
                <div class="gauge-bar">
                  <div class="gauge-fill" :style="{ width: selectedShip.fuelRemaining + '%', 
                           backgroundColor: getFuelColor(selectedShip.fuelRemaining) }"></div>
                </div>
                <div class="gauge-value">{{ selectedShip.fuelRemaining.toFixed(1) }}%</div>
              </div>
              
              <div class="gauge cargo-gauge">
                <div class="gauge-label">载货量</div>
                <div class="gauge-bar">
                  <div class="gauge-fill" :style="{ width: selectedShip.cargoLoad + '%', backgroundColor: '#2ecc71' }"></div>
                </div>
                <div class="gauge-value">{{ selectedShip.cargoLoad }}%</div>
              </div>
              
              <div class="gauge route-gauge">
                <div class="gauge-label">航程进度</div>
                <div class="gauge-bar">
                  <div class="gauge-fill" :style="{ width: getRouteProgress(selectedShip) + '%', backgroundColor: '#3498db' }"></div>
                </div>
                <div class="gauge-value">{{ getRouteProgress(selectedShip).toFixed(1) }}%</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="info-actions">
          <button @click="centerOnShip(selectedShip)">居中显示</button>
          <button @click="closeInfoPanel">关闭</button>
        </div>
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
      simulationSpeed: 1, // 模拟速度倍数
      ships: [
        { 
          id: 'ship1', 
          name: '海洋明珠号', 
          position: [120.15, 30.26], 
          speed: 15, 
          heading: 45,
          routeIndex: 0,
          marker: null,
          type: '集装箱船',
          length: 300,
          width: 40,
          draft: 14.5,
          capacity: '8000 TEU',
          status: '正常航行',
          destination: '上海港',
          eta: '2023-12-28 08:00',
          // 添加航行轨迹记录
          trackHistory: [[120.15, 30.26]],
          // 模拟数据 - 剩余燃油
          fuelRemaining: 85,
          // 模拟数据 - 当前载货量
          cargoLoad: 76,
          // 船舶识别信息
          mmsi: 10086,
          imo: '1020980',
          callsign: '1020980',
          // 更多详细信息
          nameEn: 'Ocean Pearl',
          flag: 'CN',
          cog: 45, // Course Over Ground
          sog: 'NaNkn', // Speed Over Ground
          fore_draft: 13.2,
          aft_draft: 14.8
        },
        { 
          id: 'ship2', 
          name: '远洋探索者', 
          position: [121.0, 31.0], 
          speed: 12, 
          heading: 135,
          routeIndex: 0,
          marker: null,
          type: '散货船',
          length: 250,
          width: 32,
          draft: 12.8,
          capacity: '85000 DWT',
          status: '正常航行',
          destination: '宁波舟山港',
          eta: '2023-12-25 14:30',
          // 添加航行轨迹记录
          trackHistory: [[121.0, 31.0]],
          // 模拟数据 - 剩余燃油
          fuelRemaining: 72,
          // 模拟数据 - 当前载货量
          cargoLoad: 90,
          // 船舶识别信息
          mmsi: 10087,
          imo: '1020981',
          callsign: '1020981',
          // 更多详细信息
          nameEn: 'Ocean Explorer',
          flag: 'CN',
          cog: 135, // Course Over Ground
          sog: '12kn', // Speed Over Ground
          fore_draft: 11.8,
          aft_draft: 12.5
        },
        { 
          id: 'ship3', 
          name: '东方之星', 
          position: [122.05, 32.05], 
          speed: 14, 
          heading: 225,
          routeIndex: 0,
          marker: null,
          type: '油轮',
          length: 280,
          width: 38,
          draft: 13.5,
          capacity: '120000 DWT',
          status: '正常航行',
          destination: '洋山港',
          eta: '2023-12-30 18:45',
          // 添加航行轨迹记录
          trackHistory: [[122.05, 32.05]],
          // 模拟数据 - 剩余燃油
          fuelRemaining: 65,
          // 模拟数据 - 当前载货量
          cargoLoad: 82,
          // 船舶识别信息
          mmsi: 10088,
          imo: '1020982',
          callsign: '1020982',
          // 更多详细信息
          nameEn: 'Eastern Star',
          flag: 'CN',
          cog: 225, // Course Over Ground
          sog: '14kn', // Speed Over Ground
          fore_draft: 13.2,
          aft_draft: 13.8
        },
        { 
          id: 'ship4', 
          name: '金海捷运', 
          position: [121.5, 31.5], 
          speed: 16, 
          heading: 180,
          routeIndex: 0,
          marker: null,
          type: '滚装船',
          length: 210,
          width: 30,
          draft: 10.5,
          capacity: '2500 LUM',
          status: '正常航行',
          destination: '上海港',
          eta: '2023-12-27 10:15',
          // 添加航行轨迹记录
          trackHistory: [[121.5, 31.5]],
          // 模拟数据 - 剩余燃油
          fuelRemaining: 78,
          // 模拟数据 - 当前载货量
          cargoLoad: 68,
          // 船舶识别信息
          mmsi: 10089,
          imo: '1020983',
          callsign: '1020983',
          // 更多详细信息
          nameEn: 'Golden Express',
          flag: 'CN',
          cog: 180, // Course Over Ground
          sog: '16kn', // Speed Over Ground
          fore_draft: 10.2,
          aft_draft: 10.8
        },
        { 
          id: 'ship5', 
          name: '蓝鲸号', 
          position: [121.8, 30.8], 
          speed: 9, 
          heading: 90,
          routeIndex: 0,
          marker: null,
          type: '渔船',
          length: 65,
          width: 12,
          draft: 5.2,
          capacity: '150 吨',
          status: '正常航行',
          destination: '舟山港',
          eta: '2023-12-26 16:30',
          // 添加航行轨迹记录
          trackHistory: [[121.8, 30.8]],
          // 模拟数据 - 剩余燃油
          fuelRemaining: 45,
          // 模拟数据 - 当前载货量
          cargoLoad: 60,
          // 船舶识别信息
          mmsi: 10090,
          imo: '1020984',
          callsign: '1020984',
          // 更多详细信息
          nameEn: 'Blue Whale',
          flag: 'CN',
          cog: 90, // Course Over Ground
          sog: '9kn', // Speed Over Ground
          fore_draft: 5.0,
          aft_draft: 5.4
        }
      ],
      selectedShip: null,
      // 更丰富的航线数据
      routes: {
        ship1: [
          [120.15, 30.26],
          [120.35, 30.36],
          [120.55, 30.6],
          [120.8, 30.8],
          [121.0, 31.0],
          [121.2, 31.1],
          [121.35, 31.16],
          [121.47, 31.23]
        ],
        ship2: [
          [121.0, 31.0],
          [120.9, 30.9],
          [120.8, 30.75],
          [120.7, 30.6],
          [120.5, 30.4],
          [120.3, 30.3],
          [120.15, 30.26]
        ],
        ship3: [
          [122.05, 32.05],
          [121.95, 31.9],
          [121.85, 31.7],
          [121.75, 31.5],
          [121.65, 31.35],
          [121.56, 31.2],
          [121.47, 31.23]
        ],
        ship4: [
          [121.5, 31.5],
          [121.4, 31.4],
          [121.3, 31.3],
          [121.2, 31.2],
          [121.1, 31.1],
          [121.0, 31.0],
          [120.8, 30.8],
          [120.6, 30.6],
          [120.4, 30.4],
          [120.2, 30.3],
          [120.15, 30.26]
        ],
        ship5: [
          [121.8, 30.8],
          [121.7, 30.7],
          [121.6, 30.6],
          [121.5, 30.5],
          [121.4, 30.3],
          [121.3, 30.1],
          [121.2, 29.9],
          [121.1, 29.8],
          [121.0, 29.7],
          [120.9, 29.8],
          [120.8, 29.9]
        ]
      },
      // 添加航线颜色
      routeColors: {
        ship1: '#00FF00', // 绿色
        ship2: '#0088FF', // 蓝色
        ship3: '#FF8800', // 橙色
        ship4: '#27ae60', // 绿色
        ship5: '#8e44ad'  // 紫色
      },
      weatherArea: null,
      routePolylines: {},
      shipTracks: {},  // 存储船舶实际航迹
      ports: [],
      weatherMarker: null,
      // 添加历史路径是否显示的开关
      showTrackHistory: true,
      // 添加示范路径是否显示的开关
      showPlannedRoute: true,
      // 添加模拟速度选项
      speedOptions: [
        { label: '0.5x', value: 0.5 },
        { label: '1x', value: 1 },
        { label: '2x', value: 2 },
        { label: '5x', value: 5 }
      ],
      // 港口数据扩展
      portData: [
        { name: '上海港', position: [31.23, 121.47], type: '集装箱港口', capacity: '4350万TEU/年', berths: 46 },
        { name: '宁波舟山港', position: [29.86, 121.56], type: '综合港口', capacity: '3100万TEU/年', berths: 39 },
        { name: '洋山港', position: [30.62, 122.09], type: '深水港', capacity: '2500万TEU/年', berths: 32 }
      ]
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
      
      // 使用扩展的港口数据
      this.portData.forEach(port => {
        // 使用自定义图标
        const portIcon = L.divIcon({
          html: `<div class="port-icon">⚓</div>`,
          className: 'port-marker',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        
        const marker = L.marker(port.position, {
          icon: portIcon,
          title: port.name
        }).addTo(this.map);
        
        // 添加更丰富的弹出信息
        const popupContent = `
          <div class="port-popup">
            <h4>${port.name}</h4>
            <p><strong>类型:</strong> ${port.type}</p>
            <p><strong>年吞吐量:</strong> ${port.capacity}</p>
            <p><strong>泊位数:</strong> ${port.berths}</p>
          </div>
        `;
        
        marker.bindPopup(popupContent);
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
      
      // 添加船舶航线
      Object.keys(this.routes).forEach(shipId => {
        // 转换坐标顺序为Leaflet格式
        const routeLatLng = this.routes[shipId].map(coord => [coord[1], coord[0]]);
        
        // 使用船舶特定的颜色
        const routeColor = this.routeColors[shipId] || '#00FF00';
        
        // 创建折线
        const polyline = L.polyline(routeLatLng, {
          color: routeColor,
          weight: 2,
          dashArray: '5, 5',
          opacity: 0.7
        }).addTo(this.map);
        
        // 保存航线引用
        this.routePolylines[shipId] = polyline;
        
        // 创建轨迹线 - 用于记录实际航行路径
        const trackLine = L.polyline([], {
          color: routeColor,
          weight: 3,
          opacity: 0.9
        }).addTo(this.map);
        
        this.shipTracks[shipId] = trackLine;
      });
    },
    
    addShips() {
      if (!this.mapLoaded || !window.L) return;
      
      // 添加船舶图标
      this.ships.forEach(ship => {
        // 基于船舶类型选择不同的图标和颜色
        let shipSymbol = '▲'; // 默认三角形为集装箱船
        let iconColor = this.routeColors[ship.id] || '#2980b9';
        let iconScale = 1.2; // 默认缩放
        
        // 根据船舶类型确定图标和颜色
        if (ship.type === '集装箱船') {
          shipSymbol = '▲';
          iconColor = '#3498db'; // 蓝色
          iconScale = 1.3;
        } else if (ship.type === '油轮') {
          shipSymbol = '◆';
          iconColor = '#e74c3c'; // 红色
          iconScale = 1.4;
        } else if (ship.type === '散货船') {
          shipSymbol = '■';
          iconColor = '#f39c12'; // 黄色
          iconScale = 1.3;
        } else if (ship.type === '滚装船') {
          shipSymbol = '●';
          iconColor = '#27ae60'; // 绿色
          iconScale = 1.3;
        } else if (ship.type === '渔船') {
          shipSymbol = '▼';
          iconColor = '#8e44ad'; // 紫色
          iconScale = 1.0; // 小一些，因为渔船通常较小
        }
        
        // 创建更精美的HTML船舶图标
        const shipHtml = `
          <div class="ship-icon-wrapper ship-wrapper-${ship.type}" style="transform: rotate(${ship.heading}deg); transform-origin: center center;">
            <div class="ship-icon ship-${ship.type}" style="color: ${iconColor}; transform: scale(${iconScale});">${shipSymbol}</div>
            <div class="ship-shadow"></div>
            <div class="ship-label">${ship.name}</div>
          </div>
        `;
        
        // Leaflet使用自定义图标
        const shipIcon = L.divIcon({
          html: shipHtml,
          className: 'ship-marker',
          iconSize: [50, 50],     // 增大图标尺寸 
          iconAnchor: [25, 25]    // 锚点居中
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
              // 根据模拟速度计算新的位置
              ship.routeIndex += 0.1 * this.simulationSpeed; // 细化移动，使动画更流畅
              
              // 确保routeIndex不超过数组上限
              if (ship.routeIndex >= route.length - 1) {
                ship.routeIndex = route.length - 1;
              }
              
              // 计算当前路段中的精确位置（线性插值）
              const currentIndex = Math.floor(ship.routeIndex);
              const nextIndex = Math.min(currentIndex + 1, route.length - 1);
              const fraction = ship.routeIndex - currentIndex;
              
              const currentPos = route[currentIndex];
              const nextPos = route[nextIndex];
              
              // 线性插值计算当前位置
              const interpolatedLng = currentPos[0] + (nextPos[0] - currentPos[0]) * fraction;
              const interpolatedLat = currentPos[1] + (nextPos[1] - currentPos[1]) * fraction;
              ship.position = [interpolatedLng, interpolatedLat];
              
              // 更新航向
              ship.heading = this.calculateHeading(currentPos, nextPos);
              
              // 更新速度（模拟变化）
              ship.speed = Math.max(10, Math.min(18, ship.speed + (Math.random() - 0.5)));
              
              // 更新船舶状态
              if (ship.routeIndex > route.length * 0.9) {
                ship.status = '即将抵达';
              } else if (ship.routeIndex > route.length * 0.5) {
                ship.status = '正常航行';
              } else {
                ship.status = '起航';
              }
              
              // 更新ETA（模拟变化）
              const etaDate = new Date();
              const hoursToAdd = (route.length - ship.routeIndex) / (ship.speed * 0.1);
              etaDate.setHours(etaDate.getHours() + hoursToAdd);
              ship.eta = etaDate.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              });
              
              // 减少燃油剩余量
              ship.fuelRemaining = Math.max(0, ship.fuelRemaining - 0.05 * this.simulationSpeed);
              
              // 记录航迹
              ship.trackHistory.push([...ship.position]);
              
              // 更新轨迹线
              if (this.showTrackHistory && this.shipTracks[ship.id]) {
                const trackLatLng = ship.trackHistory.map(coord => [coord[1], coord[0]]);
                this.shipTracks[ship.id].setLatLngs(trackLatLng);
              }
            } else {
              // 到达终点，重置到起点
              ship.routeIndex = 0;
              ship.position = route[0];
              ship.trackHistory = [route[0]];
              
              if (this.shipTracks[ship.id]) {
                this.shipTracks[ship.id].setLatLngs([]);
              }
              
              if (route.length > 1) {
                const nextPos = route[1];
                ship.heading = this.calculateHeading(route[0], nextPos);
              }
              
              // 重置燃油和货物
              ship.fuelRemaining = 100;
              ship.cargoLoad = Math.floor(Math.random() * 30) + 70; // 70-100%
              ship.status = '重新起航';
            }
            
            // 更新船舶标记位置和角度
            if (ship.marker) {
              // Leaflet使用setLatLng，注意坐标顺序
              const latLng = [ship.position[1], ship.position[0]];
              ship.marker.setLatLng(latLng);
              
              // 基于船舶类型选择不同的图标
              let shipSymbol = '▲'; // 默认
              let iconColor = this.routeColors[ship.id] || '#2980b9';
              let iconScale = 1.2; // 默认缩放
              
              // 根据船舶类型确定图标和颜色
              if (ship.type === '集装箱船') {
                shipSymbol = '▲';
                iconColor = '#3498db'; // 蓝色
                iconScale = 1.3;
              } else if (ship.type === '油轮') {
                shipSymbol = '◆';
                iconColor = '#e74c3c'; // 红色
                iconScale = 1.4;
              } else if (ship.type === '散货船') {
                shipSymbol = '■';
                iconColor = '#f39c12'; // 黄色
                iconScale = 1.3;
              } else if (ship.type === '滚装船') {
                shipSymbol = '●';
                iconColor = '#27ae60'; // 绿色
                iconScale = 1.3;
              } else if (ship.type === '渔船') {
                shipSymbol = '▼';
                iconColor = '#8e44ad'; // 紫色
                iconScale = 1.0;
              }
              
              // 创建更精美的HTML船舶图标
              const shipHtml = `
                <div class="ship-icon-wrapper ship-wrapper-${ship.type}" style="transform: rotate(${ship.heading}deg); transform-origin: center center;">
                  <div class="ship-icon ship-${ship.type}" style="color: ${iconColor}; transform: scale(${iconScale});">${shipSymbol}</div>
                  <div class="ship-shadow"></div>
                  <div class="ship-label">${ship.name}</div>
                </div>
              `;
              
              // 更新图标
              const shipIcon = L.divIcon({
                html: shipHtml,
                className: 'ship-marker',
                iconSize: [50, 50],
                iconAnchor: [25, 25]
              });
              
              ship.marker.setIcon(shipIcon);
              
              // 如果这是当前选中的船舶，更新信息面板
              if (this.selectedShip && this.selectedShip.id === ship.id) {
                this.selectedShip = {...ship};
              }
            }
          }
        });
      }, 100); // 更频繁更新以使动画更流畅
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
    },
    
    toggleTrackHistory() {
      this.showTrackHistory = !this.showTrackHistory;
    },
    
    togglePlannedRoute() {
      this.showPlannedRoute = !this.showPlannedRoute;
    },
    
    changeSimulationSpeed(speed) {
      this.simulationSpeed = speed;
    },
    
    getRouteProgress(ship) {
      const route = this.routes[ship.id];
      if (!route || route.length <= 1) return 0;
      
      // 使用当前路径索引计算进度
      return (ship.routeIndex / (route.length - 1)) * 100;
    },
    
    centerOnShip(ship) {
      if (this.map && ship && ship.position) {
        // 注意坐标转换：Leaflet使用[lat, lng]格式
        const latLng = [ship.position[1], ship.position[0]];
        this.map.setView(latLng, 10); // 10是一个适合查看船舶的缩放级别
      }
    },
    
    getFuelColor(fuelRemaining) {
      if (fuelRemaining > 80) return '#2ecc71';
      if (fuelRemaining > 50) return '#f1c40f';
      return '#e74c3c';
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
  background: rgba(255, 255, 255, 0.9);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  max-width: 280px;
  overflow-y: auto;
  max-height: calc(100vh - 60px);
}

.control-panel h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #2c3e50;
  text-align: center;
  border-bottom: 1px solid #eee;
  padding-bottom: 5px;
}

.control-section {
  margin-bottom: 15px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.control-section:last-child {
  border-bottom: none;
}

.control-section h4 {
  margin-top: 0;
  margin-bottom: 8px;
  color: #2c3e50;
  font-size: 16px;
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
  background: rgba(255, 255, 255, 0.95);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  width: 500px;
  max-width: 90%;
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

.info-content {
  position: relative;
}

.info-grid {
  display: flex;
  flex-wrap: wrap;
}

.info-section {
  width: 45%;
  margin: 10px;
}

.info-section h4 {
  margin-top: 0;
  margin-bottom: 5px;
  color: #2c3e50;
}

.info-section p {
  margin: 5px 0;
  font-size: 14px;
}

.info-actions {
  margin-top: 10px;
  text-align: right;
}

.info-actions button {
  margin-left: 10px;
  padding: 6px 12px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.info-actions button:hover {
  background: #c0392b;
}

.gauge-container {
  margin-top: 10px;
}

.gauge {
  margin-bottom: 10px;
}

.gauge-label {
  font-weight: bold;
  margin-bottom: 5px;
}

.gauge-bar {
  height: 20px;
  background-color: #f3f3f3;
  border-radius: 10px;
  overflow: hidden;
}

.gauge-fill {
  height: 100%;
  background-color: #2ecc71;
}

.gauge-value {
  text-align: right;
  padding-right: 5px;
  font-weight: bold;
}

.speed-control {
  margin-top: 10px;
}

.speed-buttons {
  display: flex;
  justify-content: space-between;
  margin-top: 5px;
}

.speed-buttons button {
  padding: 4px 8px;
  margin: 0 2px;
  background: #95a5a6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.speed-buttons button.active {
  background: #e74c3c;
}

.port-icon {
  font-size: 20px;
  color: #8e44ad;
}

.port-popup {
  padding: 5px;
}

.port-popup h4 {
  margin: 0 0 5px 0;
  color: #2c3e50;
}

.port-popup p {
  margin: 2px 0;
  font-size: 12px;
}

.ship-icon-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ship-icon {
  font-size: 30px;  /* 增大字体大小 */
  font-weight: bold;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  z-index: 2;
}

.ship-shadow {
  position: absolute;
  width: 24px;
  height: 8px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 50%;
  bottom: -8px;
  z-index: 1;
}

.ship-label {
  position: absolute;
  bottom: -20px;
  font-size: 10px;
  white-space: nowrap;
  background-color: rgba(255, 255, 255, 0.7);
  padding: 1px 3px;
  border-radius: 2px;
  z-index: 3;
}

/* 为不同船舶类型设置特定样式 */
.ship-集装箱船 {
  transform: scale(1.3);
}

.ship-油轮 {
  transform: scale(1.4);
}

.ship-散货船 {
  transform: scale(1.3);
}

.ship-滚装船 {
  transform: scale(1.3);
}

.ship-渔船 {
  transform: scale(1.0);
}

/* 调整信息面板样式 */
.ship-id-block {
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 10px;
}

.info-section {
  margin-bottom: 15px;
}

.info-section h4 {
  border-bottom: 1px solid #e9ecef;
  padding-bottom: 5px;
  margin-bottom: 10px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.info-panel {
  max-width: 700px;
  max-height: 80vh;
  overflow-y: auto;
}

.info-content {
  padding: 20px;
}

/* 添加船舶类型图例样式 */
.ship-legend {
  margin-top: 15px;
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 4px;
  padding: 8px;
  border: 1px solid #e9ecef;
}

.ship-legend h5 {
  margin: 0 0 8px 0;
  font-size: 14px;
  text-align: center;
  border-bottom: 1px solid #e9ecef;
  padding-bottom: 4px;
}

.legend-item {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.legend-icon {
  font-size: 20px;
  margin-right: 8px;
  font-weight: bold;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.legend-text {
  font-size: 12px;
}
</style>
