// voice-assistant.js
// 语音助手模块 - 蓝黑色调专业设计

/**
 * 语音助手模块 - 支持语音输入和AI控制
 */
export const VoiceAssistant = {
  // AI配置
  config: {
    apiKey: '填入你的apikey',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4-voice',
    maxTokens: undefined,
    temperature: 0.95
  },

  asrConfig: {
    apiKey: '填入你的apikey',
    url: 'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions',
    model: 'glm-asr',
    temperature: 0.95
  },

  /**
   * 提取AI响应中的文本内容
   */
  extractTextFromAIContent(content) {
    if (!content) return '';
    if (typeof content === 'string') {
      return content.trim();
    }
    if (Array.isArray(content)) {
      return content.map(item => {
        if (!item) return '';
        if (typeof item === 'string') return item;
        if (item.type === 'text' && typeof item.text === 'string') {
          return item.text;
        }
        return '';
      }).join('').trim();
    }
    if (typeof content === 'object' && content.type === 'text' && typeof content.text === 'string') {
      return content.text.trim();
    }
    return '';
  },

  // DOM元素引用
  elements: {
    assistantContainer: null,
    assistantToggle: null,
    statusIndicator: null,
    recordingIndicator: null,
    messageContainer: null
  },

  // 状态管理
  state: {
    isOpen: false,
    isRecording: false,
    isProcessing: false,
    mediaRecorder: null,
    audioChunks: [],
    audioStream: null,
    currentLength: null,
    currentAngle: null,  // 当前摆角（度）
    targetLength: null,
    adjustmentInProgress: false,
    adjustmentInterval: null,
    angleAdjustmentInProgress: false,
    angleAdjustmentInterval: null,
    targetAngle: null,
    pushrodTimeout: null,
    pushrodActive: false,
    pushrodResolve: null
  },

  // WebSocket引用
  websocket: null,

  /**
   * 初始化语音助手
   */
  async init() {
    try {
      // 检查浏览器是否支持录音
      if (!this.checkMediaRecorderSupport()) {
        console.warn('浏览器不支持录音功能');
        return;
      }

      // 加载lamejs库（如果未加载）
      await this.loadLamejs();

      // 创建语音助手界面
      this.createInterface();

      // 绑定事件
      this.bindEvents();

      // 监听WebSocket状态更新
      this.setupWebSocketListener();

      console.log('语音助手初始化完成');
    } catch (error) {
      console.error('语音助手初始化失败:', error);
    }
  },

  /**
   * 检查浏览器是否支持MediaRecorder
   */
  checkMediaRecorderSupport() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.showMessage('浏览器不支持录音功能。请使用Chrome、Edge或Safari浏览器', 'error');
      return false;
    }

    if (!window.MediaRecorder) {
      this.showMessage('浏览器不支持MediaRecorder API。请使用Chrome、Edge或Safari浏览器', 'error');
      return false;
    }

    // 检查是否在HTTPS或localhost环境
    const isSecure = window.location.protocol === 'https:' || 
                     window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';
    
    if (!isSecure) {
      console.warn('录音功能建议使用HTTPS连接');
      this.addMessageToContainer('提示', '录音功能在非HTTPS环境下可能无法正常工作。建议使用HTTPS或localhost', 'ai');
    }
    
    return true;
  },

  /**
   * 加载lamejs库
   */
  async loadLamejs() {
    if (window.lamejs && window.lamejs.Mp3Encoder) {
      console.log('lamejs库已加载');
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
      script.onload = () => {
        console.log('lamejs库加载成功');
        resolve();
      };
      script.onerror = () => {
        console.warn('lamejs库加载失败，将使用WAV格式');
        resolve(); // 即使失败也继续，使用WAV格式
      };
      document.head.appendChild(script);
    });
  },


  /**
   * 设置WebSocket监听
   */
  setupWebSocketListener() {
    // 等待WebSocket初始化
    if (window.pendulumWebSocket) {
      this.websocket = window.pendulumWebSocket;
      this.websocket.onPendulumState((state) => {
        if (state) {
          // 更新摆长
          if (typeof state.physical_length === 'number') {
            this.state.currentLength = state.physical_length;
          }
          // 更新摆角（优先使用camera_angle，如果没有则使用angle）
          if (typeof state.camera_angle === 'number') {
            this.state.currentAngle = state.camera_angle;
          } else if (typeof state.angle === 'number') {
            this.state.currentAngle = state.angle;
          }
        }
      });
    } else if (window.PendulumApp && window.PendulumApp.WebSocket) {
      this.websocket = window.PendulumApp.WebSocket;
      this.websocket.onPendulumState((state) => {
        if (state) {
          // 更新摆长
          if (typeof state.physical_length === 'number') {
            this.state.currentLength = state.physical_length;
          }
          // 更新摆角（优先使用camera_angle，如果没有则使用angle）
          if (typeof state.camera_angle === 'number') {
            this.state.currentAngle = state.camera_angle;
          } else if (typeof state.angle === 'number') {
            this.state.currentAngle = state.angle;
          }
        }
      });
    } else {
      // 延迟重试
      setTimeout(() => this.setupWebSocketListener(), 1000);
    }
  },

  /**
   * 创建语音助手界面
   */
  createInterface() {
    // 创建样式
    this.createStyles();

    // 创建语音助手切换按钮
    const toggle = document.createElement('div');
    toggle.id = 'voiceAssistantToggle';
    toggle.className = 'voice-assistant-toggle';
    toggle.innerHTML = `
      <div class="voice-toggle-icon">🎤</div>
      <div class="voice-toggle-text">语音</div>
    `;

    // 创建状态指示器
    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'voice-status-indicator';
    statusIndicator.innerHTML = `
      <div class="voice-status-dot"></div>
      <div class="voice-status-text">就绪</div>
    `;

    // 创建录音指示器
    const recordingIndicator = document.createElement('div');
    recordingIndicator.className = 'voice-recording-indicator';
    recordingIndicator.style.display = 'none';
    recordingIndicator.innerHTML = `
      <div class="voice-recording-pulse"></div>
      <div class="voice-recording-text">正在录音...</div>
    `;

    // 创建消息容器（显示语音识别结果和AI交互）
    const messageContainer = document.createElement('div');
    messageContainer.id = 'voiceMessageContainer';
    messageContainer.className = 'voice-message-container';
    messageContainer.style.display = 'none';

    const panelHeader = document.createElement('div');
    panelHeader.className = 'voice-panel-header';
    panelHeader.innerHTML = `
      <div class="voice-panel-title">
        <div class="voice-panel-title-text">语音助手</div>
        <div class="voice-panel-status">
          <div class="voice-panel-status-dot"></div>
          <div class="voice-panel-status-text">在线</div>
        </div>
      </div>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'voice-panel-close';
    closeBtn.title = '关闭';
    closeBtn.style.cssText = 'width: 16px !important; height: 16px !important; min-width: 16px !important; max-width: 16px !important; min-height: 16px !important; max-height: 16px !important; border: none !important; border-radius: 2px !important; background: #ef4444 !important; padding: 0 !important; margin: 0 !important; box-sizing: border-box !important; line-height: 1 !important; font-size: 0 !important;';
    closeBtn.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3">
        <line x1="6" y1="6" x2="18" y2="18"></line>
        <line x1="18" y1="6" x2="6" y2="18"></line>
      </svg>
    `;
    closeBtn.addEventListener('click', () => this.closeMessagePanel());
    panelHeader.appendChild(closeBtn);

    const messageList = document.createElement('div');
    messageList.className = 'voice-message-list';

    messageContainer.appendChild(panelHeader);
    messageContainer.appendChild(messageList);

    // 添加到页面
    document.body.appendChild(toggle);
    document.body.appendChild(statusIndicator);
    document.body.appendChild(recordingIndicator);
    document.body.appendChild(messageContainer);

    // 保存DOM元素引用
    this.elements = {
      assistantToggle: toggle,
      statusIndicator: statusIndicator,
      recordingIndicator: recordingIndicator,
      messageContainer: messageContainer,
      messageList: messageList,
      messageCloseButton: closeBtn
    };
  },

  /**
   * 创建样式
   */
  createStyles() {
    if (document.getElementById('voice-assistant-styles')) return;
    
    const styles = `
      /* 语音助手样式 - 黑蓝配色（完全按照AI助手样式） */
      .voice-assistant-toggle {
        position: fixed;
        bottom: 90px;
        right: 20px;
        width: 64px;
        height: 64px;
        background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%);
        border-radius: 50%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer !important;
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.15);
        transition: all 0.3s ease;
        z-index: 9999;
        border: 2px solid #cbd5f5;
        pointer-events: auto !重要;
        user-select: none;
        -webkit-user-select: none;
      }
      
      .voice-assistant-toggle:hover {
        transform: scale(1.04);
        box-shadow: 0 16px 32px rgba(15, 23, 42, 0.18);
        cursor: pointer !important;
      }
      
      .voice-assistant-toggle:active {
        transform: scale(0.96);
      }
      
      .voice-assistant-toggle.active {
        transform: scale(0.94);
        opacity: 0.9;
        border-color: #f87171;
        box-shadow: 0 14px 36px rgba(248, 113, 113, 0.25);
      }
      
      .voice-toggle-icon {
        font-size: 24px;
        color: #000000;
        margin-bottom: 4px;
        pointer-events: none;
      }
      
      .voice-toggle-text {
        font-size: 13px;
        color: #000000;
        font-weight: 600;
        pointer-events: none;
      }
      
      .voice-status-indicator {
        position: fixed;
        bottom: 170px;
        right: 20px;
        background: #ffffff;
        border-radius: 10px;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.12);
        z-index: 9998;
        border: 1px solid #e2e8f0;
        min-width: 120px;
        pointer-events: none;
      }
      
      .voice-status-dot {
        width: 8px;
        height: 8px;
        background: #00e676;
        border-radius: 50%;
        animation: voice-pulse 2s infinite;
      }
      
      @keyframes voice-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      
      .voice-status-text {
        font-size: 14px;
        color: #000000;
        font-weight: 600;
      }
      
      .voice-recording-indicator {
        position: fixed;
        bottom: 170px;
        right: 20px;
        background: #fef2f2;
        border-radius: 10px;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 12px 30px rgba(248, 113, 113, 0.25);
        z-index: 9998;
        border: 1px solid #fecaca;
        min-width: 150px;
        pointer-events: none;
      }
      
      .voice-recording-pulse {
        width: 10px;
        height: 10px;
        background: #ffffff;
        border-radius: 50%;
        animation: voice-recording-pulse 1s infinite;
      }
      
      @keyframes voice-recording-pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.5); opacity: 0.5; }
      }
      
      .voice-recording-text {
        font-size: 13px;
        color: #000000;
        font-weight: 600;
      }
      
      @keyframes voice-message-in {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @keyframes voice-message-out {
        from {
          opacity: 1;
          transform: translateY(0);
        }
        to {
          opacity: 0;
          transform: translateY(10px);
        }
      }
      
      .voice-message-container {
        position: fixed;
        bottom: 220px;
        right: 20px;
        width: 320px;
        max-height: 420px;
        background: #ffffff;
        border-radius: 14px;
        box-shadow: 0 20px 50px rgba(15, 23, 42, 0.16);
        border: 1px solid #e2e8f0;
        padding: 16px;
        z-index: 9998;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: auto;
      }
      
      .voice-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
      }
      
      .voice-panel-title {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      
      .voice-panel-title-text {
        font-size: 18px;
        font-weight: 700;
        color: #000000;
      }
      
      .voice-panel-status {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .voice-panel-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #22c55e;
        animation: voice-pulse 2s infinite;
      }
      
      .voice-panel-status-text {
        font-size: 14px;
        color: #000000;
      }
      
      .voice-panel-close {
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: opacity 0.2s ease;
      }
      
      .voice-panel-close:hover {
        opacity: 0.85;
      }
      
      .voice-message-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: 320px;
        overflow-y: auto;
        padding-right: 4px;
      }
      
      .voice-message-list::-webkit-scrollbar {
        width: 4px;
      }
      
      .voice-message-list::-webkit-scrollbar-track {
        background: #1a1a1a;
      }
      
      .voice-message-list::-webkit-scrollbar-thumb {
        background: #cbd5f5;
        border-radius: 3px;
      }
      
      .voice-message-item {
        background: #f8fafc;
        border-radius: 10px;
        padding: 12px 14px;
        border: 1px solid #e2e8f0;
        font-size: 15px;
        line-height: 1.7;
        animation: voice-message-in 0.3s ease;
        color: #000000;
      }
      
      .voice-message-item.user {
        align-self: flex-end;
        background: #e0edff;
        border-color: #bfdbfe;
      }
      
      .voice-message-item.ai {
        background: #fdf2f8;
        border-color: #fecdd3;
      }
      
      .voice-message-item.error {
        background: #fee2e2;
        border-color: #fecaca;
        color: #b91c1c;
      }
      
      .voice-message-item.success {
        background: #ecfdf5;
        border-color: #a7f3d0;
        color: #065f46;
      }
      
      .voice-message-label {
        font-weight: 700;
        margin-bottom: 6px;
        font-size: 14px;
        opacity: 0.9;
      }
      
      .voice-message-content {
        word-wrap: break-word;
      }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.id = 'voice-assistant-styles';
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  },

  /**
   * 绑定事件
   */
  bindEvents() {
    // 切换按钮点击事件
    if (this.elements.assistantToggle) {
      this.elements.assistantToggle.addEventListener('click', () => {
        this.toggleRecording();
      });
    }
  },

  /**
   * 切换录音状态
   */
  toggleRecording() {
    if (this.state.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  },

  /**
   * 开始录音
   */
  async startRecording() {
    if (this.state.isProcessing) {
      this.showMessage('正在处理上一个指令，请稍候', 'error');
      return;
    }

    if (this.state.isRecording) {
      // 如果已经在录音，停止它
      this.stopRecording();
      return;
    }

    try {
      // 显示消息容器
      if (this.elements.messageContainer) {
        this.elements.messageContainer.style.display = 'flex';
      }
      
      this.addMessageToContainer('系统', '正在请求麦克风权限...', 'ai');
      
      // 获取麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,      // 单声道
          sampleRate: 16000,     // 16kHz采样率（GLM-4-Voice推荐）
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      this.state.audioStream = stream;
      this.state.audioChunks = [];
      
      // 创建MediaRecorder
      let mimeType = 'audio/webm'; // 默认格式
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }
      
      this.state.mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
      
      // 监听数据
      this.state.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.state.audioChunks.push(event.data);
        }
      };
      
      // 录音结束处理
      this.state.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.state.audioChunks, { type: mimeType });
        this.addMessageToContainer('系统', `✅ 录音完成 (${(audioBlob.size / 1024).toFixed(2)} KB)`, 'ai');
        await this.handleAudioBlob(audioBlob, mimeType);
        
        // 停止所有音频轨道
        if (this.state.audioStream) {
          this.state.audioStream.getTracks().forEach(track => track.stop());
          this.state.audioStream = null;
        }
      };
      
      // 开始录音
      this.state.mediaRecorder.start();
      this.state.isRecording = true;
      
      this.updateStatus('录音中...');
      this.updateRecordingIndicator(true);
      this.elements.assistantToggle?.classList.add('active');
      this.addMessageToContainer('系统', '✅ 录音已开始，请说话...', 'ai');
      
    } catch (error) {
      console.error('启动录音失败:', error);
      let errorMsg = '启动录音失败';
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMsg = '麦克风权限被拒绝，请在浏览器设置中允许使用麦克风';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMsg = '未找到麦克风设备，请检查设备连接';
      } else {
        errorMsg = `启动失败: ${error.message}`;
      }
      this.showMessage(errorMsg, 'error');
      this.addMessageToContainer('错误', errorMsg, 'error');
      this.elements.assistantToggle?.classList.remove('active');
      this.updateStatus('就绪');
    }
  },

  /**
   * 停止录音
   */
  stopRecording() {
    if (this.state.mediaRecorder && this.state.isRecording) {
      this.state.mediaRecorder.stop();
      this.state.isRecording = false;
      this.elements.assistantToggle?.classList.remove('active');
      this.updateRecordingIndicator(false);
      this.updateStatus('正在处理录音...');
    }
  },

  /**
   * 更新录音指示器
   */
  updateRecordingIndicator(recording) {
    if (this.elements.statusIndicator && this.elements.recordingIndicator) {
      if (recording) {
        this.elements.statusIndicator.style.display = 'none';
        this.elements.recordingIndicator.style.display = 'flex';
      } else {
        this.elements.statusIndicator.style.display = 'flex';
        this.elements.recordingIndicator.style.display = 'none';
      }
    }
  },

  /**
   * 将音频转换为MP3格式
   */
  async convertToMP3(audioBlob, mimeType) {
    return new Promise((resolve, reject) => {
      // 如果已经是MP3格式，直接返回
      if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
        resolve(audioBlob);
        return;
      }

      // 创建AudioContext
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const fileReader = new FileReader();

      fileReader.onload = async (e) => {
        try {
          // 解码音频数据
          const audioBuffer = await audioContext.decodeAudioData(e.target.result);
          
          // 创建WAV格式（作为中间格式）
          const wavBlob = this.audioBufferToWav(audioBuffer);
          
          // 尝试使用lamejs转换为MP3（如果可用）
          if (window.lamejs && window.lamejs.Mp3Encoder) {
            const mp3Blob = await this.convertToMP3WithLame(audioBuffer);
            resolve(mp3Blob);
          } else {
            // 如果没有lamejs，使用WAV格式
            resolve(wavBlob);
          }
        } catch (error) {
          reject(new Error(`音频转换失败: ${error.message}`));
        }
      };

      fileReader.onerror = () => reject(new Error('读取音频文件失败'));
      fileReader.readAsArrayBuffer(audioBlob);
    });
  },

  /**
   * 使用GLM-ASR转写音频
   */
  async transcribeAudioWithASR(audioBlob, filename = 'recording.wav') {
    const formData = new FormData();
    const file = audioBlob instanceof File
      ? audioBlob
      : new File([audioBlob], filename, { type: audioBlob.type || 'audio/wav' });
    formData.append('model', this.asrConfig.model);
    formData.append('temperature', this.asrConfig.temperature);
    formData.append('stream', 'false');
    formData.append('file', file, filename);

    const response = await fetch(this.asrConfig.url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.asrConfig.apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GLM-ASR调用失败: HTTP ${response.status} ${text}`);
    }

    const data = await response.json();
    return data?.text?.trim() || '';
  },

  /**
   * 将AudioBuffer转换为WAV格式
   */
  audioBufferToWav(buffer) {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bytesPerSample = 2;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const bufferSize = 44 + dataSize;
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    // WAV文件头
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // 写入音频数据
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  },

  /**
   * 使用lamejs转换为MP3
   */
  async convertToMP3WithLame(audioBuffer) {
    const { lamejs } = window;
    const mp3encoder = new lamejs.Mp3Encoder(
      audioBuffer.numberOfChannels,
      audioBuffer.sampleRate,
      128 // 比特率
    );

    const samples = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      samples.push(new Int16Array(audioBuffer.getChannelData(i).map(n => n * 0x7FFF)));
    }

    const mp3Data = [];
    const sampleBlockSize = 1152;

    for (let i = 0; i < samples[0].length; i += sampleBlockSize) {
      const left = samples[0].subarray(i, i + sampleBlockSize);
      const right = audioBuffer.numberOfChannels > 1 
        ? samples[1].subarray(i, i + sampleBlockSize) 
        : left;
      const mp3buf = mp3encoder.encodeBuffer(left, right);
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
    }

    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }

    return new Blob(mp3Data, { type: 'audio/mp3' });
  },

  /**
   * 将Blob转换为Base64
   */
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // 移除data:audio/mp3;base64,前缀，只保留base64字符串
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  /**
   * 处理音频文件
   */
  async handleAudioBlob(audioBlob, mimeType) {
    try {
      if (this.state.isProcessing) {
        this.addMessageToContainer('语音助手', '正在处理上一条指令，请稍候', 'error');
        return;
      }

      this.state.isProcessing = true;
      this.updateStatus('正在处理音频...');

      // 转换为MP3或WAV格式
      const processedBlob = await this.convertToMP3(audioBlob, mimeType);
      const audioFormat = processedBlob.type.includes('mp3') || processedBlob.type.includes('mpeg') ? 'mp3' : 'wav';

      let transcript = '';
      try {
        transcript = await this.transcribeAudioWithASR(processedBlob, audioFormat === 'mp3' ? 'recording.mp3' : 'recording.wav');
        if (transcript) {
          this.addMessageToContainer('语音识别', transcript, 'user');
        }
      } catch (asrError) {
        console.warn('调用GLM-ASR失败，准备回退到语音模型:', asrError);
      }

      let finalResponse = null;

      if (transcript) {
        finalResponse = this.parseTextCommand(transcript);
      }

      if (!finalResponse && transcript) {
        try {
          const commandModelResult = await this.callCommandModelWithTranscript(transcript);
          if (commandModelResult) {
            finalResponse = commandModelResult;
          }
        } catch (error) {
          console.warn('文本指令模型调用失败:', error);
        }
      }

      if (!finalResponse) {
        const base64Audio = await this.blobToBase64(processedBlob);
        finalResponse = await this.callAIAPIWithAudio(base64Audio, audioFormat);
      }

      if (finalResponse?.talkback) {
        this.addMessageToContainer('语音助手', finalResponse.talkback, 'ai');
      }

      if (!finalResponse) {
        throw new Error('无法解析语音指令');
      }

      const fallbackTranscript = transcript || finalResponse?.transcript || finalResponse?.message || '';
      
      // 如果AI误解了指令，尝试从AI响应中二次提取
      if (finalResponse.action === 'other') {
        const sourceText = finalResponse.message || finalResponse.transcript || transcript || '';
        const extractedAdjust = this.extractAdjustIntent(sourceText);
        if (extractedAdjust) {
          finalResponse = extractedAdjust;
          this.addMessageToContainer('系统', `✅ 已从AI回复中识别出调整摆长指令（目标：${extractedAdjust.targetLength}cm）`, 'success');
        } else {
          const extractedAngle = this.extractAngleAdjustIntent(sourceText);
          if (extractedAngle) {
            finalResponse = extractedAngle;
            this.addMessageToContainer('系统', `✅ 已从AI回复中识别出调整摆角指令（目标：${extractedAngle.targetAngle}°）`, 'success');
        } else {
          // 策略2：尝试从AI的回复中提取调整摆长的信息（旧方法，作为备选）
            const extractedLength = this.extractLengthFromText(sourceText);
          if (extractedLength) {
            finalResponse = extractedLength;
            this.addMessageToContainer('系统', '✅ 已从AI回复中识别出调整摆长指令', 'success');
          } else {
            // 策略3：尝试识别查询意图
              const extractedQuery = this.extractQueryIntent(sourceText);
            if (extractedQuery) {
              finalResponse = extractedQuery;
              this.addMessageToContainer('系统', `✅ 已从AI回复中识别出${extractedQuery.action === 'query_length' ? '查询摆长' : '查询摆角'}意图`, 'success');
            } else {
              // 如果二次提取也失败，显示提示
              this.addMessageToContainer('系统', '⚠️ 无法识别指令，请重试或使用更清晰的表达', 'error');
              }
            }
          }
        }
      }
      
      // 解析AI响应并执行操作
      const effectiveTranscript = transcript ? '语音输入' : (finalResponse?.transcript || fallbackTranscript || '语音输入');
      await this.executeCommand(finalResponse, effectiveTranscript);

    } catch (error) {
      console.error('处理音频失败:', error);
      this.addMessageToContainer('错误', '处理失败: ' + error.message, 'error');
      this.showMessage('处理音频失败: ' + error.message, 'error');
      this.updateStatus('就绪');
    } finally {
      this.state.isProcessing = false;
      if (!this.state.isRecording) {
        this.updateStatus('就绪');
      }
    }
  },
  
  /**
   * 从文本中提取调整意图（用于AI误解指令时的二次提取）
   * 优先识别调整意图，因为调整通常包含数字+cm，更容易识别
   */
  extractAdjustIntent(text) {
    if (!text || typeof text !== 'string') return null;
    
    // 检测AI是否明显误解了（回复了无关内容）
    const misunderstoodKeywords = [
      '宝石', '食物', '白角', '白巧', '白酒', '百长', '柏长', '百肠',
      '折射角', '顶角', '几何形状', '年龄', '生日', '度数', 
      '品牌', '配方', '长度单位', '厘米', '米', '肠子', '比喻', '夸张',
      '设备', '机械', '电子', '操作手册', '技术支持', '摄影', '艺术创作'
    ];
    const isMisunderstood = misunderstoodKeywords.some(keyword => text.includes(keyword));
    
    // 如果AI误解了，尝试从回复中提取数字+cm（即使没有"摆长"等词）
    if (isMisunderstood) {
      // 匹配数字+cm的模式（更宽松，因为AI可能误解了"摆长"但保留了数字）
      const adjustPatterns = [
        // 匹配：数字+cm（在误解回复中，AI可能保留了数字）
        /([\d零一二三四五六七八九十百两]+(?:\.\d+)?)\s*(?:cm|厘米|公分)/i,
        // 匹配：调整/调节+数字+cm
        /(?:调整|调节|设置|调到|调至|改为|改成).*?([\d零一二三四五六七八九十百两]+(?:\.\d+)?)\s*(?:cm|厘米|公分)/i,
        // 匹配：长度+数字+cm
        /长度.*?([\d零一二三四五六七八九十百两]+(?:\.\d+)?)\s*(?:cm|厘米|公分)/i
      ];
      
      for (const pattern of adjustPatterns) {
        const match = text.match(pattern);
        if (match) {
          const targetLength = this.parseNumericValue(match[1]);
          // 检查数字是否在合理范围内（摆长通常在5-100cm之间）
          if (targetLength >= 5 && targetLength <= 100) {
            return {
              action: 'adjust_length',
              targetLength: targetLength,
              message: `正在调整摆长到${targetLength}cm`,
              transcript: text
            };
          }
        }
      }
    }
    
    return null;
  },

  /**
   * 从文本中提取摆长信息（用于AI误解指令时的二次提取）
   * 这是旧方法，保留作为备选
   */
  extractLengthFromText(text) {
    if (!text || typeof text !== 'string') return null;
    
    // 匹配各种表达方式
    const patterns = [
      /(?:调整|调节|设置|调到|调至|调到|调至|改为|改成)\s*(?:摆长|长度)?\s*(?:到|至|为)?\s*([\d零一二三四五六七八九十百两]+(?:\.\d+)?)\s*(?:cm|厘米|公分)/i,
      /摆长\s*(?:为|是|到|至)?\s*([\d零一二三四五六七八九十百两]+(?:\.\d+)?)\s*(?:cm|厘米|公分)/i,
      /([\d零一二三四五六七八九十百两]+(?:\.\d+)?)\s*(?:cm|厘米|公分)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const targetLength = this.parseNumericValue(match[1]);
        if (targetLength > 0 && targetLength <= 100) {
          return {
            action: 'adjust_length',
            targetLength: targetLength,
            message: `正在调整摆长到${targetLength}cm`,
            transcript: text
          };
        }
      }
    }
    
    return null;
  },

  /**
   * 从文本中提取调整摆角意图
   */
  extractAngleAdjustIntent(text) {
    if (!text || typeof text !== 'string') return null;

    const patterns = [
      /(?:调整|调节|设置|调到|调至|改为|改成)\s*(?:摆角|角度|角)?\s*(?:到|至|为)?\s*([\d零一二三四五六七八九十百两]+(?:\.\d+)?)\s*(?:°|度)/i,
      /(?:摆角|角度|角)\s*(?:调整|调节|设置|调到|调至|改为|改成)\s*(?:到|至|为)?\s*([\d零一二三四五六七八九十百两]+(?:\.\d+)?)\s*(?:°|度)/i,
      /(?:摆角|角度|角)\s*(?:为|是|到|至)?\s*([\d零一二三四五六七八九十百两]+(?:\.\d+)?)\s*(?:°|度)/i,
      /([\d零一二三四五六七八九十百两]+(?:\.\d+)?)\s*(?:°|度)\s*(?:的)?\s*(?:摆角|角度|角)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const targetAngle = this.parseNumericValue(match[1]);
        if (!isNaN(targetAngle) && targetAngle >= 0 && targetAngle <= 90) {
          return {
            action: 'adjust_angle',
            targetAngle: targetAngle,
            message: `正在调整摆角到${targetAngle}°`,
            transcript: text
          };
        }
      }
    }
    
    return null;
  },

  /**
   * 从文本中提取查询意图（用于AI误解指令时的二次提取）
   * 即使AI误解了，也能识别出用户是想查询摆长还是摆角
   * 
   * 策略：
   * 1. 如果AI回复明显是误解（包含"宝石"、"食物"、"白酒"、"百肠"等无关词），尝试推断
   * 2. 如果AI回复中包含"长度"、"角度"等词，即使没有"摆"字，也可能是查询意图
   * 3. 放宽查询关键词检测，只要AI误解了且提到了相关词，就推断为查询意图
   */
  extractQueryIntent(text) {
    if (!text || typeof text !== 'string') return null;
    
    // 检测AI是否明显误解了（回复了无关内容）
    const misunderstoodKeywords = [
      '宝石', '食物', '白角', '白巧', '白酒', '百长', '柏长', '百肠',
      '折射角', '顶角', '几何形状', '年龄', '生日', '度数', 
      '品牌', '配方', '长度单位', '厘米', '米', '肠子', '比喻', '夸张'
    ];
    const isMisunderstood = misunderstoodKeywords.some(keyword => text.includes(keyword));
    
    // 检测是否包含查询相关的关键词（放宽匹配）
    const queryKeywords = [
      '多少', '查询', '当前', '现在', '是多少', '多大', '了解', 
      '无法查看', '无法获取', '不能告诉你', '不知道', '需要告诉我',
      '什么', '哪个', '如何', '怎样', '告诉我', '说一下'
    ];
    const hasQueryKeywords = queryKeywords.some(keyword => text.includes(keyword));
    
    // 检测长度相关词（更宽松的匹配）
    const hasLengthRelated = /长度|长|cm|厘米|米|单位|几米|多少米/i.test(text);
    // 检测角度相关词
    const hasAngleRelated = /角度|角|度|度数/i.test(text);
    
    // 策略1：如果AI误解了，且回复中提到了长度或角度相关词，直接推断为查询意图
    // 不需要等待查询关键词，因为误解本身就说明用户可能在查询
    if (isMisunderstood) {
      // 如果提到了长度相关词，可能是查询摆长
      if (hasLengthRelated) {
        return {
          action: 'query_length',
          message: '查询摆长（从误解回复中推断）',
          transcript: text
        };
      }
      
      // 如果提到了角度相关词，可能是查询摆角
      if (hasAngleRelated) {
        return {
          action: 'query_angle',
          message: '查询摆角（从误解回复中推断）',
          transcript: text
        };
      }
    }
    
    // 策略2：如果AI误解了，且回复中包含查询相关词，进一步推断
    if (isMisunderstood && hasQueryKeywords) {
      // 如果提到了长度相关词，可能是查询摆长
      if (hasLengthRelated) {
        return {
          action: 'query_length',
          message: '查询摆长（从误解回复中推断）',
          transcript: text
        };
      }
      
      // 如果提到了角度相关词，可能是查询摆角
      if (hasAngleRelated) {
        return {
          action: 'query_angle',
          message: '查询摆角（从误解回复中推断）',
          transcript: text
        };
      }
      
      // 如果AI说"无法查看"、"无法获取"等，且提到了"信息"、"数据"等，可能是查询意图
      if (text.includes('无法查看') || text.includes('无法获取') || text.includes('不能告诉你')) {
        // 检查是否提到了"角度"、"角"等词
        if (hasAngleRelated) {
          return {
            action: 'query_angle',
            message: '查询摆角（从误解回复中推断）'
          };
        }
        // 默认查询摆长
        return {
          action: 'query_length',
          message: '查询摆长（从误解回复中推断）'
        };
      }
    }
    
    // 标准匹配：检查是否包含查询摆角的关键词
    const angleQueryPatterns = [
      /(?:角度|角|摆角).*?(?:多少|查询|当前|现在|是多少|多大)/i,
      /(?:多少|查询|当前|现在).*?(?:角度|角|摆角)/i,
      /(?:角度|角|摆角)\s*(?:是|为|多少)/i
    ];
    
    const hasAngleQueryPattern = angleQueryPatterns.some(pattern => pattern.test(text));
    if (hasAngleQueryPattern) {
      return {
        action: 'query_angle',
          message: '查询摆角',
          transcript: text
      };
    }
    
    // 标准匹配：检查是否包含查询摆长的关键词
    const lengthQueryPatterns = [
      /(?:摆长|长度).*?(?:多少|查询|当前|现在|是多少|多大)/i,
      /(?:多少|查询|当前|现在).*?(?:摆长|长度)/i,
      /(?:摆长|长度)\s*(?:是|为|多少)/i
    ];
    
    const hasLengthQueryPattern = lengthQueryPatterns.some(pattern => pattern.test(text));
    if (hasLengthQueryPattern) {
      return {
        action: 'query_length',
          message: '查询摆长',
          transcript: text
      };
    }
    
    return null;
  },

  /**
   * 直接解析文本以获得命令
   */
  parseTextCommand(text) {
    if (!text || typeof text !== 'string') return null;

    const lengthCmd = this.extractLengthFromText(text);
    if (lengthCmd) return lengthCmd;

    const angleCmd = this.extractAngleAdjustIntent(text);
    if (angleCmd) return angleCmd;

    const adjustCmd = this.extractAdjustIntent(text);
    if (adjustCmd) return adjustCmd;

    const queryCmd = this.extractQueryIntent(text);
    if (queryCmd) return queryCmd;

    return null;
  },

  /**
   * 将字符串解析为数字，支持中文数字
   */
  parseNumericValue(value) {
    if (typeof value === 'number') return value;
    let text = (value || '').toString().trim();
    if (!text) return NaN;

    text = text.replace(/[，。、“”\s]/g, '').replace(/(度|°|厘米|cm|公分)$/gi, '');

    if (!text) return NaN;

    const number = parseFloat(text.replace(/[^\d.\-]/g, ''));
    if (!isNaN(number)) return number;

    if (/^[零一二三四五六七八九十百]+$/.test(text)) {
      return this.convertChineseNumeralToNumber(text);
    }
    if (/[\d]/.test(text)) {
      const digits = text.replace(/[^\d.]/g, '');
      return digits ? parseFloat(digits) : NaN;
    }
    return NaN;
  },

  convertChineseNumeralToNumber(text) {
    const map = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 百: 100 };
    let result = 0;
    let temp = 0;
    for (const char of text) {
      const value = map[char];
      if (value === undefined) continue;
      if (value === 10 || value === 100) {
        if (temp === 0) temp = 1;
        result += temp * value;
        temp = 0;
      } else {
        temp = temp * 10 + value;
      }
    }
    return result + temp;
  },

  /**
   * 使用文本调用指令模型
   */
  async callCommandModelWithTranscript(transcriptText) {
    if (!transcriptText || !transcriptText.trim()) {
      return null;
    }

    const currentLength = this.getCurrentLength();
    const currentAngle = this.getCurrentAngle();
    const lengthText = typeof currentLength === 'number' ? `${currentLength.toFixed(2)}cm` : '未知';
    const angleText = typeof currentAngle === 'number' ? `${currentAngle.toFixed(2)}°` : '未知';

    const systemPrompt = `
你是单摆实验的语音控制助手。你只需要将用户语音中的指令转换为 JSON。
当前摆长约${lengthText}，当前摆角约${angleText}。
务必仅输出紧凑 JSON，不能输出任何解释或多余文本。
JSON字段：
- action: adjust_length | adjust_angle | query_length | query_angle | stop | other
- targetLength: 数字，单位厘米，仅在 action=adjust_length 时提供
- targetAngle: 数字，单位度，仅在 action=adjust_angle 时提供
- transcript: 识别出的中文语句
- talkback: (可选) 给用户的简短回复
示例：
{"action":"adjust_length","targetLength":20,"transcript":"调整摆长到20厘米"}
{"action":"adjust_angle","targetAngle":30,"transcript":"把摆角调到30度"}
如果无法理解，输出 {"action":"other","transcript":"...","talkback":"请再说一次"}.
`;

    const userPrompt = `以下是语音识别后的文本：“${transcriptText}”。请根据这段文本生成符合要求的JSON结果。`;

    const requestData = {
      model: this.config.model,
      temperature: this.config.temperature,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userPrompt
            }
          ]
        }
      ]
    };

    if (this.config.maxTokens !== undefined) {
      requestData.max_tokens = this.config.maxTokens;
    }

    const response = await fetch(this.config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`命令模型调用失败: HTTP ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    const aiContent = data?.choices?.[0]?.message?.content ?? '';
    const aiResponseText = this.extractTextFromAIContent(aiContent);
    if (!aiResponseText) {
      return null;
    }

    try {
      const parsed = JSON.parse(aiResponseText);
      return {
        action: parsed.action || 'other',
        targetLength: parsed.targetLength ?? parsed.length ?? parsed.value ?? null,
        targetAngle: parsed.targetAngle ?? parsed.angle ?? null,
        message: parsed.message || parsed.reason || parsed.talkback || aiResponseText,
        transcript: parsed.transcript || transcriptText,
        talkback: parsed.talkback || parsed.reply || null
      };
    } catch (error) {
      return null;
    }
  },

  /**
   * 调用AI API（使用音频）
   */
  async callAIAPIWithAudio(base64Audio, audioFormat) {
    const currentLength = this.getCurrentLength();
    const currentAngle = this.getCurrentAngle();
    const lengthText = typeof currentLength === 'number' ? `${currentLength.toFixed(2)}cm` : '未知';
    const angleText = typeof currentAngle === 'number' ? `${currentAngle.toFixed(2)}°` : '未知';

    const systemPrompt = `
你是单摆实验的语音控制助手。你只需要将用户语音中的指令转换为 JSON。
当前摆长约${lengthText}，当前摆角约${angleText}。
务必仅输出紧凑 JSON，不能输出任何解释或多余文本。
JSON字段：
- action: adjust_length | adjust_angle | query_length | query_angle | stop | other
- targetLength: 数字，单位厘米，仅在 action=adjust_length 时提供
- targetAngle: 数字，单位度，仅在 action=adjust_angle 时提供
- transcript: 识别出的中文语句
- talkback: (可选) 给用户的简短回复
示例：
{"action":"adjust_length","targetLength":20,"transcript":"调整摆长到20厘米"}
{"action":"adjust_angle","targetAngle":30,"transcript":"把摆角调到30度"}
如果无法理解，输出 {"action":"other","transcript":"...","talkback":"请再说一次"}.
`;

    const requestData = {
      model: this.config.model,
      temperature: this.config.temperature,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: {
                data: base64Audio,
                format: audioFormat
              }
            }
          ]
        }
      ]
    };

    if (this.config.maxTokens !== undefined) {
      requestData.max_tokens = this.config.maxTokens;
    }

    try {
      const response = await fetch(this.config.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.addMessageToContainer('错误', `API调用失败: HTTP ${response.status}`, 'error');
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      const aiContent = data?.choices?.[0]?.message?.content ?? '';
      const aiResponseText = this.extractTextFromAIContent(aiContent);
      
      if (!aiResponseText) {
        throw new Error('AI未返回可解析的文本内容');
      }

      let parsed = null;
      try {
        parsed = JSON.parse(aiResponseText);
      } catch (e) {
        const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch (e2) {
            parsed = null;
          }
        }
      }

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const normalized = {
          action: parsed.action || 'other',
          targetLength: parsed.targetLength ?? parsed.length ?? parsed.value ?? null,
          targetAngle: parsed.targetAngle ?? parsed.angle ?? null,
          message: parsed.message || parsed.reason || parsed.talkback || aiResponseText,
          transcript: parsed.transcript || parsed.user_text || parsed.original || aiResponseText,
          talkback: parsed.talkback || parsed.reply || null
        };

        if (typeof normalized.targetLength === 'string') {
          const numeric = parseFloat(normalized.targetLength);
          normalized.targetLength = isNaN(numeric) ? null : numeric;
        }

        if (typeof normalized.targetAngle === 'string') {
          const numericAngle = parseFloat(normalized.targetAngle);
          normalized.targetAngle = isNaN(numericAngle) ? null : numericAngle;
        }

        if (normalized.talkback) {
          this.addMessageToContainer('语音助手', normalized.talkback, 'ai');
        }

        return normalized;
      }

      // 解析失败，尝试基于文本内容提取意图
      const aiResponse = aiResponseText;

        const adjustPatterns = [
          /(?:调整|调节|设置|调到|调至|改为|改成)\s*(?:摆长|长度)?\s*(?:到|至|为)?\s*([\d零一二三四五六七八九十百两]+(?:\.\d+)?)\s*(?:cm|厘米|公分)/i,
          /摆长\s*(?:为|是|到|至)?\s*([\d零一二三四五六七八九十百两]+(?:\.\d+)?)\s*(?:cm|厘米|公分)/i,
          /(?:摆长|长度|调整|调节).*?([\d零一二三四五六七八九十百两]+(?:\.\d+)?)\s*(?:cm|厘米|公分)/i,
          /([\d零一二三四五六七八九十百两]+(?:\.\d+)?)\s*(?:cm|厘米|公分)/i
        ];
        
        const hasPendulumKeywords = /摆长|长度|调整|调节|调到|调至|设置/i.test(aiResponse);
        
        for (const pattern of adjustPatterns) {
          const match = aiResponse.match(pattern);
          if (match) {
          const targetLength = this.parseNumericValue(match[1]);
            if (targetLength > 0 && targetLength <= 100) {
              if (hasPendulumKeywords || (targetLength >= 5 && targetLength <= 50)) {
                return {
                  action: 'adjust_length',
                  targetLength: targetLength,
                message: `正在调整摆长到${targetLength}cm`,
                transcript: aiResponse
                };
              }
            }
          }
        }
        
        const numberMatch = aiResponse.match(/([\d零一二三四五六七八九十百两]+(?:\.\d+)?)\s*(?:cm|厘米|公分)/i);
        if (numberMatch && hasPendulumKeywords) {
        const targetLength = this.parseNumericValue(numberMatch[1]);
          if (targetLength > 0 && targetLength <= 100) {
            return {
              action: 'adjust_length',
              targetLength: targetLength,
            message: `正在调整摆长到${targetLength}cm`,
            transcript: aiResponse
            };
          }
        }
        
      const anglePatterns = [
        /(?:调整|调节|设置|调到|调至|改为|改成)\s*(?:摆角|角度|角)?\s*(?:到|至|为)?\s*([\d零一二三四五六七八九十百两]+(?:\.\d+)?)\s*(?:°|度)/i,
        /(?:摆角|角度|角)\s*(?:调整|调节|设置|调到|调至|改为|改成)\s*(?:到|至|为)?\s*([\d零一二三四五六七八九十百两]+(?:\.\d+)?)\s*(?:°|度)/i,
        /(?:摆角|角度|角)\s*(?:为|是|到|至)?\s*([\d零一二三四五六七八九十百两]+(?:\.\d+)?)\s*(?:°|度)/i,
        /([\d零一二三四五六七八九十百两]+(?:\.\d+)?)\s*(?:°|度)\s*(?:的)?\s*(?:摆角|角度|角)/i
      ];

      for (const pattern of anglePatterns) {
        const match = aiResponse.match(pattern);
        if (match) {
          const targetAngle = this.parseNumericValue(match[1]);
          if (!isNaN(targetAngle) && targetAngle >= 0 && targetAngle <= 90) {
            return {
              action: 'adjust_angle',
              targetAngle: targetAngle,
              message: `正在调整摆角到${targetAngle}°`,
              transcript: aiResponse
            };
          }
        }
      }

        const queryLengthPatterns = [
          /(?:摆长|长度).*?(?:多少|查询|当前|现在|是多少|多大)/i,
          /(?:多少|查询|当前|现在).*?(?:摆长|长度)/i,
          /(?:摆长|长度)\s*(?:是|为|多少)/i
        ];
        
        const hasQueryLengthPattern = queryLengthPatterns.some(pattern => pattern.test(aiResponse));
        const hasPendulumAndQuery = (aiResponse.includes('摆长') || aiResponse.includes('长度')) && 
                                    (aiResponse.includes('多少') || aiResponse.includes('查询') || 
                                     aiResponse.includes('当前') || aiResponse.includes('现在') ||
                                     aiResponse.includes('是多少') || aiResponse.includes('多大'));
        
        if (hasQueryLengthPattern || hasPendulumAndQuery) {
          return {
            action: 'query_length',
          message: aiResponse,
          transcript: aiResponse
          };
        }
        
        const queryAnglePatterns = [
          /(?:摆角|角度).*?(?:多少|查询|当前|现在|是多少|多大)/i,
          /(?:多少|查询|当前|现在).*?(?:摆角|角度)/i,
          /(?:摆角|角度)\s*(?:是|为|多少)/i
        ];
        
        const hasQueryAnglePattern = queryAnglePatterns.some(pattern => pattern.test(aiResponse));
        const hasAngleAndQuery = (aiResponse.includes('摆角') || aiResponse.includes('角度')) && 
                                 (aiResponse.includes('多少') || aiResponse.includes('查询') || 
                                  aiResponse.includes('当前') || aiResponse.includes('现在') ||
                                  aiResponse.includes('是多少') || aiResponse.includes('多大'));
        
        if (hasQueryAnglePattern || hasAngleAndQuery) {
          return {
            action: 'query_angle',
          message: aiResponse,
          transcript: aiResponse
          };
        }
        
        const misunderstoodKeywords = [
          '宝石', '食物', '白角', '白巧', '白酒', '百长', '柏长',
          '折射角', '顶角', '几何形状', '年龄', '生日', '度数', 
          '品牌', '配方', '长度单位'
        ];
        const isMisunderstood = misunderstoodKeywords.some(keyword => aiResponse.includes(keyword));
        
      if (isMisunderstood) {
          console.log('检测到AI误解，尝试二次提取意图...');
        }
        
        return {
          action: 'other',
        message: aiResponse,
        transcript: aiResponse
        };
      
    } catch (error) {
      console.error('AI API调用失败:', error);
      this.addMessageToContainer('错误', `API调用异常: ${error.message}`, 'error');
      throw error;
    }
  },

  /**
   * 执行命令
   */
  async executeCommand(command, originalTranscript) {
    try {
      const transcriptText = (originalTranscript || '').trim();
      if (transcriptText && transcriptText !== '语音输入') {
        this.addMessageToContainer('语音识别', transcriptText, 'user');
      }

      if (command.action === 'adjust_length') {
        const targetLength = parseFloat(command.targetLength);
        if (isNaN(targetLength) || targetLength <= 0 || targetLength > 100) {
          this.addMessageToContainer('错误', '无效的目标摆长，请输入0-100cm之间的数值', 'error');
          return;
        }

        const currentLength = this.getCurrentLength();
        if (currentLength === null) {
          this.addMessageToContainer('错误', '无法获取当前摆长，请检查设备连接', 'error');
          return;
        }

        if (this.state.adjustmentInProgress || this.state.angleAdjustmentInProgress) {
          this.addMessageToContainer('语音助手', '正在执行其他摆长调整，请稍候', 'error');
          this.updateStatus('就绪');
          return;
        }

        // 如果已经达到目标值（允许0.1cm误差），直接返回
        if (Math.abs(currentLength - targetLength) < 0.1) {
          this.addMessageToContainer('语音助手', `当前摆长已经是${currentLength.toFixed(2)}cm，无需调整`, 'ai');
          this.updateStatus('就绪');
          return;
        }

        this.addMessageToContainer('语音助手', `正在调整摆长到${targetLength.toFixed(1)}cm，请稍候`, 'ai');
        this.updateStatus(`调整中: ${currentLength.toFixed(1)}cm → ${targetLength.toFixed(1)}cm`);
        
        await this.adjustLength(targetLength);
        
        const finalLength = this.getCurrentLength();
        if (finalLength !== null) {
          this.addMessageToContainer('语音助手', `摆长调整完成：${finalLength.toFixed(2)}cm`, 'success');
        }
        this.updateStatus('就绪');

      } else if (command.action === 'adjust_angle') {
        const targetAngle = parseFloat(command.targetAngle);
        if (isNaN(targetAngle) || targetAngle < 0 || targetAngle > 90) {
          this.addMessageToContainer('错误', '无效的目标摆角，请输入0-90°之间的数值', 'error');
          return;
        }

        if (this.state.adjustmentInProgress || this.state.angleAdjustmentInProgress) {
          this.addMessageToContainer('语音助手', '当前存在自动调节任务，请稍候再试', 'error');
          this.updateStatus('就绪');
          return;
        }

        const currentAngle = this.getCurrentAngle();
        if (currentAngle === null) {
          this.addMessageToContainer('错误', '无法获取当前摆角，请检查设备连接', 'error');
          return;
        }

        if (Math.abs(currentAngle - targetAngle) < 0.5) {
          this.addMessageToContainer('语音助手', `当前摆角已经是${currentAngle.toFixed(2)}°，无需调整`, 'ai');
          this.updateStatus('就绪');
          return;
        }

        this.addMessageToContainer('语音助手', `正在调整摆角到${targetAngle.toFixed(1)}°，请稍候`, 'ai');
        this.updateStatus(`调整摆角中: ${currentAngle.toFixed(1)}° → ${targetAngle.toFixed(1)}°`);

        await this.adjustAngle(targetAngle);

        const finalAngle = this.getCurrentAngle();
        if (finalAngle !== null) {
          this.addMessageToContainer('语音助手', `摆角调整完成：${finalAngle.toFixed(2)}°`, 'success');
        }
        this.updateStatus('就绪');

      } else if (command.action === 'query_length') {
        const currentLength = this.getCurrentLength();
        if (currentLength !== null) {
          this.addMessageToContainer('语音助手', `当前摆长：${currentLength.toFixed(2)}cm`, 'ai');
        } else {
          this.addMessageToContainer('错误', '无法获取当前摆长。摆长数据通过WebSocket的pendulum_state消息中的physical_length字段获取，请检查设备连接', 'error');
        }
        this.updateStatus('就绪');

      } else if (command.action === 'query_angle') {
        const currentAngle = this.getCurrentAngle();
        if (currentAngle !== null) {
          this.addMessageToContainer('语音助手', `当前摆角：${currentAngle.toFixed(2)}°`, 'ai');
        } else {
          this.addMessageToContainer('错误', '无法获取当前摆角。摆角数据通过WebSocket的pendulum_state消息中的camera_angle或angle字段获取，请检查设备连接', 'error');
        }
        this.updateStatus('就绪');

      } else {
        // 其他指令，只显示AI回复（已经在callAIAPIWithAudio中显示了）
        this.updateStatus('就绪');
      }
    } catch (error) {
      console.error('执行命令失败:', error);
      this.addMessageToContainer('错误', '执行命令失败: ' + error.message, 'error');
      this.updateStatus('就绪');
    }
  },

  /**
   * 调整摆长
   */
  async adjustLength(targetLength) {
    return new Promise((resolve, reject) => {
      if (this.state.adjustmentInProgress) {
        reject(new Error('已有摆长调整正在进行'));
        return;
      }

      // 获取当前摆长
      const currentLength = this.getCurrentLength();
      
      if (currentLength === null) {
        reject(new Error('无法获取当前摆长'));
        return;
      }

      // 如果已经达到目标值，直接返回
      if (Math.abs(currentLength - targetLength) < 0.1) {
        this.sendSerialCommand('m0'); // 确保停止
        resolve();
        return;
      }

      const lengthDifference = Math.abs(targetLength - currentLength);
      const pushrodSpeed = 0.5; // cm/s (5mm/s)
      const pushrodDurationMs = Math.max(Math.round((lengthDifference / pushrodSpeed) * 1000), 0);
      const needsPushrod = lengthDifference >= 0.05;
      const pushrodCommand = currentLength < targetLength ? 'n2' : 'n1';

      let pushrodPromise = Promise.resolve();

      const stopPushrod = (sendStopCommand = true) => {
        if (this.state.pushrodTimeout) {
          clearTimeout(this.state.pushrodTimeout);
          this.state.pushrodTimeout = null;
        }
        if (this.state.pushrodActive && sendStopCommand) {
          this.sendSerialCommand('n0');
        }
        this.state.pushrodActive = false;
        if (typeof this.state.pushrodResolve === 'function') {
          const resolver = this.state.pushrodResolve;
          this.state.pushrodResolve = null;
          try {
            resolver();
          } catch (resolveError) {
            console.warn('推杆完成回调执行失败:', resolveError);
          }
        }
      };

      // 确定需要执行的操作
      let command = null;
      if (currentLength < targetLength) {
        // 需要放摆线（增加长度）
        command = 'm1';
        this.updateStatus(`放摆线中... (${currentLength.toFixed(1)}cm → ${targetLength.toFixed(1)}cm)`);
      } else {
        // 需要收摆线（减少长度）
        command = 'm2';
        this.updateStatus(`收摆线中... (${currentLength.toFixed(1)}cm → ${targetLength.toFixed(1)}cm)`);
      }

      const pendulumModule = window.PendulumApp?.Pendulum;
      const canPollLength = pendulumModule && typeof pendulumModule.startLengthPolling === 'function' && typeof pendulumModule.stopLengthPolling === 'function';
      if (canPollLength) {
        try {
          pendulumModule.startLengthPolling();
        } catch (pollError) {
          console.warn('启动摆长轮询失败:', pollError);
        }
      }

      const stopAdjustment = ({ stopMotor = true, cancelPushrod = true } = {}) => {
        if (this.state.adjustmentInterval) {
          clearInterval(this.state.adjustmentInterval);
          this.state.adjustmentInterval = null;
        }
        if (cancelPushrod) {
          stopPushrod();
        }
        if (stopMotor) {
          this.sendSerialCommand('m0');
        }
        if (canPollLength) {
          try {
            pendulumModule.stopLengthPolling();
          } catch (pollError) {
            console.warn('停止摆长轮询失败:', pollError);
          }
        }
      };

      const finalizeState = () => {
        this.state.adjustmentInProgress = false;
        this.state.targetLength = null;
      };

      // 发送开始命令
      this.sendSerialCommand(command);
      if (needsPushrod && pushrodDurationMs > 0) {
        pushrodPromise = new Promise((resolvePushrod) => {
          this.state.pushrodActive = true;
          this.state.pushrodResolve = resolvePushrod;
          this.sendSerialCommand(pushrodCommand);
          this.state.pushrodTimeout = setTimeout(() => {
            this.state.pushrodTimeout = null;
            this.state.pushrodActive = false;
            this.sendSerialCommand('n0');
            const resolver = this.state.pushrodResolve;
            this.state.pushrodResolve = null;
            if (resolver) {
              resolver();
            }
          }, pushrodDurationMs);
        });
      } else {
        pushrodPromise = Promise.resolve();
      }

      // 开始监控摆长变化
      this.state.adjustmentInProgress = true;
      this.state.targetLength = targetLength;

      const finishSuccessfully = () => {
        stopAdjustment({ stopMotor: true, cancelPushrod: false });
        pushrodPromise.then(() => {
          finalizeState();
          resolve();
        });
      };

      let checkCount = 0;
      const maxChecks = 300; // 最多检查300次（约30秒）

      this.state.adjustmentInterval = setInterval(() => {
        checkCount++;
        const current = this.getCurrentLength();

        if (current === null) {
          if (checkCount > 10) {
            stopAdjustment();
            finalizeState();
            reject(new Error('无法获取摆长数据'));
          }
          return;
        }

        // 检查是否达到目标值（允许0.1cm误差）
        if (Math.abs(current - targetLength) < 0.1) {
          finishSuccessfully();
          return;
        }

        // 检查是否超时
        if (checkCount >= maxChecks) {
          stopAdjustment();
          finalizeState();
          reject(new Error('调整超时'));
          return;
        }

        // 更新状态显示
        if (current < targetLength) {
          this.updateStatus(`放摆线中... (${current.toFixed(1)}cm → ${targetLength.toFixed(1)}cm)`);
        } else {
          this.updateStatus(`收摆线中... (${current.toFixed(1)}cm → ${targetLength.toFixed(1)}cm)`);
        }
      }, 100); // 每100ms检查一次
    });
  },

  /**
   * 调整摆角
   */
  async adjustAngle(targetAngle) {
    return new Promise((resolve, reject) => {
      if (this.state.angleAdjustmentInProgress) {
        reject(new Error('已有摆角调整正在进行'));
        return;
      }

      this.stopAngleAdjustment();

      const currentAngle = this.getCurrentAngle();
      if (currentAngle === null) {
        reject(new Error('无法获取当前摆角'));
        return;
      }

      if (Math.abs(currentAngle - targetAngle) < 0.5) {
        resolve();
        return;
      }

      const directionCommand = currentAngle < targetAngle ? 'u2' : 'u1';
      const statusText = directionCommand === 'u2' ? '左移电磁铁' : '右移电磁铁';

      this.state.angleAdjustmentInProgress = true;
      this.state.targetAngle = targetAngle;

      // 吸附摆球
      this.sendSerialCommand('d1');
      // 开始沿方向移动
      this.sendSerialCommand(directionCommand);
      this.updateStatus(`${statusText}中... (${currentAngle.toFixed(1)}° → ${targetAngle.toFixed(1)}°)`);

      let checkCount = 0;
      const maxChecks = 300;
      const tolerance = 0.5;

      this.state.angleAdjustmentInterval = setInterval(() => {
        checkCount++;
        const angle = this.getCurrentAngle();

        if (angle === null) {
          if (checkCount > 10) {
            this.stopAngleAdjustment();
            reject(new Error('无法获取摆角数据'));
          }
          return;
        }

        if (Math.abs(angle - targetAngle) <= tolerance) {
          this.stopAngleAdjustment();
          resolve();
          return;
        }

        if ((directionCommand === 'u2' && angle > targetAngle + tolerance + 5) ||
            (directionCommand === 'u1' && angle < targetAngle - tolerance - 5)) {
          // 防止越界，适当停止
            this.stopAngleAdjustment();
          resolve();
          return;
        }

        if (checkCount >= maxChecks) {
          this.stopAngleAdjustment();
          reject(new Error('调整摆角超时'));
        }
      }, 100);
    });
  },

  /**
   * 获取当前摆长
   */
  getCurrentLength() {
    // 优先使用WebSocket状态
    if (this.state.currentLength !== null) {
      return this.state.currentLength;
    }

    // 尝试从Pendulum模块获取
    if (window.PendulumApp && window.PendulumApp.Pendulum) {
      const length = window.PendulumApp.Pendulum.params?.physicalLength;
      if (typeof length === 'number' && length > 0) {
        return length;
      }
    }

    return null;
  },

  /**
   * 获取当前摆角
   */
  getCurrentAngle() {
    // 优先从页面DOM元素获取（实时显示的数据）
    const angleElement = document.getElementById('pendulumAngleDisplay');
    if (angleElement) {
      const angleText = angleElement.textContent || angleElement.innerText;
      // 提取数字（可能包含+/-号和°符号，如"+38.2°"或"-15.5°"）
      const angleMatch = angleText.match(/[+-]?\d+(?:\.\d+)?/);
      if (angleMatch) {
        const angle = parseFloat(angleMatch[0]);
        if (!isNaN(angle)) {
          return angle;
        }
      }
    }

    // 备选：使用WebSocket状态
    if (this.state.currentAngle !== null) {
      return this.state.currentAngle;
    }

    // 备选：尝试从Pendulum模块获取
    if (window.PendulumApp && window.PendulumApp.Pendulum) {
      const angle = window.PendulumApp.Pendulum.params?.angle;
      if (typeof angle === 'number') {
        return angle;
      }
    }

    return null;
  },

  /**
   * 发送串口命令
   */
  sendSerialCommand(command) {
    console.log('发送串口命令:', command);
    
    // 将m1/m2/m0转换为对应的按键
    let key = command;
    if (command === 'm1') {
      key = 's'; // 放摆线
    } else if (command === 'm2') {
      key = 'w'; // 收摆线
    } else if (command === 'm0') {
      key = 'a'; // 停止
    } else if (command === 'u2') {
      key = '3'; // 左移电磁铁
    } else if (command === 'u1') {
      key = '4'; // 右移电磁铁
    } else if (command === 'u0') {
      key = '5'; // 停止电磁铁
    } else if (command === 'n2') {
      key = '6'; // 推杆上升
    } else if (command === 'n1') {
      key = '7'; // 推杆下降
    } else if (command === 'n0') {
      key = '8'; // 推杆停止
    }
    
    let sent = false;
    if (typeof window.sendKey === 'function') {
      try {
        window.sendKey(key);
        sent = true;
      } catch (error) {
        console.error('通过HTTP发送串口命令失败:', error);
      }
    }

    if (!sent) {
    if (this.websocket && typeof this.websocket.sendKey === 'function') {
      this.websocket.sendKey(key);
        sent = true;
    } else if (window.pendulumWebSocket && typeof window.pendulumWebSocket.sendKey === 'function') {
      window.pendulumWebSocket.sendKey(key);
        sent = true;
    } else if (window.PendulumApp && window.PendulumApp.WebSocket && typeof window.PendulumApp.WebSocket.sendKey === 'function') {
      window.PendulumApp.WebSocket.sendKey(key);
        sent = true;
      }
    }

    if (!sent) {
      console.error('无法发送串口命令：未找到有效的sendKey通道');
      this.addMessageToContainer('语音助手', '无法发送控制指令，请检查后端连接', 'error');
    }
  },

  /**
   * 更新状态显示
   */
  updateStatus(text) {
    if (this.elements.statusIndicator) {
      const statusText = this.elements.statusIndicator.querySelector('.voice-status-text');
      if (statusText) {
        statusText.textContent = text;
      }
    }
  },

  /**
   * 添加消息到消息容器
   */
  addMessageToContainer(label, content, type = 'ai') {
    const suppressedLabels = ['系统', '提示'];
    if (suppressedLabels.includes(label) && type !== 'error') {
      return;
    }
    
    if (!this.elements.messageContainer || !this.elements.messageList) return;
    
    // 显示消息容器
    this.elements.messageContainer.style.display = 'flex';
    
    const messageItem = document.createElement('div');
    messageItem.className = `voice-message-item ${type}`;
    messageItem.innerHTML = `
      <div class="voice-message-label">${label}</div>
      <div class="voice-message-content">${this.escapeHtml(content)}</div>
    `;
    
    this.elements.messageList.appendChild(messageItem);
    
    // 自动滚动到底部
    this.elements.messageList.scrollTop = this.elements.messageList.scrollHeight;
    
    // 限制消息数量，最多保留20条
    const messages = this.elements.messageList.querySelectorAll('.voice-message-item');
    if (messages.length > 20) {
      messages[0].remove();
    }
  },

  /**
   * HTML转义
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * 显示消息
   */
  showMessage(message, type = 'info') {
    // 创建临时消息提示
    const messageDiv = document.createElement('div');
    messageDiv.className = `voice-message voice-message-${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
      position: fixed;
      bottom: 220px;
      right: 20px;
      background: ${type === 'error' ? '#d32f2f' : type === 'success' ? '#00e676' : '#0d47a1'};
      color: #ffffff;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      z-index: 9999;
      font-size: 12px;
      max-width: 300px;
      animation: voice-message-in 0.3s ease;
    `;

    document.body.appendChild(messageDiv);

    // 3秒后自动移除
    setTimeout(() => {
      messageDiv.style.animation = 'voice-message-out 0.3s ease';
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.parentNode.removeChild(messageDiv);
        }
      }, 300);
    }, 3000);
  },

  /**
   * 关闭语音助手面板
   */
  closeMessagePanel() {
    if (!this.elements.messageContainer) return;
    if (this.elements.messageList) {
      this.elements.messageList.innerHTML = '';
    }
    this.stopLengthAdjustment();
    this.stopAngleAdjustment();
    this.elements.messageContainer.style.display = 'none';
  },

  stopLengthAdjustment() {
    if (this.state.adjustmentInterval) {
      clearInterval(this.state.adjustmentInterval);
      this.state.adjustmentInterval = null;
    }
    if (this.state.pushrodTimeout) {
      clearTimeout(this.state.pushrodTimeout);
      this.state.pushrodTimeout = null;
    }
    if (typeof this.state.pushrodResolve === 'function') {
      const resolver = this.state.pushrodResolve;
      this.state.pushrodResolve = null;
      try {
        resolver();
      } catch (resolveError) {
        console.warn('推杆完成回调执行失败:', resolveError);
      }
    }
    if (this.state.pushrodActive) {
      this.sendSerialCommand('n0');
      this.state.pushrodActive = false;
    }
    if (this.state.adjustmentInProgress) {
      this.sendSerialCommand('m0');
    }
    this.state.adjustmentInProgress = false;
    this.state.targetLength = null;
  },

  stopAngleAdjustment() {
    if (this.state.angleAdjustmentInterval) {
      clearInterval(this.state.angleAdjustmentInterval);
      this.state.angleAdjustmentInterval = null;
    }
    if (this.state.angleAdjustmentInProgress) {
      this.sendSerialCommand('u0');
    }
    this.state.angleAdjustmentInProgress = false;
    this.state.targetAngle = null;
  }
};

// 导出到全局
window.VoiceAssistant = VoiceAssistant;

