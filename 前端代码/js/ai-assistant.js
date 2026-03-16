// ai-assistant.js
// 蓝黑色调AI助手模块

/**
 * AI助手模块 - 蓝黑色调专业设计
 */
export const AIAssistant = {
  // AI配置
  config: {
    apiKey: '填入你的apikey',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4.5-flash',
    maxTokens: undefined,
    temperature: 0.7
  },

  // DOM元素引用
  elements: {
    assistantContainer: null,
    assistantToggle: null,
    messagesContainer: null,
    inputElement: null,
    sendButton: null,
    closeButton: null
  },

  // 状态管理
  state: {
    isOpen: false,
    isLoading: false,
    conversationHistory: []
  },

  // AI知识库内容
  knowledgeBase: '',

  /**
   * 初始化AI助手
   */
  async init() {
    try {
      // 加载AI知识库
      await this.loadKnowledgeBase();
      
      // 创建AI助手界面
      this.createInterface();
      
      // 绑定事件
      this.bindEvents();
      
      console.log('AI助手初始化完成');
    } catch (error) {
      console.error('AI助手初始化失败:', error);
    }
  },

  /**
   * 加载AI知识库
   */
  async loadKnowledgeBase() {
    try {
      const possiblePaths = [
        '../ai-instructions.md',
        '../../ai-instructions.md',
        'ai-instructions.md',
        '/ai-instructions.md',
        '../AI解析使用说明.md',
        '../../AI解析使用说明.md',
        'AI解析使用说明.md',
        '/AI解析使用说明.md'
      ];

      for (const path of possiblePaths) {
        try {
          const response = await fetch(path);
          if (response.ok) {
            this.knowledgeBase = await response.text();
            console.log('AI知识库加载成功，路径:', path);
            break;
          }
        } catch (error) {
          continue;
        }
      }

      if (!this.knowledgeBase) {
        this.knowledgeBase = this.getDefaultKnowledgeBase();
        console.log('使用内置AI知识库');
      }
    } catch (error) {
      console.error('加载AI知识库失败:', error);
      this.knowledgeBase = this.getDefaultKnowledgeBase();
    }
  },

  /**
   * 获取默认的AI知识库
   */
  getDefaultKnowledgeBase() {
    return `单摆数字孪生系统操作与界面说明

一、系统核心功能概述
本系统为单摆数字孪生系统，通过摄像头识别现实单摆的小球与摆线，同步仿真单摆动画，实现摆长、角度的实时监测，记录摆动周期数据，并支持数据导出、可视化分析及实验报告生成。

二、操作流程说明
1. 小球识别校准：按下快捷键 c 进入 ROI 框选阶段，对小球进行 HSV 颜色校准
2. 摆长调整：使用推杆和摆线组合调整
3. 角度设置：按下快捷键 z 设置角度零点
4. 实验运行：按下开始实验按钮，系统开始记录数据
5. 数据导出：按下导出数据按钮，下载实验数据

三、快捷键功能
左键：设定摆心
右键：设定坐标轴零点
z：设置角度零点
r：清除数据
c：校准HSV识别
d：删除参考点和参考角度
l：启动/终止串口通信
x：导出数据为json

四、界面区域
左栏：单摆动画和快捷操作说明
中栏：摄像头画面
右栏：实验控制、图表显示和日志区域`;
  },

  /**
   * 创建AI助手界面
   */
  createInterface() {
    // 创建样式
    this.createStyles();

    // 创建AI助手切换按钮
    const toggle = document.createElement('div');
    toggle.id = 'aiAssistantToggle';
    toggle.className = 'ai-assistant-toggle';
    toggle.innerHTML = `
      <div class="ai-toggle-icon">AI</div>
      <div class="ai-toggle-text">助手</div>
    `;

    // 创建AI助手容器
    const container = document.createElement('div');
    container.id = 'aiAssistantContainer';
    container.className = 'ai-assistant-container';
    container.innerHTML = `
      <div class="ai-assistant-header">
        <div class="ai-header-title">
          <div class="ai-title-text">系统助手</div>
          <div class="ai-status-indicator">
            <div class="ai-status-dot"></div>
            <div class="ai-status-text">在线</div>
          </div>
        </div>
        <button id="aiAssistantClose" class="ai-close-btn" title="关闭">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3">
            <line x1="6" y1="6" x2="18" y2="18"/>
            <line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </button>
      </div>
      
      <div class="ai-messages-container" id="aiMessagesContainer">
        <div class="ai-message ai-welcome">
          <div class="ai-message-content">
            <div class="ai-message-header">
              <div class="ai-sender">系统助手</div>
              <div class="ai-time">刚刚</div>
            </div>
            <div class="ai-message-text">
              您好！我是单摆数字孪生系统的AI助手。我可以帮助您解答系统操作问题。
            </div>
            <div class="ai-quick-actions">
              <div class="ai-action-item" data-question="如何开始实验？">
                <div class="ai-action-icon"></div>
                <div class="ai-action-text">如何开始实验？</div>
              </div>
              <div class="ai-action-item" data-question="摆长怎么调整？">
                <div class="ai-action-icon"></div>
                <div class="ai-action-text">摆长怎么调整？</div>
              </div>
              <div class="ai-action-item" data-question="摄像头识别问题">
                <div class="ai-action-icon"></div>
                <div class="ai-action-text">摄像头识别问题</div>
              </div>
              <div class="ai-action-item" data-question="如何导出数据？">
                <div class="ai-action-icon"></div>
                <div class="ai-action-text">如何导出数据？</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="ai-input-area">
        <div class="ai-input-wrapper">
          <textarea 
            id="aiAssistantInput" 
            class="ai-input" 
            placeholder="输入您的问题..."
            rows="1"
          ></textarea>
          <button id="aiAssistantSend" class="ai-send-btn" title="发送">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
        <div class="ai-input-hint">按 Enter 发送</div>
      </div>
    `;

    // 添加到页面
    document.body.appendChild(toggle);
    document.body.appendChild(container);

    // 保存DOM元素引用
    this.elements = {
      assistantContainer: container,
      assistantToggle: toggle,
      messagesContainer: document.getElementById('aiMessagesContainer'),
      inputElement: document.getElementById('aiAssistantInput'),
      sendButton: document.getElementById('aiAssistantSend'),
      closeButton: document.getElementById('aiAssistantClose')
    };
    
    // 强制应用按钮样式
    this.forceButtonStyles();
  },

  /**
   * 强制应用按钮样式
   */
  forceButtonStyles() {
    // 延迟执行确保DOM已加载
    setTimeout(() => {
      try {
        const closeBtn = document.getElementById('aiAssistantClose');
        const sendBtn = document.getElementById('aiAssistantSend');
        
        if (closeBtn) {
          closeBtn.style.cssText = `
            width: 16px !important;
            height: 16px !important;
            min-width: 16px !important;
            max-width: 16px !important;
            min-height: 16px !important;
            max-height: 16px !important;
            border: none !important;
            border-radius: 2px !important;
            background: #ef4444 !important;
            padding: 0 !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            line-height: 1 !important;
            font-size: 0 !important;
          `;
        }
        
        if (sendBtn) {
          sendBtn.style.cssText = `
            width: 32px !important;
            height: 32px !important;
            min-width: 32px !important;
            max-width: 32px !important;
            min-height: 32px !important;
            max-height: 32px !important;
            border: none !important;
            border-radius: 4px !important;
            background: linear-gradient(135deg, #000000 0%, #0d47a1 100%) !important;
            padding: 0 !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            line-height: 1 !important;
            font-size: 0 !important;
          `;
        }
      } catch (error) {
        console.warn('强制应用按钮样式失败:', error);
      }
    }, 100);
  },

  /**
   * 创建样式
   */
  createStyles() {
    if (document.getElementById('ai-assistant-styles')) return;
    
    const styles = `
      /* AI助手样式 - 黑蓝配色 */
      .ai-assistant-toggle {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 56px;
        height: 56px;
        background: linear-gradient(135deg, #000000 0%, #1a237e 100%);
        border-radius: 50%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        transition: all 0.3s ease;
        z-index: 9999;
        border: 2px solid #0d47a1;
      }
      
      .ai-assistant-toggle:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 20px rgba(13, 71, 161, 0.4);
        background: linear-gradient(135deg, #0d47a1 0%, #1a237e 100%);
      }
      
      .ai-assistant-toggle.active {
        transform: scale(0.9);
        opacity: 0.8;
      }
      
      .ai-toggle-icon {
        font-size: 14px;
        font-weight: bold;
        color: #64b5f6;
        margin-bottom: 2px;
      }
      
      .ai-toggle-text {
        font-size: 9px;
        color: #90caf9;
        font-weight: 500;
      }
      
      .ai-assistant-container {
        position: fixed;
        bottom: 90px;
        right: 20px;
        width: 320px;
        height: 480px;
        background: linear-gradient(180deg, #000000 0%, #1a1a1a 100%);
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        opacity: 0;
        transform: translateY(20px) scale(0.9);
        transition: all 0.3s ease;
        z-index: 9998;
        overflow: hidden;
        border: 1px solid #0d47a1;
      }
      
      .ai-assistant-container.open {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      
      .ai-assistant-header {
        background: linear-gradient(135deg, #000000 0%, #0d47a1 100%);
        color: #e3f2fd;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid #0d47a1;
      }
      
      .ai-header-title {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      
      .ai-title-text {
        font-size: 14px;
        font-weight: 600;
        color: #ffffff;
      }
      
      .ai-status-indicator {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .ai-status-dot {
        width: 6px;
        height: 6px;
        background: #00e676;
        border-radius: 50%;
        animation: ai-pulse 2s infinite;
      }
      
      @keyframes ai-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      
      .ai-status-text {
        font-size: 11px;
        color: #b3e5fc;
      }
      
      .ai-close-btn {
        width: 16px !important;
        height: 16px !important;
        min-width: 16px !important;
        max-width: 16px !important;
        min-height: 16px !important;
        max-height: 16px !important;
        border: none !important;
        border-radius: 2px !important;
        background: #ef4444 !important;
        color: #ffffff !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        transition: all 0.2s ease !important;
        padding: 0 !important;
        margin: 0 !important;
        box-sizing: border-box !important;
        line-height: 1 !important;
        font-size: 0 !important;
      }
      
      .ai-close-btn:hover {
        background: #dc2626 !important;
        transform: scale(1.1) !important;
      }
      
      .ai-close-btn svg {
        width: 10px !important;
        height: 10px !important;
        min-width: 10px !important;
        max-width: 10px !important;
        min-height: 10px !important;
        max-height: 10px !important;
        display: block !important;
      }
      
      .ai-messages-container {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        background: #0a0a0a;
      }
      
      .ai-messages-container::-webkit-scrollbar {
        width: 4px;
      }
      
      .ai-messages-container::-webkit-scrollbar-track {
        background: #1a1a1a;
      }
      
      .ai-messages-container::-webkit-scrollbar-thumb {
        background: #0d47a1;
        border-radius: 2px;
      }
      
      .ai-message {
        margin-bottom: 12px;
        animation: ai-message-in 0.3s ease;
      }
      
      @keyframes ai-message-in {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .ai-message-content {
        background: #1a1a1a;
        border-radius: 8px;
        padding: 10px 12px;
        border: 1px solid #0d47a1;
      }
      
      .ai-message-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }
      
      .ai-sender {
        font-size: 12px;
        font-weight: 600;
        color: #64b5f6;
      }
      
      .ai-time {
        font-size: 11px;
        color: #757575;
      }
      
      .ai-message-text {
        font-size: 13px;
        color: #e3f2fd;
        line-height: 1.4;
        margin-bottom: 8px;
      }
      
      .ai-quick-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }
      
      .ai-action-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        background: #0a0a0a;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid #0d47a1;
      }
      
      .ai-action-item:hover {
        background: #0d47a1;
        border-color: #1976d2;
        transform: translateY(-1px);
      }
      
      .ai-action-icon {
        font-size: 12px;
        color: #64b5f6;
      }
      
      .ai-action-text {
        font-size: 11px;
        color: #e3f2fd;
      }
      
      .ai-input-area {
        padding: 12px;
        background: #1a1a1a;
        border-top: 1px solid #0d47a1;
      }
      
      .ai-input-wrapper {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        margin-bottom: 6px;
      }
      
      .ai-input {
        flex: 1;
        background: #0a0a0a;
        border: 1px solid #0d47a1;
        border-radius: 6px;
        padding: 8px 10px;
        font-size: 12px;
        color: #e3f2fd;
        resize: none;
        outline: none;
        transition: border-color 0.2s ease;
        font-family: inherit;
        min-height: 16px;
        max-height: 80px;
      }
      
      .ai-input:focus {
        border-color: #1976d2;
        box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
      }
      
      .ai-input::placeholder {
        color: #757575;
      }
      
      .ai-send-btn {
        width: 32px !important;
        height: 32px !important;
        min-width: 32px !important;
        max-width: 32px !important;
        min-height: 32px !important;
        max-height: 32px !important;
        border: none !important;
        border-radius: 4px !important;
        background: linear-gradient(135deg, #000000 0%, #0d47a1 100%) !important;
        color: #64b5f6 !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        transition: all 0.2s ease !important;
        flex-shrink: 0 !important;
        border: 1px solid #0d47a1 !important;
        padding: 0 !important;
        margin: 0 !important;
        box-sizing: border-box !important;
        line-height: 1 !important;
        font-size: 0 !important;
      }
      
      .ai-send-btn:hover {
        background: linear-gradient(135deg, #0d47a1 0%, #1976d2 100%) !important;
        transform: scale(1.1) !important;
      }
      
      .ai-send-btn:disabled {
        opacity: 0.5 !important;
        cursor: not-allowed !important;
        transform: none !important;
      }
      
      .ai-send-btn svg {
        width: 16px !important;
        height: 16px !important;
        min-width: 16px !important;
        max-width: 16px !important;
        min-height: 16px !important;
        max-height: 16px !important;
        display: block !important;
      }
      
      .ai-input-hint {
        font-size: 10px;
        color: #757575;
        text-align: center;
      }
      
      .ai-message-loading {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .ai-message-loading .ai-message-content {
        background: #1a1a1a;
        border: 1px solid #0d47a1;
      }
      
      .ai-message-loading .ai-message-text {
        color: #9e9e9e;
        font-style: italic;
      }
      
      .ai-message-user {
        display: flex;
        justify-content: flex-end;
      }
      
      .ai-message-user .ai-message-content {
        background: linear-gradient(135deg, #000000 0%, #0d47a1 100%);
        border-color: #0d47a1;
      }
      
      .ai-message-user .ai-sender {
        color: #90caf9;
      }
    }
    
    @keyframes ai-loading {
      0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
      40% { transform: scale(1); opacity: 1; }
    }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.id = 'ai-assistant-styles';
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  },

  /**
   * 安全的事件绑定
   */
  safeAddEventListener(element, event, handler) {
    if (!element || typeof element.addEventListener !== 'function') {
      return;
    }
    try {
      element.addEventListener(event, handler);
    } catch (error) {
      console.warn('事件绑定失败:', error);
    }
  },

  /**
   * 绑定事件
   */
  bindEvents() {
    // 切换按钮点击事件
    this.safeAddEventListener(this.elements.assistantToggle, 'click', () => {
      this.toggle();
    });

    // 关闭按钮点击事件
    this.safeAddEventListener(this.elements.closeButton, 'click', () => {
      this.close();
    });

    // 发送按钮点击事件
    this.safeAddEventListener(this.elements.sendButton, 'click', () => {
      this.sendMessage();
    });

    // 输入框事件
    this.safeAddEventListener(this.elements.inputElement, 'keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.safeAddEventListener(this.elements.inputElement, 'input', () => {
      this.autoResize();
    });

    // 快捷操作点击事件
    this.safeAddEventListener(document, 'click', (e) => {
      try {
        if (e.target.closest('.ai-action-item')) {
          const item = e.target.closest('.ai-action-item');
          const question = item.dataset.question;
          if (question) {
            this.askQuestion(question);
          }
        }
      } catch (error) {
        console.warn('快捷操作点击错误:', error);
      }
    });
  },

  /**
   * 切换AI助手
   */
  toggle() {
    if (this.state.isOpen) {
      this.close();
    } else {
      this.open();
    }
  },

  /**
   * 打开AI助手
   */
  open() {
    this.state.isOpen = true;
    if (this.elements.assistantContainer) {
      this.elements.assistantContainer.classList.add('open');
    }
    if (this.elements.assistantToggle) {
      this.elements.assistantToggle.classList.add('active');
    }
    if (this.elements.inputElement) {
      this.elements.inputElement.focus();
    }
  },

  /**
   * 关闭AI助手
   */
  close() {
    this.state.isOpen = false;
    if (this.elements.assistantContainer) {
      this.elements.assistantContainer.classList.remove('open');
    }
    if (this.elements.assistantToggle) {
      this.elements.assistantToggle.classList.remove('active');
    }
  },

  /**
   * 发送消息
   */
  async sendMessage() {
    try {
      if (!this.elements.inputElement || !this.elements.inputElement.value) return;
      
      const message = String(this.elements.inputElement.value || '').trim();
      if (!message || this.state.isLoading) return;

      // 添加用户消息
      this.addMessage(message, 'user');
      
      // 清空输入框
      this.elements.inputElement.value = '';
      this.autoResize();

      // 显示加载状态
      this.state.isLoading = true;
      this.addMessage('正在思考中...', 'ai', 'loading');

      try {
        // 调用AI API
        const response = await this.callAIAPI(message);
        
        // 移除加载消息
        this.removeLoadingMessage();
        
        // 添加AI回复
        this.addMessage(response, 'ai');
      } catch (error) {
        console.error('AI API调用失败:', error);
        this.removeLoadingMessage();
        this.addMessage('抱歉，我遇到了一些问题。请稍后再试。', 'ai', 'error');
      } finally {
        this.state.isLoading = false;
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      this.state.isLoading = false;
    }
  },

  /**
   * 调用AI API
   */
  async callAIAPI(userMessage) {
    const messages = [
      {
        role: 'system',
        content: `你是单摆数字孪生系统的AI助手。基于以下知识库回答用户问题：

${this.knowledgeBase}

回答要求：
1. 基于知识库回答问题
2. 回答简洁明了，步骤清晰
3. 涉及操作时提供具体步骤
4. 保持专业和友好的语气
5. 遇到知识库外的问题要诚实说明`
      }
    ];

    // 添加对话历史
    this.state.conversationHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // 添加当前消息
    messages.push({
      role: 'user',
      content: userMessage
    });

    try {
      const requestData = {
        model: this.config.model,
        temperature: this.config.temperature,
        messages: messages
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;

      // 保存到对话历史
      this.state.conversationHistory.push({
        role: 'user',
        content: userMessage
      });
      this.state.conversationHistory.push({
        role: 'assistant',
        content: aiResponse
      });

      // 限制对话历史长度
      if (this.state.conversationHistory.length > 8) {
        this.state.conversationHistory = this.state.conversationHistory.slice(-8);
      }

      return aiResponse;
    } catch (error) {
      console.error('AI API调用失败:', error);
      throw error;
    }
  },

  /**
   * 添加消息
   */
  addMessage(content, type, subtype = 'normal') {
    if (!this.elements.messagesContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-message ai-message-${type}`;
    if (subtype) {
      messageDiv.classList.add(`ai-message-${subtype}`);
    }

    if (type === 'user') {
      messageDiv.innerHTML = `
        <div class="ai-message-content">
          <div class="ai-message-header">
            <div class="ai-sender">您</div>
            <div class="ai-time">刚刚</div>
          </div>
          <div class="ai-message-text">${this.formatMessage(content)}</div>
        </div>
      `;
    } else if (subtype === 'loading') {
      messageDiv.innerHTML = `
        <div class="ai-message-content">
          <div class="ai-message-header">
            <div class="ai-sender">系统助手</div>
            <div class="ai-time">刚刚</div>
          </div>
          <div class="ai-message-text">
            <div style="display: flex; align-items: center; gap: 6px;">
              <div style="width: 6px; height: 6px; border-radius: 50%; background: #60a5fa; animation: ai-loading 1s infinite;"></div>
              <div style="width: 6px; height: 6px; border-radius: 50%; background: #60a5fa; animation: ai-loading 1s infinite 0.2s;"></div>
              <div style="width: 6px; height: 6px; border-radius: 50%; background: #60a5fa; animation: ai-loading 1s infinite 0.4s;"></div>
            </div>
          </div>
        </div>
      `;
    } else {
      messageDiv.innerHTML = `
        <div class="ai-message-content">
          <div class="ai-message-header">
            <div class="ai-sender">系统助手</div>
            <div class="ai-time">刚刚</div>
          </div>
          <div class="ai-message-text">${this.formatMessage(content)}</div>
        </div>
      `;
    }

    this.elements.messagesContainer.appendChild(messageDiv);
    this.scrollToBottom();
  },

  /**
   * 格式化消息
   */
  formatMessage(content) {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>')
      .replace(/(\d+)\./g, '<br>$1.');
  },

  /**
   * 移除加载消息
   */
  removeLoadingMessage() {
    if (!this.elements.messagesContainer) return;
    const loadingMessages = this.elements.messagesContainer.querySelectorAll('.ai-message-loading');
    loadingMessages.forEach(msg => msg.remove());
  },

  /**
   * 快速提问
   */
  askQuestion(question) {
    try {
      if (this.elements.inputElement) {
        this.elements.inputElement.value = String(question || '');
        this.sendMessage();
      }
    } catch (error) {
      console.warn('快速提问错误:', error);
    }
  },

  /**
   * 自动调整输入框高度
   */
  autoResize() {
    if (!this.elements.inputElement) return;
    const textarea = this.elements.inputElement;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px';
  },

  /**
   * 滚动到底部
   */
  scrollToBottom() {
    if (!this.elements.messagesContainer) return;
    this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
  }
};

// 导出到全局
window.AIAssistant = AIAssistant;