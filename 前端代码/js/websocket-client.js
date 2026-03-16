// websocket-client.js
// WebSocket客户端，用于连接到后端WebSocket服务器并接收实时数据

console.log('websocket-client.js文件开始加载');

/**
 * PendulumWebSocket类，负责WebSocket连接和数据处理
 */
export class PendulumWebSocket {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.reconnectInterval = 2000; // 重连间隔，单位毫秒
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10; // 增加最大重连次数
    this.reconnectTimer = null; // 重连定时器
    this.url = 'ws://127.0.0.1:5001'; // WebSocket服务器地址
    this.callbacks = {
      onPendulumState: [],
      onAngleHistory: [],
      onPositionHistory: [],
      onLogs: [],
      onSerialLogs: [],
      onConnect: [],
      onDisconnect: [],
      onError: []
    };
    
    // 自动连接
    this.connect();
    
    // 添加日志处理
    this.onLogs(this._updateBackendLog.bind(this));
    this.onSerialLogs(this._updateSerialLog.bind(this));
  }
  
  /**
   * 连接到WebSocket服务器
   */
  connect() {
    if (this.socket) {
      this.socket.close();
    }
    
    try {
      console.log(`正在连接WebSocket服务器: ${this.url}`);
      this.socket = new WebSocket(this.url);
      
      this.socket.onopen = () => {
        console.log('WebSocket连接已建立');
        this.connected = true;
        this.reconnectAttempts = 0;
        this._triggerCallbacks('onConnect');
        
        // 连接成功后请求初始数据
        this.requestState();
        this.requestAngleHistory();
        this.requestPositionHistory();
        this.requestLogs();
        this.requestSerialLogs();
      };
      
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this._handleMessage(data);
        } catch (error) {
          console.error('解析WebSocket消息失败:', error);
        }
      };
      
      this.socket.onclose = (event) => {
        console.log(`WebSocket连接已关闭，代码: ${event.code}, 原因: ${event.reason}`);
        this.connected = false;
        this._triggerCallbacks('onDisconnect');
        this._scheduleReconnect();
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket错误:', error);
        this._triggerCallbacks('onError', error);
      };
    } catch (error) {
      console.error('创建WebSocket连接失败:', error);
      this._scheduleReconnect();
    }
  }
  
  /**
   * 安排重新连接
   * @private
   */
  _scheduleReconnect() {
    // 清理现有的重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      // 使用指数退避算法，避免频繁重连
      const delay = Math.min(this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1), 30000);
      console.log(`尝试重新连接 (${this.reconnectAttempts}/${this.maxReconnectAttempts})，延迟 ${delay}ms...`);
      
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error(`达到最大重连次数 (${this.maxReconnectAttempts})，停止重连`);
    }
  }
  
  /**
   * 处理接收到的WebSocket消息
   * @param {Object} data - 解析后的消息数据
   * @private
   */
  _handleMessage(data) {
    const type = data.type;
    
    switch (type) {
      case 'pendulum_state':
        this._triggerCallbacks('onPendulumState', data.data);
        break;
      case 'angle_history':
        this._triggerCallbacks('onAngleHistory', data.data.history);
        break;
      case 'position_history':
        this._triggerCallbacks('onPositionHistory', data.data.history);
        break;
      case 'logs':
        this._triggerCallbacks('onLogs', data.data.log);
        break;
      case 'serial_logs':
        this._triggerCallbacks('onSerialLogs', data.data.log);
        break;
      default:
        console.log('收到未知类型的WebSocket消息:', type, data);
    }
  }
  
  /**
   * 触发回调函数
   * @param {string} event - 事件名称
   * @param {*} data - 回调数据
   * @private
   */
  _triggerCallbacks(event, data = null) {
    if (this.callbacks[event]) {
      for (const callback of this.callbacks[event]) {
        try {
          callback(data);
        } catch (error) {
          console.error(`执行${event}回调时出错:`, error);
        }
      }
    }
  }
  
  /**
   * 发送消息到WebSocket服务器
   * @param {Object} message - 要发送的消息对象
   */
  send(message) {
    if (!this.connected) {
      console.warn('WebSocket未连接，无法发送消息');
      return false;
    }
    
    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('发送WebSocket消息失败:', error);
      return false;
    }
  }
  
  /**
   * 请求当前摆状态
   */
  requestState() {
    return this.send({ command: 'get_state' });
  }
  
  /**
   * 请求角度历史数据
   */
  requestAngleHistory() {
    return this.send({ command: 'get_angle_history' });
  }
  
  /**
   * 请求位置历史数据
   */
  requestPositionHistory() {
    return this.send({ command: 'get_position_history' });
  }
  
  /**
   * 请求后端日志
   */
  requestLogs() {
    return this.send({ command: 'get_log' });
  }
  
  /**
   * 请求串口日志
   */
  requestSerialLogs() {
    return this.send({ command: 'get_serial_log' });
  }
  
  /**
   * 发送按键命令
   * @param {string} key - 按键
   * @param {Object} extra - 附加数据
   */
  sendKey(key, extra = {}) {
    return this.send({
      command: 'pendulum_key',
      key: key,
      ...extra
    });
  }
  
  /**
   * 设置HSV阈值
   * @param {Array} lower - HSV下限
   * @param {Array} upper - HSV上限
   */
  setHsv(lower, upper) {
    return this.send({
      command: 'set_hsv',
      lower: lower,
      upper: upper
    });
  }
  
  /**
   * 添加摆状态更新回调
   * @param {Function} callback - 回调函数
   */
  onPendulumState(callback) {
    this.callbacks.onPendulumState.push(callback);
  }
  
  /**
   * 添加角度历史数据更新回调
   * @param {Function} callback - 回调函数
   */
  onAngleHistory(callback) {
    this.callbacks.onAngleHistory.push(callback);
  }
  
  /**
   * 添加位置历史数据更新回调
   * @param {Function} callback - 回调函数
   */
  onPositionHistory(callback) {
    this.callbacks.onPositionHistory.push(callback);
  }
  
  /**
   * 添加日志更新回调
   * @param {Function} callback - 回调函数
   */
  onLogs(callback) {
    this.callbacks.onLogs.push(callback);
  }
  
  /**
   * 添加串口日志更新回调
   * @param {Function} callback - 回调函数
   */
  onSerialLogs(callback) {
    this.callbacks.onSerialLogs.push(callback);
  }
  
  /**
   * 添加连接成功回调
   * @param {Function} callback - 回调函数
   */
  onConnect(callback) {
    this.callbacks.onConnect.push(callback);
  }
  
  /**
   * 添加连接断开回调
   * @param {Function} callback - 回调函数
   */
  onDisconnect(callback) {
    this.callbacks.onDisconnect.push(callback);
  }
  
  /**
   * 添加错误回调
   * @param {Function} callback - 回调函数
   */
  onError(callback) {
    this.callbacks.onError.push(callback);
  }
  
  /**
   * 关闭WebSocket连接
   */
  close() {
    // 清理重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.connected = false;
    this.reconnectAttempts = 0;
  }
  
  /**
   * 更新后端日志
   * @param {Array} logs - 日志数据
   * @private
   */
  _updateBackendLog(logs) {
    const logDiv = document.getElementById('backendLog');
    if (logDiv && logs) {
      logDiv.innerHTML = logs.map(line => `<div>${line}</div>`).join('');
      logDiv.scrollTop = logDiv.scrollHeight; // 自动滚动到最底部
    }
  }
  
  /**
   * 更新串口日志
   * @param {Array} logs - 日志数据
   * @private
   */
  _updateSerialLog(logs) {
    const logDiv = document.getElementById('serialLog');
    if (logDiv && logs) {
      logDiv.innerHTML = logs.map(line => `<div>${line}</div>`).join('');
      logDiv.scrollTop = logDiv.scrollHeight;
    }
  }
}

// 创建全局实例
export const pendulumWebSocket = new PendulumWebSocket();

// 导出全局实例
window.pendulumWebSocket = pendulumWebSocket;

// 角度与时间数据记录模块
export const AngleTimeRecorder = {
  data: [], // 存储角度与时间数据
  isRecording: false, // 是否正在记录
  startTime: null, // 开始时间
  pendulumStarted: false, // 摆球是否开始摆动
  lastAngle: null, // 上一次的角度值
  angleThreshold: 0.5, // 角度变化阈值（度），用于判断摆球是否开始摆动
  timeThreshold: 0.1, // 时间阈值（秒），用于去重

  /**
   * 初始化角度记录器
   */
  init() {
    // 监听角度历史数据
    pendulumWebSocket.onAngleHistory((data) => {
      this.handleAngleHistory(data);
    });

    // 监听摆状态
    pendulumWebSocket.onPendulumState((state) => {
      this.handlePendulumState(state);
    });
  },

  /**
   * 处理角度历史数据
   * @param {Array} data - 角度数据数组
   */
  handleAngleHistory(data) {
    if (!data || !Array.isArray(data)) {
      return;
    }
    
    // 未点击"开始实验"时不记录任何数据
    if (!this.isRecording) {
      return;
    }

    const currentTime = Date.now();

    data.forEach(angleData => {
      const angle = parseFloat(angleData.angle);
      // 后端发送的是 "time" 字段（秒），需要转换为毫秒时间戳
      // 支持两种格式：time（秒）或 timestamp（毫秒）
      let timestamp;
      if (angleData.timestamp !== undefined) {
        // 如果提供了 timestamp（毫秒），直接使用
        timestamp = parseInt(angleData.timestamp);
      } else if (angleData.time !== undefined) {
        // 如果提供了 time（秒），转换为毫秒
        timestamp = Math.round(parseFloat(angleData.time) * 1000);
      } else {
        // 如果都没有，使用当前时间
        timestamp = currentTime;
      }

      // 检查数据有效性（静默跳过无效数据）
      if (isNaN(angle) || isNaN(timestamp) || timestamp <= 0) {
        return;
      }

      // 如果还没有设置开始时间，使用第一个数据点的时间作为开始时间
      if (!this.startTime) {
        this.startTime = timestamp;
        this.pendulumStarted = true;
      }

      // 计算时间（秒），从开始时间算起
      const timeSeconds = (timestamp - this.startTime) / 1000;
      
      // 确保时间不为负数（静默跳过早于开始时间的数据）
      if (timeSeconds < 0) {
        return;
      }

      // 异常值过滤：检查角度变化是否异常（仅当已有数据时）
      if (this.lastAngle !== null) {
        const angleChange = Math.abs(angle - this.lastAngle);
        // 如果角度变化异常大（可能是数据错误），静默跳过
        if (angleChange > 350) {
          return;
        }
      }

      // 避免重复数据（时间间隔太近的数据）
      if (this.data.length > 0) {
        const lastTime = this.data[this.data.length - 1].time;
        const timeDiff = Math.abs(timeSeconds - lastTime);
        if (timeDiff < this.timeThreshold) {
          // 时间间隔太近，跳过（避免重复数据）
          return;
        }
      }

      // 记录数据（只要 isRecording 为 true 且已设置 startTime，就记录）
      if (this.pendulumStarted && this.startTime) {
        this.data.push({
          time: timeSeconds,
          angle: angle
        });

        // 限制数据量，避免内存溢出
        if (this.data.length > 10000) {
          this.data = this.data.slice(-5000); // 只保留最后5000个数据点
        }
      }

      this.lastAngle = angle;
    });

    // 静默处理，不输出日志
  },

  /**
   * 处理摆状态
   * @param {Object} state - 摆状态
   */
  handlePendulumState(state) {
    if (!state || !this.isRecording) return;

    // 若实验被复位（周期归零），同步复位本地标记，等待下一次录制
    if (!state.periodCount || state.periodCount === 0) {
      this.pendulumStarted = false;
      this.startTime = null;
      this.lastAngle = null;
    }
  },

  /**
   * 开始记录
   */
  startRecording() {
    this.isRecording = true;
    this.data = [];
    this.startTime = Date.now(); // 立即设置开始时间
    this.pendulumStarted = true; // 立即标记为已开始，不需要等待角度变化
    this.lastAngle = null;
  },

  /**
   * 停止记录
   */
  stopRecording() {
    this.isRecording = false;
    this.pendulumStarted = false;
    this.startTime = null;
    this.lastAngle = null;
  },

  /**
   * 获取记录的数据
   * @returns {Array} 角度与时间数据
   */
  getData() {
    return this.data;
  },

  /**
   * 清空数据
   */
  clearData() {
    this.data = [];
    this.isRecording = false;
    this.startTime = null;
    this.pendulumStarted = false;
    this.lastAngle = null;
  }
};

// 初始化角度记录器
window.AngleTimeRecorder = AngleTimeRecorder; 