// utils.js
// 工具函数模块

/**
 * Utils 工具函数模块，提供全局通用方法
 */
export const Utils = {
  /**
   * 显示页面提示（toast）
   * @param {string} msg 提示内容
   * @param {number} duration 显示时长（毫秒）
   */
  showToast(msg, duration = 2000) {
    let keyToast = document.getElementById('keyToast');
    if (!keyToast) {
      keyToast = document.createElement('div');
      keyToast.id = 'keyToast';
      document.body.appendChild(keyToast);
    }
    keyToast.textContent = msg;
    keyToast.style.display = 'block';
    clearTimeout(keyToast._timer);
    keyToast._timer = setTimeout(() => { keyToast.style.display = 'none'; }, duration);
  },

  /**
   * 其他工具函数可在此扩展
   */
}; 