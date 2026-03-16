// pendulum.js
// 单摆物理仿真模块

/**
 * Pendulum 模块负责单摆参数、仿真、绘制、实验控制等
 */
export const Pendulum = {
  // 单摆参数与状态
  params: {
    physicalLength: 20, // 摆长，单位cm（初始值20cm）
    displayScale: 2.5,   // 视觉增强比例
    angle: 5,            // 初始角度，单位度
    pivotX: 700,
    pivotY: 180,
    bobRadius: 24,
    angularVelocity: 0,
    angularAcceleration: 0,
    time: 0,
    running: false,
    periodCount: 0,
    lastPeriodTime: 0,
    periods: [],
    periodTiming: false,
    startTime: 0,
    maxAngularVelocity: 0,
    initialEnergy: 0,
    currentEnergy: 0,
    lastHiddenTime: null
  },
  // 画布与控件引用
  canvas: null,
  ctx: null,
  startBtn: null,
  resetBtn: null,
  timer: null,
  // 动画数据
  animationAngleHistory: [],
  animationPositionHistory: [],
  animationStartTime: 0,
  lastDrawTime: 0,
  DRAW_INTERVAL: 16,
  // 摄像头同步相关变量
  isSyncingFromCamera: false,
  lastUpdateTime: 0,
  MIN_UPDATE_INTERVAL: 8,
  angleHistory: [],
  lengthHistory: [],
  timeHistory: [],
  HISTORY_SIZE: 5,
  frameCount: 0,
  lastFpsTime: 0,
  currentFps: 0,
  syncLatency: 0,
  // 添加状态标记，防止多个请求重叠
  isFetchingCameraData: false,
  cameraAngle: 0, // 新增属性，保存摄像头角度
  displayPhysicalLength: 20, // 新增属性，动画显示用摆长（初始值20cm）
  initialAngle: 5, // 新增属性，保存初始摆角
  // 摆长轮询相关属性
  isPollingLength: false,
  lengthPollingInterval: null,
  // 调试开关：是否在左下角显示摆轴坐标
  showDebugInfo: false,
  // 状态防抖动相关变量
  lastValidDataTime: 0,
  statusUpdateDebounce: 0,
  consecutiveValidData: 0,
  consecutiveInvalidData: 0,
  // 动画帧ID，用于控制动画循环
  animationFrameId: null,

  /**
   * 初始化单摆模块，绑定事件、初始化画布
   */
  init() {
    // 获取DOM元素
    this.canvas = document.getElementById('pendulumCanvas');
    if (!this.canvas) {
      console.error('无法找到pendulumCanvas元素');
      return;
    }
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      console.error('无法获取canvas 2d context');
      return;
    }
    this.startBtn = document.getElementById('startBtn');
    this.resetBtn = document.getElementById('resetBtn');
    this.timer = document.getElementById('timer');

    // 初始化状态指示器
    const runStatus = document.getElementById('runStatus');
    const statusText = runStatus?.querySelector('.status-text');
    if (runStatus && statusText) {
      runStatus.classList.remove('running');
      runStatus.classList.add('not-running');
      statusText.textContent = '未运行';
    }

    // 初始化性能统计
    this.frameCount = 0;
    this.lastFpsTime = performance.now();
    this.currentFps = 0;
    this.syncLatency = 0;
    
    // 启动性能统计更新定时器
    setInterval(() => {
      if (!this.params.running) {
        this.updatePerformanceStats();
      }
    }, 1000);


    // 绑定按钮事件
    console.log('准备绑定开始实验按钮事件');
    this.startBtn.addEventListener('click', () => {
      console.log('开始实验按钮被点击');
      this.toggleStart();
    });
    this.resetBtn.addEventListener('click', () => this.reset());
    // 初始化画布
    this.setupCanvas();
    window.addEventListener('resize', () => this.setupCanvas());
    // 初始化实验
    this.reset();
    // 挂载到全局，供其他模块访问
    window.pendulum = this.params;
    
    // 启动持续动画循环，确保无论实验是否运行都能实时显示摄像头数据
    this.simulate();
    // 按钮与信号映射
    const btnMap = [
        {id: 'btnUpM', down: 'w', up: 'a'},
        {id: 'btnDownM', down: 's', up: 'a'},
        {id: 'btnUpU', down: '3', up: '5'},
        {id: 'btnDownU', down: '4', up: '5'},
        {id: 'btnUpN', down: '6', up: '8'},
        {id: 'btnDownN', down: '7', up: '8'},
        {id: 'btnClear', down: '0', up: null}
    ];
    // 定义全局sendKey函数
    window.sendKey = function(key, extra={}) {
        console.log('调用sendKey函数:', key, extra);
        console.log('📡 发送信号到后端:', key);
        fetch('http://127.0.0.1:5000/pendulum_key', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(Object.assign({key}, extra))
        })
        .then(response => {
            console.log('sendKey请求成功:', response.status, '信号:', key);
        })
        .catch(error => {
            console.error('sendKey请求失败:', error, '信号:', key);
        });
    };
    
    btnMap.forEach(({id, down, up}) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        
        // 特殊处理收摆线和放摆线按钮，添加持续轮询
        if (id === 'btnUpM' || id === 'btnDownM') {
            if (down) {
                btn.addEventListener('mousedown', () => {
                    console.log(`🎯 ${id} 按钮按下，发送信号: ${down}`);
                    console.log('🔄 准备开始持续轮询摆长数据...');
                    window.sendKey(down);
                    
                    // 开始持续轮询摆长数据
                    this.startLengthPolling();
                });
            }
            if (up) {
                btn.addEventListener('mouseup', () => {
                    console.log(`🎯 ${id} 按钮释放，发送信号: ${up}`);
                    console.log('🛑 准备停止持续轮询摆长数据...');
                    window.sendKey(up);
                    
                    // 停止持续轮询摆长数据
                    this.stopLengthPolling();
                });
            }
        } else {
            // 其他按钮保持原有逻辑
        if (down) btn.addEventListener('mousedown', () => window.sendKey(down));
        if (up) btn.addEventListener('mouseup', () => window.sendKey(up));
        }
    });
    // 文本框输入n，点击发送
    const btnSendN = document.getElementById('btnSendN');
    if (btnSendN) btnSendN.addEventListener('click', () => {
        const n = parseInt(document.getElementById('inputN').value) || 1;
        window.sendKey('1', {n});
    });
    // 清除按钮点击时清空输入框
    const btnClear = document.getElementById('btnClear');
    if (btnClear) btnClear.addEventListener('click', () => {
        document.getElementById('inputN').value = '';
    });
    
    
    // 禁止输入框聚焦时触发快捷键
    const inputN = document.getElementById('inputN');
    window.inputActive = false;
    if (inputN) {
      inputN.addEventListener('focus', () => { window.inputActive = true; });
      inputN.addEventListener('blur', () => { window.inputActive = false; });
    }
    // 全局快捷键监听时判断
    document.addEventListener('keydown', function(e) {
      if (window.inputActive) return;
      
      // 处理z键设置参考角度
      if (e.key === 'z' || e.key === 'Z') {
        console.log('🔧 z键被按下，设置参考角度');
        window.sendKey('z');
      }
      // 处理p键输出最近10条数据
      else if (e.key === 'p' || e.key === 'P') {
        console.log('📊 p键被按下，输出最近10条数据');
        window.sendKey('p');
      }
      // 处理d键删除参考点和参考角度
      else if (e.key === 'd' || e.key === 'D') {
        console.log('🗑️ d键被按下，删除参考点和参考角度');
        window.sendKey('d');
      }
      // 处理l键启动/终止串口通信
      else if (e.key === 'l' || e.key === 'L') {
        console.log('🔌 l键被按下，启动/终止串口通信');
        window.sendKey('l');
      }
      // 处理x键导出数据为JSON
      else if (e.key === 'x' || e.key === 'X') {
        console.log('📁 x键被按下，导出数据为JSON');
        window.sendKey('x');
      }
    });



    // 点击"d0"按钮发送d0
    const d0Btn = document.getElementById('d0Btn');
    console.log('找到d0按钮:', !!d0Btn);
    if (d0Btn) {
      // 移除之前可能存在的事件监听器
      d0Btn.removeEventListener('click', d0ClickHandler);
      
      // 使用命名函数便于后续调试
      function d0ClickHandler() {
        console.log('d0按钮点击，准备发送d0信号');
        window.sendKey('d0');
        console.log('d0信号已发送');
        
        // 添加点击反馈
        d0Btn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            d0Btn.style.transform = 'scale(1)';
        }, 150);
      }
      
      // 添加新的事件监听器
      d0Btn.addEventListener('click', d0ClickHandler);
      console.log('d0按钮事件监听器已添加');
    }

    // 点击"d1"按钮发送d1
    const d1Btn = document.getElementById('d1Btn');
    if (d1Btn) {
      d1Btn.addEventListener('click', () => {
        window.sendKey('d1');
        // 添加点击反馈
        d1Btn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            d1Btn.style.transform = 'scale(1)';
        }, 150);
      });
    }

    // 添加获取摆长数据的按钮
    const getPendulumLengthBtn = document.getElementById('getPendulumLengthBtn');
    if (getPendulumLengthBtn) {
      getPendulumLengthBtn.addEventListener('click', () => {
        console.log('🔘 获取摆长数据按钮被点击');
        console.log('📋 当前摆长参数:', this.params.physicalLength, 'cm');
        console.log('🎯 目标数据源: PendulumState.length');
        
        // 添加点击反馈
        getPendulumLengthBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
          getPendulumLengthBtn.style.transform = 'scale(1)';
        }, 150);
        
        // 调用获取摆长数据的函数
        this.fetchPendulumLength();
      });
      console.log('✅ 获取摆长数据按钮事件监听器已添加');
    }

    // 添加获取角度数据的按钮
    const getPendulumAngleBtn = document.getElementById('getPendulumAngleBtn');
    if (getPendulumAngleBtn) {
      getPendulumAngleBtn.addEventListener('click', () => {
        console.log('获取角度数据按钮被点击');
        
        // 添加点击反馈
        getPendulumAngleBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
          getPendulumAngleBtn.style.transform = 'scale(1)';
        }, 150);
        
        // 调用获取角度数据的函数
        this.fetchPendulumAngle();
      });
      console.log('获取角度数据按钮事件监听器已添加');
    }

    // 移除可能导致冲突的摄像头数据轮询
    // 不再主动轮询摄像头数据，只通过WebSocket接收数据
    // setInterval(() => {
    //   this.fetchAndSyncFromCamera();
    // }, 16); // 提高频率到16ms，确保实时同步

    // 不再自动轮询获取摆长数据
    // setInterval(() => {
    //   this.fetchPendulumLength();
    // }, 500);

    // 定时刷新曲线
    // setInterval(() => {
    //   this.updateAngleChart();
    //   this.updateXYChart();
    // }, 16);
  },

  /**
   * 从后端获取单片机发送的摆长数据
   */
  fetchPendulumLength() {
    if (!this.params) return;
    
    console.log('🔄 开始获取摆长数据...');
    
    // 显示获取状态
    console.log('🔄 正在获取摆长数据...');
    
    fetch('http://127.0.0.1:5000/get_pendulum_length')
      .then(r => {
        if (!r.ok) {
          throw new Error(`HTTP错误: ${r.status}`);
        }
        console.log(' 摆长数据请求成功，状态码:', r.status);
        return r.json();
      })
      .then(data => {
        console.log('收到摆长数据响应:', data);
        
        // 如果后端返回了有效的摆长数据
        if (data && typeof data.length === 'number' && data.length > 0) {
          // 数据验证：丢弃大于100的异常数据
          if (data.length > 100) {
            console.warn('⚠️ 丢弃异常摆长数据:', data.length, 'cm (大于100)');
            return;
          }
          
          console.log('✅ 收到单片机摆长数据:', data.length, 'cm');
          console.log('数据来源: PendulumState.physical_length');
          
          // 更新摆长参数
          this.params.physicalLength = data.length;
          this.displayPhysicalLength = data.length; // 只在这里更新动画用摆长
          
          console.log('摆长值已更新为:', this.params.physicalLength);
          
          // 更新显示
          this.updateSliders();
          
          // 无论实验是否运行，都重绘动画以确保实时同步
          this.draw();
          console.log('动画已重绘 (摆长数据更新)');
          console.log('当前摆长:', this.displayPhysicalLength, 'cm');
          console.log('轮询状态:', this.isPollingLength ? '进行中' : '已停止');
        } else {
          console.warn('获取摆长数据: 返回数据格式不正确', data);
          console.log('期望的数据格式: {length: number}');
        }
      })
      .catch(error => {
        console.error('❌ 获取摆长数据失败:', error);
        console.log('请检查后端服务是否正常运行');
      });
  },

  /**
   * 从后端获取单片机发送的角度数据
   */
  fetchPendulumAngle() {
    if (!this.params) return;
    
    // 显示获取状态
    console.log(' 正在获取角度数据...');
    
    fetch('http://127.0.0.1:5000/get_pendulum_angle')
      .then(r => {
        if (!r.ok) {
          throw new Error(`HTTP错误: ${r.status}`);
        }
        return r.json();
      })
      .then(data => {
        // 如果后端返回了有效的角度数据
        if (data && typeof data.angle === 'number') {
          console.log('收到单片机角度数据:', data.angle);
          
          // 更新角度参数
          this.params.angle = data.angle;
          

          
          // 更新显示
          this.updateSliders();
          
          // 如果不在运行状态，重绘动画
          if (!this.params.running) {
            this.draw();
          }
        } else {
          console.warn('获取角度数据: 返回数据格式不正确', data);
        }
      })
      .catch(error => {
        console.error('获取角度数据失败:', error);
      });
  },

  /**
   * 设置画布尺寸并重绘
   */
  setupCanvas() {
    const container = this.canvas.parentElement;
    // 优先使用容器的宽度；高度若为0则按宽度的比例回退，避免0高导致看不见
    const containerWidth = (container && container.clientWidth) ? container.clientWidth : (this.canvas.offsetWidth || 600);
    let containerHeight = (container && container.clientHeight) ? container.clientHeight : 0;
    if (!containerHeight || containerHeight < 200) {
      // 回退高度：按宽度的0.7比例，至少400px，避免初始化为0
      containerHeight = Math.max(Math.round(containerWidth * 0.7), 400);
    }

    // 适配高分屏，保证清晰度
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(containerWidth * dpr);
    this.canvas.height = Math.round(containerHeight * dpr);
    this.canvas.style.width = containerWidth + 'px';
    this.canvas.style.height = containerHeight + 'px';

    this.params.pivotX = this.canvas.width / 2;
    this.draw();
  },

  /**
   * 更新滑块显示
   */
  updateSliders() {
    // 角度显示逻辑 - 始终显示摄像头角度
    const cameraAngleText = typeof this.cameraAngle === 'number' ? this.cameraAngle.toFixed(1) : '0.0';
    // 确保负角度正确显示
    const displayAngleText = typeof this.cameraAngle === 'number' && this.cameraAngle >= 0 ? 
      `+${this.cameraAngle.toFixed(1)}°` : 
      `${(typeof this.cameraAngle === 'number' ? this.cameraAngle : 0).toFixed(1)}°`;
    // console.log(`📐 当前角度: 摄像头 ${displayAngleText}`);
  },

  /**
   * 启动/暂停实验
   */
  toggleStart() {
    const runStatus = document.getElementById('runStatus');
    const statusText = runStatus?.querySelector('.status-text');
    const syncStatus2 = document.getElementById('syncStatus2');
    const fpsDisplay = document.getElementById('fpsDisplay');
    const latencyDisplay = document.getElementById('latencyDisplay');

    if (!this.params.running) {
      // 开始实验
      this.params.running = true;
      this.params.time = 0;
      this.params.angularVelocity = 0;
      this.params.periodCount = 0;
      this.params.periods = [];
      this.params.startTime = Date.now();
      this.params.maxAngularVelocity = 0;
      this.animationAngleHistory = [];
      this.animationPositionHistory = [];
      this.animationStartTime = Date.now();
      this.startBtn.textContent = '暂停实验';
      
      // 保存初始摆角
      this.initialAngle = this.params.angle;
      
      // 先发送r信号清空数据，延迟50ms后再发送d0信号
      console.log('toggleStart中准备发送r信号');
      if (typeof window.sendKey === 'function') {
        console.log('window.sendKey是一个函数');
        window.sendKey('r');
        console.log('toggleStart中r信号已发送');
        
        // 延迟50ms后发送d0信号，确保后端有足够时间处理r信号
        setTimeout(() => {
          console.log('toggleStart中准备发送d0信号');
          window.sendKey('d0');
          console.log('toggleStart中d0信号已发送');
        }, 50);
      } else {
        console.error('window.sendKey不是一个函数:', typeof window.sendKey);
      }

      // 更新状态指示器
      if (runStatus && statusText) {
        runStatus.classList.remove('not-running');
        runStatus.classList.add('running');
        statusText.textContent = '正在运行';
      }

      // 更新同步状态
      if (syncStatus2) {
        syncStatus2.innerHTML = '正在运行';
        syncStatus2.className = 'status-value running';
      }

      // 高亮显示FPS和延迟
      if (fpsDisplay) fpsDisplay.classList.add('highlight');
      if (latencyDisplay) latencyDisplay.classList.add('highlight');

      // 启动角度记录器
      if (window.PendulumApp && window.PendulumApp.AngleTimeRecorder) {
        window.PendulumApp.AngleTimeRecorder.startRecording();
        console.log('角度记录器已启动');
      }

      this.updateSliders();
      this.simulate();
      window.currentExperiment = {
        initialAngle: this.params.angle,
        length: this.params.physicalLength,
        periods: [],
        startTime: Date.now(),
        gravity: null
      };
    } else {
      // 暂停实验
      this.params.running = false;
      this.startBtn.textContent = '继续实验';

      // 更新状态指示器
      if (runStatus && statusText) {
        runStatus.classList.remove('running');
        runStatus.classList.add('not-running');
        statusText.textContent = '未运行';
      }

      // 更新同步状态
      if (syncStatus2) {
        syncStatus2.innerHTML = '等待连接';
        syncStatus2.className = 'status-value waiting';
      }

      // 移除高亮
      if (fpsDisplay) fpsDisplay.classList.remove('highlight');
      if (latencyDisplay) latencyDisplay.classList.remove('highlight');

      // 停止角度记录器
      if (window.PendulumApp && window.PendulumApp.AngleTimeRecorder) {
        window.PendulumApp.AngleTimeRecorder.stopRecording();
        console.log('角度记录器已停止');
      }
    }
  },

  /**
   * 单摆物理仿真主循环
   */
  simulate() {
    // 无论实验是否运行，都持续更新摄像头数据
    if (this.params.running) {
      const currentTime = Date.now();
      const deltaTime = Math.min((currentTime - (this.params.startTime + this.params.time * 1000)) / 1000, 0.1);
      this.params.time += deltaTime;
      this.timer.textContent = this.params.time.toFixed(2);
    }
    
    // 始终跟随摄像头数据，确保实时性
    if (typeof this.cameraAngle === 'number') {
      this.params.angle = this.cameraAngle;
    }
    
    // 记录动画数据（使用摄像头角度）
    const now = Date.now();
    const timeFromStart = (now - this.animationStartTime) / 1000;
    if (!window.animationAngleHistory) window.animationAngleHistory = [];
    if (!window.animationPositionHistory) window.animationPositionHistory = [];
    
    // 使用摄像头角度进行动画显示
    const displayAngle = typeof this.cameraAngle === 'number' ? this.cameraAngle : this.params.angle;
    window.animationAngleHistory.push({ time: timeFromStart, angle: displayAngle });
    
    // 计算小球位置（使用摄像头角度）
    const displayAngleRad = displayAngle * Math.PI / 180;
    // 将摆长放大3.75倍用于动画显示（缩短一半，60cm时刚好占满容器）
    const displayLength = this.params.physicalLength * this.params.displayScale * 3.75;
    const bobX = this.params.pivotX + displayLength * Math.sin(displayAngleRad);
    const bobY = this.params.pivotY + displayLength * this.params.displayScale * 3.75 * Math.cos(displayAngleRad);
    window.animationPositionHistory.push({ time: timeFromStart, x: bobX - this.params.pivotX, y: bobY - this.params.pivotY });
    
    if (window.animationAngleHistory.length > 1000) window.animationAngleHistory.shift();
    if (window.animationPositionHistory.length > 1000) window.animationPositionHistory.shift();
    
    // 绘制（使用摄像头角度）
    this.draw();
    
    // 更新性能统计
    this.updatePerformanceStats();
    
    // 使用 requestAnimationFrame 替代 setTimeout，避免无限刷新
    if (!this.animationFrameId) {
      this.animationFrameId = requestAnimationFrame(() => {
        this.animationFrameId = null;
        this.simulate();
      });
    }
  },

  /**
   * 绘制单摆
   */
  draw() {
    // 保障canvas/ctx已就绪，避免早期回调导致的空引用
    if (!this.canvas) this.canvas = document.getElementById('pendulumCanvas');
    if (this.canvas && !this.ctx) this.ctx = this.canvas.getContext('2d');
    if (!this.canvas || !this.ctx) {
      // 初始化尚未完成，暂不绘制
      return;
    }
    const now = performance.now();
    // 在实验运行时或轮询期间，允许更频繁的绘制
    const drawInterval = (this.params.running || this.isPollingLength) ? 8 : this.DRAW_INTERVAL;
    if (now - this.lastDrawTime < drawInterval) return;
    this.lastDrawTime = now;
    const ctx = this.ctx;
    const p = this.params;
    // 角度选择逻辑 - 始终优先使用摄像头角度，确保实时跟随
    let angleToDraw = p.angle;
    if (typeof this.cameraAngle === 'number') {
      // 优先使用摄像头角度，确保实时跟随
      angleToDraw = this.cameraAngle;
    } else if (p.running) {
      // 如果没有摄像头数据，实验运行时使用初始摆角
      angleToDraw = this.initialAngle;
    }
    // 摆长选择逻辑 - 优先使用轮询获取的摆长数据
    let lengthToDraw = p.physicalLength;
    if (typeof this.displayPhysicalLength === 'number') {
      lengthToDraw = this.displayPhysicalLength;
    }
    // 修改角度计算：左边为正，右边为负
    const displayAngle = -angleToDraw; // 反转角度值用于显示
    const angleRad = angleToDraw * Math.PI / 180;
    // 将摆长放大3.75倍用于动画显示（缩短一半，60cm时刚好占满容器）
    const displayLength = lengthToDraw * p.displayScale * 3.75;
    const bobX = p.pivotX + displayLength * Math.sin(angleRad);
    const bobY = p.pivotY + displayLength * Math.cos(angleRad);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // 绘制背景
    this.drawBackground();
    // 绘制单摆支架
    ctx.fillStyle = 'rgba(70, 90, 140, 0.8)';
    ctx.fillRect(p.pivotX - 100, p.pivotY - 40, 200, 40);
    // 绘制刻度盘
    this.drawDial(angleRad);
    // 绘制摆线
    ctx.beginPath();
    ctx.moveTo(p.pivotX, p.pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.strokeStyle = 'rgba(240, 248, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.stroke();
    // 绘制摆球
    this.drawBob(bobX, bobY);
    // 绘制角度标记 - 始终显示
      ctx.font = '18px Arial';
      ctx.fillStyle = '#80deea';
      // 显示角度，使用反转后的角度值（左边为正，右边为负）
      const angleText = displayAngle >= 0 ? `+${displayAngle.toFixed(1)}°` : `${displayAngle.toFixed(1)}°`;
      ctx.fillText(`当前角度: ${angleText}`, p.pivotX + 40, p.pivotY - 25);
      
      // 更新HTML中的实时显示
      const angleDisplay = document.getElementById('pendulumAngleDisplay');
      const lengthDisplay = document.getElementById('pendulumLengthDisplay');
      const periodDisplay = document.getElementById('periodCountDisplay');
      
      if (angleDisplay) {
        angleDisplay.textContent = angleText;
      }
      if (lengthDisplay) {
        lengthDisplay.textContent = `${lengthToDraw.toFixed(1)} cm`;
      }
      if (periodDisplay) {
        // 从当前实验数据中获取周期数
        let periodCount = 0;
        if (window.currentExperiment && window.currentExperiment.periods) {
          periodCount = window.currentExperiment.periods.length;
        }
        periodDisplay.textContent = periodCount.toString();
      }
      
    // 绘制长度标记 - 始终显示
      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.moveTo(p.pivotX, p.pivotY);
      ctx.lineTo(p.pivotX, p.pivotY + displayLength);
      ctx.strokeStyle = 'rgba(100, 180, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '16px Arial';
      ctx.fillStyle = '#80deea';
      ctx.fillText(`摆长: ${lengthToDraw.toFixed(1)} cm`, p.pivotX + 15, p.pivotY + displayLength / 2);
    // 绘制摆轴位置信息 - 仅调试时显示
      if (this.showDebugInfo) {
        ctx.font = '14px Arial';
        ctx.fillStyle = '#ffcc80';
        ctx.fillText(`摆轴: (${p.pivotX.toFixed(0)}, ${p.pivotY.toFixed(0)})`, 10, this.canvas.height - 30);
      }
  },

  /**
   * 绘制背景
   */
  drawBackground() {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, 'rgba(20, 30, 80, 0.4)');
    gradient.addColorStop(1, 'rgba(10, 20, 50, 0.8)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(100, 140, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  },

  /**
   * 绘制刻度盘
   */
  drawDial(angleRad) {
    const ctx = this.ctx;
    const p = this.params;
    const dialRadius = 80;
    ctx.beginPath();
    ctx.arc(p.pivotX, p.pivotY, dialRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let i = -90; i <= 90; i += 10) {
      const rad = i * Math.PI / 180;
      const size = (i % 30 === 0) ? 12 : (i % 15 === 0) ? 8 : 5;
      const innerX = p.pivotX + (dialRadius - size) * Math.sin(rad);
      const innerY = p.pivotY + (dialRadius - size) * Math.cos(rad);
      const outerX = p.pivotX + dialRadius * Math.sin(rad);
      const outerY = p.pivotY + dialRadius * Math.cos(rad);
      ctx.beginPath();
      ctx.moveTo(innerX, innerY);
      ctx.lineTo(outerX, outerY);
      ctx.strokeStyle = (i === 0) ? '#4fc3f7' : 'rgba(100, 180, 255, 0.5)';
      ctx.lineWidth = (i % 30 === 0) ? 2 : 1;
      ctx.stroke();
      if (i % 30 === 0 && i !== 0) {
        const textX = p.pivotX + (dialRadius + 15) * Math.sin(rad);
        const textY = p.pivotY + (dialRadius + 15) * Math.cos(rad);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#90caf9';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // 修改角度显示：左边为正，右边为负
        const displayAngle = -i; // 反转角度值
        const angleText = displayAngle >= 0 ? `+${displayAngle}°` : `${displayAngle}°`;
        ctx.fillText(angleText, textX, textY);
      }
    }
  },

  /**
   * 绘制摆球
   */
  drawBob(bobX, bobY) {
    const ctx = this.ctx;
    const p = this.params;
    const gradient = ctx.createRadialGradient(
      bobX - 10, bobY - 10, p.bobRadius * 0.1,
      bobX, bobY, p.bobRadius
    );
    gradient.addColorStop(0, '#ffcc80');
    gradient.addColorStop(1, '#ffa726');
    ctx.beginPath();
    ctx.arc(bobX, bobY, p.bobRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bobX - p.bobRadius/3, bobY - p.bobRadius/3, p.bobRadius/4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();
    ctx.font = '12px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', bobX, bobY);
  },

  /**
   * 重置实验
   */
  reset() {
    const currentPhysicalLength = this.params.physicalLength;
    this.params = {
      physicalLength: currentPhysicalLength,
      displayScale: 2.5,
      angle: 5,
      pivotX: this.canvas.width / 2,
      pivotY: 180,
      bobRadius: 24,
      angularVelocity: 0,
      angularAcceleration: 0,
      time: 0,
      running: false,
      periodCount: 0,
      lastPeriodTime: 0,
      periods: [],
      periodTiming: false,
      startTime: 0,
      maxAngularVelocity: 0,
      initialEnergy: 0,
      currentEnergy: 0,
      lastHiddenTime: null
    };

    // 停止角度记录器（保留数据用于导出）
    if (window.PendulumApp && window.PendulumApp.AngleTimeRecorder) {
      window.PendulumApp.AngleTimeRecorder.stopRecording();
      console.log('角度记录器已停止记录');
    }

    // 停止动画循环
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // 重置同步标记
    this.isSyncingFromCamera = false;
    
    // 停止摆长轮询
    this.stopLengthPolling();

    // 更新状态指示器
    const runStatus = document.getElementById('runStatus');
    const statusText = runStatus?.querySelector('.status-text');
    if (runStatus && statusText) {
      runStatus.classList.remove('running');
      runStatus.classList.add('not-running');
      statusText.textContent = '未运行';
    }

    // 更新同步状态
    const syncStatus2 = document.getElementById('syncStatus2');
    const fpsDisplay = document.getElementById('fpsDisplay');
    const latencyDisplay = document.getElementById('latencyDisplay');
    
    if (syncStatus2) {
      syncStatus2.innerHTML = '等待连接';
      syncStatus2.className = 'status-value waiting';
    }
    
    // 移除高亮
    if (fpsDisplay) {
      fpsDisplay.classList.remove('highlight');
      fpsDisplay.classList.remove('running', 'waiting', 'error');
      fpsDisplay.textContent = '0';
    }
    
    if (latencyDisplay) {
      latencyDisplay.classList.remove('highlight');
      latencyDisplay.classList.remove('running', 'waiting', 'error');
      latencyDisplay.textContent = '0ms';
    }

    // 清空历史数据
    this.animationAngleHistory = [];
    this.animationPositionHistory = [];
    this.animationStartTime = performance.now();
    this.startBtn.textContent = '开始实验';
    this.timer.textContent = '0.00';
    this.updateSliders();
    this.draw();
    // ...实验数据保存逻辑略...
    this.fetchAndSyncFromCamera();
    // reset() 里清空window上的数组
    if (window.animationAngleHistory) window.animationAngleHistory = [];
    if (window.animationPositionHistory) window.animationPositionHistory = [];
    // --- 按重置实验保存实验数据 ---
    if (!window.experimentGroups) window.experimentGroups = [];
    if (window.currentExperiment) {
      // 立即push当前实验数据（周期可能为空）
      window.experimentGroups.push(window.currentExperiment);
      // 读取serial周期数据
      window.currentExperiment.periods = [];
      try {
        fetch('http://127.0.0.1:5000/get_serial_log')
          .then(r => r.json())
          .then(data => {
            if (data.log && Array.isArray(data.log)) {
              let total = 0;
              window.currentExperiment.periods = [];
              let periodCounter = 1; // 周期编号从1开始
              
              // 只解析当前实验的周期数据，避免重复解析历史数据
              // 查找当前实验开始的时间戳（实验开始时间）
              const experimentStartTime = window.currentExperiment.startTime;
              const currentTime = Date.now();
              
              // 只处理最近的数据（从实验开始到现在的数据）
              const recentData = data.log.filter((line, idx) => {
                // 简单过滤：只处理最近的数据，避免历史数据干扰
                // 这里可以根据实际需要调整过滤逻辑
                return true; // 暂时保留所有数据，后续可以优化
              });
              
              // 记录找到的周期数据数量，用于调试
              let foundPeriods = 0;
              
              recentData.forEach((line, idx) => {
                // 支持 T14.000000,0.873163,41.485348 格式（T开头的周期数据）
                const tMatch = line.match(/T(\d+\.\d+)[,，]([0-9.]+)[,，]([0-9.]+)/);
                if (tMatch) {
                  const originalIndex = parseFloat(tMatch[1]);
                  const duration = parseFloat(tMatch[2]);
                  const totalTime = parseFloat(tMatch[3]);
                  // 过滤掉duration为0的数据
                  if (duration > 0) {
                    window.currentExperiment.periods.push({
                      index: periodCounter, // 使用重新编号的周期编号
                      duration,
                      total: totalTime
                    });
                    periodCounter++; // 递增周期编号
                    foundPeriods++;
                  }
                } else {
                  // 支持 [接收]11.000000,0.967675,10.635322 格式（兼容旧格式）
                  const match = line.match(/(\d+)[,，]([0-9.]+)[,，]([0-9.]+)/);
                  if (match) {
                    const originalIndex = parseInt(match[1]);
                    const duration = parseFloat(match[2]);
                    const totalTime = parseFloat(match[3]);
                    // 过滤掉duration为0的数据
                    if (duration > 0) {
                      window.currentExperiment.periods.push({
                        index: periodCounter, // 使用重新编号的周期编号
                        duration,
                        total: totalTime
                      });
                      periodCounter++; // 递增周期编号
                      foundPeriods++;
                    }
                  }
                }
              });
              
              console.log(`📊 解析到 ${foundPeriods} 个周期数据，原始数据量: ${data.log.length}`);
            }
            // 计算重力加速度
            const periods = window.currentExperiment.periods;
            const length = window.currentExperiment.length;
            if (periods.length > 0) {
              // 过滤掉duration为0的周期数据
              const validPeriods = periods.filter(p => p.duration > 0);
              if (validPeriods.length > 0) {
                const avgT = validPeriods.reduce((a, b) => a + b.duration, 0) / validPeriods.length;
                const L = length / 100;
                window.currentExperiment.gravity = 4 * Math.PI * Math.PI * L / (avgT * avgT);
              } else {
                window.currentExperiment.gravity = null;
              }
            }
            // 更新experimentGroups最后一组
            if (window.experimentGroups && window.experimentGroups.length > 0) {
              const last = window.experimentGroups[window.experimentGroups.length - 1];
              last.periods = window.currentExperiment.periods;
              last.gravity = window.currentExperiment.gravity;
            }
            
            // 更新周期数显示
            const periodDisplay = document.getElementById('periodCountDisplay');
            if (periodDisplay && window.currentExperiment) {
              periodDisplay.textContent = window.currentExperiment.periods.length.toString();
            }
            
            window.currentExperiment = null;
          });
      } catch (e) {
        // 若fetch失败，直接保存空周期
        window.currentExperiment.periods = [];
        // 不再push，已在前面push
        window.currentExperiment = null;
      }
    }
  },

  /**
   * 摄像头同步性能监控更新
   */
  updatePerformanceStats() {
    // 不再自己计算FPS，完全依赖后端数据
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
    
    // 更新FPS和延迟显示
    const fpsDisplay = document.getElementById('fpsDisplay');
    const latencyDisplay = document.getElementById('latencyDisplay');
    
    if (fpsDisplay) {
      fpsDisplay.textContent = this.currentFps;
      // 根据FPS值设置不同的样式
      fpsDisplay.className = 'status-value';
      if (this.currentFps >= 25) {
        fpsDisplay.classList.add('running');
      } else if (this.currentFps >= 15) {
        fpsDisplay.classList.add('waiting');
      } else {
        fpsDisplay.classList.add('error');
      }
    }
    
    if (latencyDisplay) {
      // 确保延迟值合理，如果异常大则显示0
      const latency = Math.abs(this.syncLatency);
      if (latency > 10000 || isNaN(latency)) {
        latencyDisplay.textContent = '0ms';
      } else {
        latencyDisplay.textContent = `${Math.round(latency)}ms`;
      }
      
      // 根据延迟值设置不同的样式
      latencyDisplay.className = 'status-value';
      if (latency <= 50) {
        latencyDisplay.classList.add('running');
      } else if (latency <= 150) {
        latencyDisplay.classList.add('waiting');
      } else {
        latencyDisplay.classList.add('error');
      }
    }
  },

  /**
   * 从后端获取摄像头识别的小球角度，驱动动画实时同步（只同步角度）
   */
  fetchAndSyncFromCamera() {
    // 如果已经在获取数据或不应该获取数据，则返回
    if (this.isFetchingCameraData || !this.params) return;
    
    // 设置标记，表示正在获取数据
    this.isFetchingCameraData = true;
    
    fetch('http://127.0.0.1:5000/get_pendulum_state')
      .then(r => {
        if (!r.ok) {
          throw new Error(`HTTP错误: ${r.status}`);
        }
        return r.json();
      })
      .then(data => {
        // 优先用camera_angle
        if (typeof data.camera_angle === 'number') {
          this.cameraAngle = data.camera_angle;
        } else if (typeof data.angle === 'number') {
          this.cameraAngle = data.angle;
        }
        // 始终用摄像头角度更新动画，无论实验是否运行
        if (typeof this.cameraAngle === 'number') {
          this.params.angle = this.cameraAngle;
          // 立即更新动画，确保实时性
          this.draw();
        }
        // 不再从摄像头同步摆长数据，摆长只通过单片机信号更新
        
        // 记录动画历史数据，在 fetchAndSyncFromCamera 里同步记录历史数据，让曲线有数据。
        const now = performance.now();
        const timeFromStart = (now - this.animationStartTime) / 1000;
        if (!window.animationAngleHistory) window.animationAngleHistory = [];
        if (!window.animationPositionHistory) window.animationPositionHistory = [];
        window.animationAngleHistory.push({ time: timeFromStart, angle: this.params.angle });
        // 计算小球位置
        const p = this.params;
        const angleRad = p.angle * Math.PI / 180;
        // 将摆长放大3.75倍用于动画显示（缩短一半，60cm时刚好占满容器）
        const displayLength = p.physicalLength * p.displayScale * 3.75;
        const bobX = p.pivotX + displayLength * Math.sin(angleRad);
        const bobY = p.pivotY + displayLength * p.displayScale * 3.75 * Math.cos(angleRad);
        window.animationPositionHistory.push({ time: timeFromStart, x: bobX - p.pivotX, y: bobY - p.pivotY });
        // 限制历史数据长度
        if (window.animationAngleHistory.length > 1000) window.animationAngleHistory.shift();
        if (window.animationPositionHistory.length > 1000) window.animationPositionHistory.shift();
        // 同步更新滑块显示
        this.updateSliders && this.updateSliders();
        // 不再强制重绘，避免重复绘制
        // this.draw();
        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) {
          syncStatus.textContent = '✅ 已同步摄像头数据';
          syncStatus.style.color = '#4caf50';
        }
        
        // 更新同步状态2
        const syncStatus2 = document.getElementById('syncStatus2');
        if (syncStatus2) {
          syncStatus2.innerHTML = '✅ 已同步';
          syncStatus2.className = 'status-value running';
        }
        
        // 更新性能统计
        this.frameCount++;
        this.syncLatency = now - (data.timestamp || now);
        this.updatePerformanceStats();

        // 请求完成，重置标记
        this.isFetchingCameraData = false;
      })
      .catch(error => {
        console.warn('获取摄像头数据失败:', error);
        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) {
          syncStatus.textContent = '⚠️ 摄像头数据同步失败';
          syncStatus.style.color = '#f44336';
        }
        
        // 更新同步状态2
        const syncStatus2 = document.getElementById('syncStatus2');
        if (syncStatus2) {
          syncStatus2.innerHTML = '同步失败';
          syncStatus2.className = 'status-value error';
        }
        
        // 更新性能统计
        this.updatePerformanceStats();
        
        // 即使请求失败，也要重置标记
        this.isFetchingCameraData = false;
      });
  },

  /**
   * 开始持续轮询摆长数据
   */
  startLengthPolling() {
    if (this.isPollingLength) {
      console.log ('摆长轮询已在运行中');
      return;
    }
    
    console.log('开始持续轮询摆长数据...');
    console.log('轮询间隔: 100ms');
    this.isPollingLength = true;
    
    // 立即获取一次
    console.log('立即获取摆长数据...');
    this.fetchPendulumLength();
    
    // 设置持续轮询，每100ms获取一次，提高实时性
    this.lengthPollingInterval = setInterval(() => {
      if (this.isPollingLength) {
        console.log('持续轮询获取摆长数据...');
        this.fetchPendulumLength();
      }
    }, 100);
  },

  /**
   * 停止持续轮询摆长数据
   */
  stopLengthPolling() {
    if (!this.isPollingLength) {
      console.log('摆长轮询未在运行');
      return;
    }
    
    console.log('停止持续轮询摆长数据');
    console.log('清除轮询定时器');
    this.isPollingLength = false;
    
    if (this.lengthPollingInterval) {
      clearInterval(this.lengthPollingInterval);
      this.lengthPollingInterval = null;
    }
  },

  /**
   * 摄像头同步动画
   */
  syncPendulumAnimation(data) {
    try {
      const now = Date.now();
      if (now - this.lastUpdateTime < this.MIN_UPDATE_INTERVAL) {
        return;
      }
      this.lastUpdateTime = now;
      
      // 调试信息（保留一次性日志时可注释）
      // console.log('收到数据:', data);
      // console.log('时间戳:', data.timestamp);
      // console.log('当前时间(Date.now()):', now);
      
      // 修复延迟计算：与后端同为 epoch 毫秒
      const timestamp = Number(data.timestamp) || now;
      this.syncLatency = Math.max(0, now - timestamp);
      
      // 检查是否有有效数据
      // 优先使用摄像头角度
      const incomingAngle = (data && typeof data.camera_angle === 'number') ? data.camera_angle : data?.angle;
      const hasValidData = typeof incomingAngle === 'number' && Math.abs(incomingAngle) > 0.1;
      
      if (hasValidData) {
        this.isSyncingFromCamera = true;
        
        // 直接使用摄像头角度，不进行复杂的预测和平滑
        this.cameraAngle = incomingAngle;
        this.params.angle = incomingAngle;
        
        // 更新显示
        this.updateSliders();
        
        // 强制重绘
        this.draw();
        
        // 更新状态为已同步
        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) {
          syncStatus.textContent = '✅ 已同步摄像头数据';
          syncStatus.style.color = '#4caf50';
        }
        
        const syncStatus2 = document.getElementById('syncStatus2');
        if (syncStatus2) {
          syncStatus2.innerHTML = '✅ 已同步';
          syncStatus2.className = 'status-value running';
        }
        
        this.isSyncingFromCamera = false;
      } else {
        // 500ms防抖：近期有有效数据则保持“已同步”不变
        if (this.lastValidDataTime && now - this.lastValidDataTime < 500) {
          this.updatePerformanceStats();
          return;
        }
        // 只有在没有有效数据且超过防抖时间时才显示等待状态
        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) {
          syncStatus.textContent = '⏳ 等待有效数据...';
          syncStatus.style.color = '#ff9800';
        }
        
        const syncStatus2 = document.getElementById('syncStatus2');
        if (syncStatus2) {
          syncStatus2.innerHTML = '⏳ 等待数据';
          syncStatus2.className = 'status-value waiting';
        }
      }
      
      this.updatePerformanceStats();
    } catch (error) {
      console.warn('同步动画处理错误:', error);
      this.isSyncingFromCamera = false;
    }
  }
}; 