// camera.js
// 摄像头与ROI相关模块

/**
 * Camera 模块负责摄像头画面、ROI框选、同步状态等功能
 */
export const Camera = {
  // ROI相关状态
  roiFreezeMode: false,
  roiRectData: null,
  roiStart: null,
  roiRect: null,
  roiDragging: false,
  cameraFeedTimer: null,

  // DOM元素引用
  cameraFeed: null,
  cameraWrapper: null,
  roiDiv: null,
  keyToast: null,

  /**
   * 初始化摄像头模块，绑定事件
   */
  init() {
    // 获取DOM元素
    this.cameraFeed = document.getElementById('cameraFeed');
    this.cameraWrapper = document.getElementById('cameraWrapper');
    this.roiDiv = document.getElementById('roiDiv');
    this.keyToast = document.getElementById('keyToast');

    // 禁止拖动摄像头图片
    this.cameraFeed.addEventListener('dragstart', e => e.preventDefault());

    // 绑定ROI相关鼠标事件
    this.cameraWrapper.addEventListener('mousedown', this._onMouseDown.bind(this));
    this.cameraWrapper.addEventListener('mousemove', this._onMouseMove.bind(this));
    window.addEventListener('mouseup', this._onMouseUp.bind(this));

    // 绑定点击事件（左键/右键）
    this.cameraWrapper.addEventListener('click', this._onClick.bind(this));
    this.cameraWrapper.addEventListener('contextmenu', this._onContextMenu.bind(this));

    // 绑定键盘事件
    document.addEventListener('keydown', this._onKeyDown.bind(this));

    // 启动摄像头画面轮询
    this.startCameraFeed();
  },

  /**
   * 启动摄像头画面轮询
   */
  startCameraFeed() {
    if (this.cameraFeedTimer) clearInterval(this.cameraFeedTimer);
    const cameraFeed = this.cameraFeed;
    const syncStatus = document.getElementById('syncStatus');
    cameraFeed.style.opacity = '0.7';
    if (syncStatus) {
      syncStatus.textContent = '🔄 正在连接摄像头...';
      syncStatus.style.color = '#ff9800';
    }
    let retryCount = 0;
    const maxRetries = 3;
    const self = this;
    function loadCameraFeed() {
      if (!self.roiFreezeMode) {
        const timestamp = Date.now();
        const newSrc = `http://127.0.0.1:5000/video_feed?t=${timestamp}`;
        cameraFeed.onerror = function() {
          retryCount++;
          if (retryCount >= maxRetries && syncStatus) {
            syncStatus.textContent = '摄像头连接失败';
            syncStatus.style.color = '#f44336';
            cameraFeed.style.opacity = '0.3';
            clearInterval(self.cameraFeedTimer);
          }
        };
        cameraFeed.onload = function() {
          retryCount = 0;
          cameraFeed.style.opacity = '1';
          if (syncStatus) {
            syncStatus.textContent = '✅ 摄像头已连接';
            syncStatus.style.color = '#4caf50';
          }
        };
        cameraFeed.src = newSrc;
      }
    }
    loadCameraFeed();
    this.cameraFeedTimer = setInterval(loadCameraFeed, 500); // 降低刷新频率到500ms (2FPS)
  },

  /**
   * 鼠标按下事件（ROI框选起点）
   */
  _onMouseDown(e) {
    if (!this.roiFreezeMode || e.button !== 0) return;
    this.roiDragging = true;
    const imageCoords = this.mouseToImageCoords(e.offsetX, e.offsetY);
    this.roiStart = imageCoords;
    const displayCoords = this.imageToDisplayCoords(imageCoords.x, imageCoords.y);
    this.roiDiv.style.display = 'block';
    this.roiDiv.style.position = 'absolute';
    this.roiDiv.style.left = displayCoords.x + 'px';
    this.roiDiv.style.top = displayCoords.y + 'px';
    this.roiDiv.style.width = '0px';
    this.roiDiv.style.height = '0px';
  },

  /**
   * 鼠标移动事件（ROI框选拖动）
   */
  _onMouseMove(e) {
    if (!this.roiFreezeMode || !this.roiDragging) return;
    const currentImageCoords = this.mouseToImageCoords(e.offsetX, e.offsetY);
    const sx = Math.min(this.roiStart.x, currentImageCoords.x);
    const sy = Math.min(this.roiStart.y, currentImageCoords.y);
    const ex = Math.max(this.roiStart.x, currentImageCoords.x);
    const ey = Math.max(this.roiStart.y, currentImageCoords.y);
    this.roiRect = {sx, sy, ex, ey};
    const startDisplay = this.imageToDisplayCoords(sx, sy);
    const endDisplay = this.imageToDisplayCoords(ex, ey);
    this.roiDiv.style.display = 'block';
    this.roiDiv.style.position = 'absolute';
    this.roiDiv.style.left = startDisplay.x + 'px';
    this.roiDiv.style.top = startDisplay.y + 'px';
    this.roiDiv.style.width = (endDisplay.x - startDisplay.x) + 'px';
    this.roiDiv.style.height = (endDisplay.y - startDisplay.y) + 'px';
  },

  /**
   * 鼠标松开事件（ROI框选终点）
   */
  _onMouseUp(e) {
    if (!this.roiFreezeMode || !this.roiDragging || !this.roiRect) return;
    const roiWidth = this.roiRect.ex - this.roiRect.sx;
    const roiHeight = this.roiRect.ey - this.roiRect.sy;
    const minSize = 10;
    if (roiWidth < minSize || roiHeight < minSize) {
      this.showKeyToast('ROI区域太小，请重新选择');
      this.roiDiv.style.display = 'none';
      this.roiDragging = false;
      this.roiStart = null;
      this.roiRect = null;
      return;
    }
    if (this.roiRect.sx < 0 || this.roiRect.sy < 0 ||
        this.roiRect.ex > this.cameraFeed.naturalWidth || this.roiRect.ey > this.cameraFeed.naturalHeight) {
      this.showKeyToast('ROI区域超出图像范围，请重新选择');
      this.roiDiv.style.display = 'none';
      this.roiDragging = false;
      this.roiStart = null;
      this.roiRect = null;
      return;
    }
    this.roiRectData = {
      x: Math.round(this.roiRect.sx),
      y: Math.round(this.roiRect.sy),
      w: Math.round(roiWidth),
      h: Math.round(roiHeight)
    };
    this.roiDragging = false;
    this.roiStart = null;
    this.roiRect = null;
    this.showKeyToast('ROI区域已选择，按Enter提交');
  },

  /**
   * 鼠标左键点击事件（设定摆心）
   */
  _onClick(e) {
    if (this.roiFreezeMode) return;
    const contentRect = this.getImageContentRect(this.cameraFeed);
    if (!contentRect) return;
    const px = e.clientX - contentRect.left;
    const py = e.clientY - contentRect.top;
    const scaleX = this.cameraFeed.naturalWidth / contentRect.width;
    const scaleY = this.cameraFeed.naturalHeight / contentRect.height;
    const sendX = Math.round(px * scaleX);
    const sendY = Math.round(py * scaleY);
    if (px < 0 || py < 0 || px > contentRect.width || py > contentRect.height) return;
    fetch('http://127.0.0.1:5000/pendulum_mouse', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({type: 'left', x: sendX, y: sendY})
    });
  },

  /**
   * 鼠标右键点击事件（设定坐标轴零点）
   */
  _onContextMenu(e) {
    if (this.roiFreezeMode) return;
    e.preventDefault();
    const contentRect = this.getImageContentRect(this.cameraFeed);
    if (!contentRect) return;
    const px = e.clientX - contentRect.left;
    const py = e.clientY - contentRect.top;
    const scaleX = this.cameraFeed.naturalWidth / contentRect.width;
    const scaleY = this.cameraFeed.naturalHeight / contentRect.height;
    const sendX = Math.round(px * scaleX);
    const sendY = Math.round(py * scaleY);
    if (px < 0 || py < 0 || px > contentRect.width || py > contentRect.height) return;
    fetch('http://127.0.0.1:5000/pendulum_mouse', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({type: 'right', x: sendX, y: sendY})
    });
  },

  /**
   * 键盘事件（ROI提交、进入ROI模式、快捷键发送）
   */
  _onKeyDown(e) {
    // 输入框聚焦时不触发快捷键
    if (window.inputActive) return;
    // ROI提交
    if (this.roiFreezeMode && e.key === 'Enter' && this.roiRectData) {
      if (this.roiRectData.w < 10 || this.roiRectData.h < 10) {
        this.showKeyToast('ROI区域太小，请重新选择');
        return;
      }
      fetch('http://127.0.0.1:5000/pendulum_roi', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(this.roiRectData)
      })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          this.showKeyToast('HSV校准成功！');
        } else {
          this.showKeyToast('HSV校准失败：' + (data.error || '未知错误'));
        }
      })
      .catch(() => {
        this.showKeyToast('ROI提交失败，请重试');
      });
      fetch('http://127.0.0.1:5000/pendulum_resume', {method: 'POST'});
      this.roiFreezeMode = false;
      this.roiRectData = null;
      this.startCameraFeed();
      this.roiDiv.style.display = 'none';
      return;
    }
    // 进入ROI模式
    if (e.key === 'c' && !this.roiFreezeMode) {
      if (!this.cameraFeed.naturalWidth || !this.cameraFeed.naturalHeight) {
        this.showKeyToast('摄像头未就绪，请稍后再试');
        return;
      }
      fetch('http://127.0.0.1:5000/pendulum_pause', {method: 'POST'});
      this.roiFreezeMode = true;
      if (this.cameraFeedTimer) clearInterval(this.cameraFeedTimer);
      const message = `画面已冻结，请用鼠标拖拽选取小球区域进行HSV校准。\n\n选择技巧：\n1. 选择包含小球颜色的区域\n2. 避免选择背景或其他物体\n3. 区域大小建议20x20像素以上\n4. 选完后按Enter提交\n\n当前图像尺寸: ${this.cameraFeed.naturalWidth}x${this.cameraFeed.naturalHeight}`;
      alert(message);
      this.showKeyToast('进入ROI框选模式');
      return;
    }
    // 发送快捷键到后端
    if (!this.roiFreezeMode && (e.key.length === 1 || ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))) {
      fetch('http://127.0.0.1:5000/pendulum_key', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({key: e.key})
      });
      this.showKeyToast('已发送快捷键：' + e.key);
    }
  },

  /**
   * 获取图像的实际显示区域和缩放比例
   */
  getImageDisplayInfo() {
    const rect = this.cameraFeed.getBoundingClientRect();
    const wrapperRect = this.cameraWrapper.getBoundingClientRect();
    const imgAspectRatio = this.cameraFeed.naturalWidth / this.cameraFeed.naturalHeight;
    const wrapperAspectRatio = wrapperRect.width / wrapperRect.height;
    let displayWidth, displayHeight, offsetX, offsetY;
    if (imgAspectRatio > wrapperAspectRatio) {
      displayWidth = wrapperRect.width;
      displayHeight = wrapperRect.width / imgAspectRatio;
      offsetX = 0;
      offsetY = (wrapperRect.height - displayHeight) / 2;
    } else {
      displayHeight = wrapperRect.height;
      displayWidth = wrapperRect.height * imgAspectRatio;
      offsetX = (wrapperRect.width - displayWidth) / 2;
      offsetY = 0;
    }
    return {
      displayWidth,
      displayHeight,
      offsetX,
      offsetY,
      scaleX: this.cameraFeed.naturalWidth / displayWidth,
      scaleY: this.cameraFeed.naturalHeight / displayHeight
    };
  },

  /**
   * 将鼠标坐标转换为图像坐标
   */
  mouseToImageCoords(mouseX, mouseY) {
    const info = this.getImageDisplayInfo();
    const imageX = (mouseX - info.offsetX) * info.scaleX;
    const imageY = (mouseY - info.offsetY) * info.scaleY;
    return {
      x: Math.max(0, Math.min(this.cameraFeed.naturalWidth, imageX)),
      y: Math.max(0, Math.min(this.cameraFeed.naturalHeight, imageY))
    };
  },

  /**
   * 将图像坐标转换为显示坐标
   */
  imageToDisplayCoords(imageX, imageY) {
    const info = this.getImageDisplayInfo();
    return {
      x: imageX / info.scaleX + info.offsetX,
      y: imageY / info.scaleY + info.offsetY
    };
  },

  /**
   * 获取摄像头画面内容区域（用于点击坐标转换）
   */
  getImageContentRect(img) {
    const rect = img.getBoundingClientRect();
    if (!img.naturalWidth || !img.naturalHeight || rect.width === 0 || rect.height === 0) {
      return null;
    }
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const rectAspect = rect.width / rect.height;
    let contentLeft, contentTop, contentWidth, contentHeight;
    if (imgAspect > rectAspect) {
      contentWidth = rect.width;
      contentHeight = rect.width / imgAspect;
      contentLeft = rect.left;
      contentTop = rect.top + (rect.height - contentHeight) / 2;
    } else {
      contentHeight = rect.height;
      contentWidth = rect.height * imgAspect;
      contentTop = rect.top;
      contentLeft = rect.left + (rect.width - contentWidth) / 2;
    }
    return {left: contentLeft, top: contentTop, width: contentWidth, height: contentHeight};
  },

  /**
   * 显示提示信息
   */
  showKeyToast(msg) {
    if (!this.keyToast) return;
    this.keyToast.textContent = msg;
    this.keyToast.style.display = 'block';
    clearTimeout(this.keyToast._timer);
    this.keyToast._timer = setTimeout(() => { this.keyToast.style.display = 'none'; }, 2000);
  }
};