// main.js
// 主入口，负责初始化各模块
console.log('main.js开始加载 - 立即执行');

// 所有 import 语句必须在文件顶部
import { Pendulum } from './pendulum.js';
import { Camera } from './camera.js';
import { ChartModule } from './chart.js';
import { ExportModule } from './export.js';
import { Utils } from './utils.js';
import { pendulumWebSocket, AngleTimeRecorder } from './websocket-client.js';
import { AIAssistant } from './ai-assistant.js';
import { VoiceAssistant } from './voice-assistant.js';

console.log('main.js模块导入完成');
console.log('ExportModule导入状态:', typeof ExportModule);

window.PendulumApp = {
  Pendulum,
  Camera,
  Chart: ChartModule,
  Export: ExportModule,
  Utils,
  WebSocket: pendulumWebSocket,
  AngleTimeRecorder: AngleTimeRecorder,
  AIAssistant: AIAssistant,
  VoiceAssistant: VoiceAssistant,
  // 添加调试信息
  debugModules() {
    console.log('Pendulum模块:', this.Pendulum);
    console.log('Camera模块:', this.Camera);
    console.log('Chart模块:', this.Chart);
    console.log('Export模块:', this.Export);
    console.log('Utils模块:', this.Utils);
    console.log('WebSocket模块:', this.WebSocket);
    console.log('AngleTimeRecorder模块:', this.AngleTimeRecorder);
  },
  init() {
    console.log('PendulumApp.init()开始');
    try {
      this.debugModules();
    this.Pendulum.init();
      console.log('Pendulum.init()完成');
    this.Camera.init();
      console.log('Camera.init()完成');
    this.Chart.init();
      console.log('Chart.init()完成');
      console.log('准备调用Export.init()');
    this.Export.init();
      console.log('Export.init()完成');
    this.AngleTimeRecorder.init();
      console.log('AngleTimeRecorder.init()完成');
    this.AIAssistant.init();
      console.log('AIAssistant.init()完成');
    this.VoiceAssistant.init();
      console.log('VoiceAssistant.init()完成');
      console.log('PendulumApp.init()完成');
    } catch (error) {
      console.error('PendulumApp.init()执行过程中出错:', error);
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded事件触发');


  // 延迟更长时间确保DOM完全加载
  setTimeout(() => {
    try {
      console.log('准备调用PendulumApp.init()');

      // 检查关键元素是否存在
      const canvas = document.getElementById('pendulumCanvas');
      if (!canvas) {
        console.error('Canvas元素未找到，延迟重试...');
        setTimeout(() => {
          PendulumApp.init();
        }, 500);
        return;
      }

      PendulumApp.init();
      console.log('PendulumApp.init()调用完成');

    } catch (error) {
      console.error('PendulumApp.init()调用失败:', error);
    }
  }, 200);

  // 设置WebSocket连接状态指示器
  const syncStatus2 = document.getElementById('syncStatus2');
  pendulumWebSocket.onConnect(() => {
    if (syncStatus2) {
      syncStatus2.innerHTML = 'WebSocket已连接';
      syncStatus2.className = 'status-value running';
    }
    console.log('WebSocket连接已建立');
    
    // 连接成功后立即请求数据
    pendulumWebSocket.requestState();
    pendulumWebSocket.requestAngleHistory();
    pendulumWebSocket.requestPositionHistory();
    pendulumWebSocket.requestLogs();
    pendulumWebSocket.requestSerialLogs();
  });
  
  pendulumWebSocket.onDisconnect(() => {
    if (syncStatus2) {
      syncStatus2.innerHTML = 'WebSocket已断开';
      syncStatus2.className = 'status-value waiting';
    }
    console.log('WebSocket连接已断开');
  });
  
  pendulumWebSocket.onError(() => {
    if (syncStatus2) {
      syncStatus2.innerHTML = 'WebSocket错误';
      syncStatus2.className = 'status-value error';
    }
  });
  
  // 监听摆状态更新
  pendulumWebSocket.onPendulumState((state) => {
    // 将WebSocket数据传递给pendulum模块进行同步
    if (PendulumApp.Pendulum && PendulumApp.Pendulum.syncPendulumAnimation) {
      PendulumApp.Pendulum.syncPendulumAnimation(state);
    }

    // 角度记录器状态更新
    if (PendulumApp.AngleTimeRecorder) {
      PendulumApp.AngleTimeRecorder.handlePendulumState(state);
    }

    // 检查实验开始和结束
    const runStatus = document.getElementById('runStatus');
    if (runStatus) {
      if (state.isRunning) {
        runStatus.className = 'run-status running';
        runStatus.querySelector('.status-text').textContent = '运行中';
      } else {
        runStatus.className = 'run-status not-running';
        runStatus.querySelector('.status-text').textContent = '未运行';
      }
    }
    
    // 更新FPS和延迟显示
    const fpsDisplay = document.getElementById('fpsDisplay');
    const latencyDisplay = document.getElementById('latencyDisplay');
    
    if (fpsDisplay) {
      // 优先使用后端发送的FPS数据，并对显示做平滑处理，避免跳动
      const rawFps = state.fps || PendulumApp.Pendulum.currentFps || 0;
      // 初始化平滑器
      if (!window._fpsSmooth) window._fpsSmooth = { value: 0, lastUpdate: 0 };
      const alpha = 0.4; // 平滑系数（0-1），越小越平滑
      const current = Math.max(0, Math.min(60, rawFps));
      window._fpsSmooth.value = window._fpsSmooth.value === 0 ? current : (alpha * current + (1 - alpha) * window._fpsSmooth.value);
      const nowTs = Date.now();
      // 限制刷新频率，避免UI频繁抖动
      if (nowTs - window._fpsSmooth.lastUpdate >= 400) {
        const roundedFps = Math.max(0, Math.min(60, Math.round(window._fpsSmooth.value)));
        fpsDisplay.textContent = String(roundedFps);
        window._fpsSmooth.lastShown = roundedFps;
        window._fpsSmooth.lastUpdate = nowTs;
      }
      // 使用最后一次展示的值，避免变量未定义
      const displayFps = (window._fpsSmooth.lastShown !== undefined)
        ? window._fpsSmooth.lastShown
        : Math.max(0, Math.min(60, Math.round(window._fpsSmooth.value)));
      
      fpsDisplay.className = 'status-value';
      if (displayFps >= 25) {
        fpsDisplay.classList.add('running');
      } else if (displayFps >= 15) {
        fpsDisplay.classList.add('waiting');
      } else {
        fpsDisplay.classList.add('error');
      }
    }
    
    if (latencyDisplay) {
      const now = Date.now();
      // 确保时间戳是毫秒单位，并且计算正确的延迟
      const timestamp = state.timestamp || now;
      
      // 如果时间戳异常大，可能是错误的，设为0
      let latency = 0;
      if (timestamp && timestamp < 1e12) { // 如果时间戳合理
        latency = Math.abs(now - timestamp);
      }
      
      // 如果延迟异常大（超过10秒）或者是NaN，可能是时间戳错误，显示0
      if (latency > 10000 || isNaN(latency)) {
        latencyDisplay.textContent = '0ms';
      } else {
        latencyDisplay.textContent = `${Math.round(latency)}ms`;
      }
      
      latencyDisplay.className = 'status-value';
      if (latency <= 50) {
        latencyDisplay.classList.add('running');
      } else if (latency <= 150) {
        latencyDisplay.classList.add('waiting');
      } else {
        latencyDisplay.classList.add('error');
      }
    }
  });

  // 移除可能导致冲突的定时器
  // WebSocket连接后会自动接收数据，不需要主动轮询
  // setInterval(() => {
  //   if (pendulumWebSocket.connected) {
  //     pendulumWebSocket.requestState();
  //           }
  // }, 16);  // 每16ms请求一次状态更新，确保实时同步
  
  // 保留日志更新定时器，降低频率
  setInterval(() => {
    if (pendulumWebSocket.connected) {
      pendulumWebSocket.requestLogs();
      pendulumWebSocket.requestSerialLogs();
    }
  }, 2000);  // 每2秒请求一次日志更新


}); 