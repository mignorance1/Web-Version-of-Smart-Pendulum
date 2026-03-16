// chart.js - 修改时间: 2025-08-03 17:30
// 图表相关模块
import { pendulumWebSocket } from './websocket-client.js';

/**
 * ChartModule 负责角度-时间图和XY轨迹图的初始化与动态更新
 */
export const ChartModule = {
    angleChart: null,
    xyChart: null,
    xyAllData: [],
    xyDuration: 0.5,
    angleChartTimer: null,
    xyChartTimer: null,
    // 添加本地历史数据缓存
    angleHistory: [],
    positionHistory: [],
  
    /**
     * 初始化图表模块，绑定滑块事件，定时刷新
     */
    init() {
      this.setupAngleChart();
      this.setupXYChart();

      // 确保图表标题正确 - 修改版本 2025-08-03 17:30
      console.log('ChartModule: 正在设置图表标题...');
      const angleChartTitle = document.querySelector('#angleChart').closest('.chart-container').querySelector('.chart-title');
      const xyChartTitle = document.querySelector('#xyChart').closest('.chart-container').querySelector('.chart-title');
      if (angleChartTitle) {
        angleChartTitle.textContent = '角度-时间曲线';
        console.log('ChartModule: 角度图表标题已设置为:', angleChartTitle.textContent);
      }
      if (xyChartTitle) {
        xyChartTitle.textContent = '小球XY位置轨迹';
        console.log('ChartModule: XY轨迹图表标题已设置为:', xyChartTitle.textContent);
      }

      // 绑定XY轨迹显示时长滑块
      const xyDurationSlider = document.getElementById('xyDuration');
      const xyDurationValue = document.getElementById('xyDurationValue');
      if (xyDurationSlider) {
        xyDurationSlider.addEventListener('input', () => {
          this.xyDuration = parseFloat(xyDurationSlider.value);
          xyDurationValue.textContent = this.xyDuration.toFixed(1);
          this.renderXYChart();
        });
      }

      // 注册WebSocket回调
      pendulumWebSocket.onAngleHistory(data => {
        this.angleHistory = data || [];
        this.updateAngleChart();
      });

      pendulumWebSocket.onPositionHistory(data => {
        this.positionHistory = data || [];
        this.updateXYChart();
      });

      // 定时刷新图表
      this.angleChartTimer = setInterval(() => this.updateAngleChart(), 500); // 降低刷新频率为500ms
      this.xyChartTimer = setInterval(() => this.updateXYChart(), 500); // 降低刷新频率为500ms
    },
  
    /**
     * 初始化角度-时间图
     */
    setupAngleChart() {
      const ctx = document.getElementById('angleChart').getContext('2d');
      this.angleChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: '角度 (°)',
            data: [],
            borderColor: '#42a5f5',
            backgroundColor: 'rgba(66,165,245,0.08)',
            pointRadius: 0,
            borderWidth: 2,
            tension: 0.2,
            fill: true
          }]
        },
        options: {
          responsive: true,
          animation: { duration: 0 },
          plugins: { legend: { display: false } },
          scales: {
            x: {
              title: { display: true, text: '时间 (s)' },
              ticks: { color: '#bbdefb', maxTicksLimit: 8 }
            },
            y: {
              title: { display: true, text: '角度 (°)' },
              ticks: { color: '#bbdefb' },
              min: -30,
              max: 30
            }
          }
        }
      });
    },
  
    /**
     * 初始化XY轨迹图
     */
    setupXYChart() {
      const ctx = document.getElementById('xyChart').getContext('2d');
      this.xyChart = new Chart(ctx, {
        type: 'scatter',
        data: {
          datasets: [{
            label: '轨迹',
            data: [],
            borderColor: '#ff9800',
            backgroundColor: '#ff9800',
            pointRadius: 3,
            showLine: false,
            fill: false
          }]
        },
        options: {
          responsive: true,
          animation: { duration: 0 },
          plugins: { legend: { display: false } },
          scales: {
            x: {
              title: { display: true, text: 'X 像素' },
              ticks: { color: '#bbdefb' }
            },
            y: {
              title: { display: true, text: 'Y 像素' },
              ticks: { color: '#bbdefb' }
            }
          }
        }
      });
    },
  
    /**
     * 更新角度-时间图
     * 只使用WebSocket数据（摄像头数据）
     */
    updateAngleChart() {
      if (!this.angleChart) return;
      
      // 只使用WebSocket数据，不再使用动画数据
        if (!this.angleHistory || this.angleHistory.length === 0) {
              this.angleChart.data.labels = [];
              this.angleChart.data.datasets[0].data = [];
              this.angleChart.options.scales.y.min = -30;
              this.angleChart.options.scales.y.max = 30;
              this.angleChart.update('none');
              return;
            }
        
        const t0 = this.angleHistory[0].time;
        this.angleChart.data.labels = this.angleHistory.map(d => (d.time - t0).toFixed(2));
        this.angleChart.data.datasets[0].data = this.angleHistory.map(d => d.angle);
        const maxabs = Math.max(10, Math.ceil(Math.max(...this.angleHistory.map(d => Math.abs(d.angle))) / 5) * 5);
            this.angleChart.options.scales.y.min = -maxabs;
            this.angleChart.options.scales.y.max = maxabs;
            this.angleChart.update('none');
    },
  
    /**
     * 更新XY轨迹图
     * 只使用WebSocket数据（摄像头数据）
     */
    updateXYChart() {
      if (!this.xyChart) return;
      
      // 只使用WebSocket数据，不再使用动画数据
            this.renderXYChart();
    },
  
    /**
     * 渲染XY轨迹图（使用WebSocket数据）
     */
    renderXYChart() {
      if (!this.xyChart) return;
      
      if (!this.positionHistory || this.positionHistory.length === 0) {
        this.xyChart.data.datasets[0].data = [];
        this.xyChart.options.scales.x.min = -100;
        this.xyChart.options.scales.x.max = 100;
        this.xyChart.options.scales.y.min = -100;
        this.xyChart.options.scales.y.max = 100;
        this.xyChart.update('none');
        return;
      }
      
      const tmax = this.positionHistory[this.positionHistory.length-1].time;
      const tmin = tmax - this.xyDuration;
      const filtered = this.positionHistory.filter(d => d.time >= tmin);
      let maxabsX = 100, maxabsY = 100;
      
      if (filtered.length > 0) {
        maxabsX = Math.max(50, Math.ceil(Math.max(...filtered.map(d => Math.abs(d.x))) / 50) * 50);
        maxabsY = Math.max(50, Math.ceil(Math.max(...filtered.map(d => Math.abs(d.y))) / 50) * 50);
      }
      
      this.xyChart.options.scales.x.min = -maxabsX;
      this.xyChart.options.scales.x.max = maxabsX;
      this.xyChart.options.scales.y.min = -maxabsY;
      this.xyChart.options.scales.y.max = maxabsY;
      this.xyChart.data.datasets[0].data = filtered.map(d => ({x: d.x, y: d.y}));
      this.xyChart.update('none');
    }
  };