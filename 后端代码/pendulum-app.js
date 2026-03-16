// pendulum-app.js
// 主入口对象，所有功能模块化封装
// =============================

const PendulumApp = {
    // 单摆仿真相关模块
    simulation: {},
    // 摄像头与ROI相关模块
    camera: {},
    // UI与交互相关模块
    ui: {},
    // 数据与图表相关模块
    data: {},
    // 初始化入口
    init: function() {
        // TODO: 初始化各模块
    }
};

// 页面加载后自动初始化
window.addEventListener('DOMContentLoaded', () => {
    PendulumApp.init();
}); 