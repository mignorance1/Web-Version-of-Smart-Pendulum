#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
实时单摆接口 - 快速响应，真实更新时间
"""

import cv2
import numpy as np
import threading
import time
import json
import urllib.request
import urllib.error
from typing import Dict, List, Optional, Tuple, Any


class PendulumData:
    """单摆数据管理类"""

    def __init__(self):
        self.angle = 0.0
        self.length = 100.0
        self.period = 0.0
        self.time = time.time()
        self.ball_x = 0
        self.ball_y = 0
        self.pivot_x = 0
        self.pivot_y = 0
        self.camera_angle = 0.0
        self.timestamp = time.time()
        self.angle_history = []
        self.position_history = []
        self.last_update_time = 0
        self.last_realtime_update = 0

    def update(self, **kwargs):
        """更新单摆数据"""
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
        self.last_update_time = time.time()
        self.last_realtime_update = time.time()


class RealtimePendulumInterface:
    """实时单摆接口类 - 快速响应"""

    def __init__(self, host: str = "localhost", port: int = 5000):
        self.host = host
        self.port = port
        self.base_url = f"http://{host}:{port}"
        self.data = PendulumData()
        self.camera_cap = None
        self.camera_thread = None
        self.camera_running = False
        self.camera_available = False
        self.backend_available = False
        self.use_backend_only = True
        self.cache = {}
        self.cache_timeout = 0.05  # 50ms缓存

        # 数据变化检测
        self.last_angle = 0.0
        self.last_camera_angle = 0.0
        self.changes_detected = []

        # 扩展数据端点映射 - 方便DIY物理实验
        self.data_endpoints = {
            'pendulum_state': '/get_pendulum_state',
            'camera_angle': '/get_camera_angle',
            'pendulum_length': '/get_pendulum_length',
            'pendulum_angle': '/get_pendulum_angle',
            'angle_history': '/get_angle_history',
            'position_history': '/get_position_history',
            'system_info': '/get_system_info'
        }

        # 统计信息
        self.stats = {
            'start_time': time.time(),
            'request_count': 0,
            'change_count': 0
        }

        # 摄像头显示窗口
        self.show_camera_window = True
        self.window_name = "Camera Real-time View"
        self.camera_display_thread = None
        self.camera_display_running = False

    def http_request(self, url: str, method: str = "GET", data: dict = None, timeout: int = 0.2):
        """超快速HTTP请求"""
        try:
            if method == "GET":
                req = urllib.request.Request(url)
            elif method == "POST":
                data_json = json.dumps(data).encode('utf-8')
                req = urllib.request.Request(url, data=data_json, headers={
                    'Content-Type': 'application/json'
                })
            else:
                return None

            # 极短超时 - 200ms
            response = urllib.request.urlopen(req, timeout=timeout)
            response_data = response.read().decode('utf-8')

            if response_data:
                return json.loads(response_data)
            else:
                return None

        except Exception:
            return None

    def safe_float(self, value, default=0.0):
        """安全转换为float类型"""
        try:
            if value is None:
                return default
            if isinstance(value, str):
                return float(value)
            if isinstance(value, (int, float)):
                return float(value)
            return default
        except (ValueError, TypeError):
            return default

    def check_backend_status(self) -> bool:
        """检查后端服务状态"""
        try:
            response = self.http_request(f"{self.base_url}/get_pendulum_state", timeout=1)
            if response and isinstance(response, dict):
                self.backend_available = True
                return True
            else:
                self.backend_available = False
                return False
        except Exception:
            self.backend_available = False
            return False

    def get_data_from_endpoint(self, endpoint_name: str, timeout: float = 0.1) -> Optional[Dict]:
        """从指定端点获取数据 - 便于扩展的通用方法"""
        if endpoint_name not in self.data_endpoints:
            return None

        endpoint = self.data_endpoints[endpoint_name]
        return self.http_request(f"{self.base_url}{endpoint}", timeout=timeout)

    def get_pendulum_state(self) -> Optional[Dict]:
        """获取单摆状态数据"""
        return self.get_data_from_endpoint('pendulum_state')

    def get_camera_angle(self) -> Optional[Dict]:
        """获取摄像头角度数据"""
        return self.get_data_from_endpoint('camera_angle')

    def get_pendulum_length(self) -> Optional[Dict]:
        """获取摆长数据"""
        return self.get_data_from_endpoint('pendulum_length')

    def get_pendulum_angle(self) -> Optional[Dict]:
        """获取单摆角度数据"""
        return self.get_data_from_endpoint('pendulum_angle')

    def get_angle_history(self) -> Optional[Dict]:
        """获取角度历史数据"""
        return self.get_data_from_endpoint('angle_history')

    def get_position_history(self) -> Optional[Dict]:
        """获取位置历史数据"""
        return self.get_data_from_endpoint('position_history')

    def get_system_info(self) -> Optional[Dict]:
        """获取系统信息"""
        return self.get_data_from_endpoint('system_info')

    def get_all_data(self) -> Dict[str, Any]:
        """获取所有数据"""
        all_data = {}

        # 获取所有端点数据
        for endpoint_name in self.data_endpoints.keys():
            try:
                result = self.get_data_from_endpoint(endpoint_name, timeout=0.1)
                if result:
                    all_data[endpoint_name] = result
            except Exception:
                pass

        return all_data

    def init_camera(self, camera_index: int = 0) -> bool:
        """初始化摄像头 - 为DIY实验预留接口"""
        try:
            self.camera_cap = cv2.VideoCapture(camera_index)
            if self.camera_cap.isOpened():
                self.camera_available = True
                self.camera_running = True
                return True
            else:
                return False
        except Exception:
            return False

    def start_camera_display(self):
        """启动摄像头画面显示"""
        if self.show_camera_window and not self.camera_display_running:
            self.camera_display_running = True
            self.camera_display_thread = threading.Thread(target=self.camera_display_worker, daemon=True)
            self.camera_display_thread.start()

    def camera_display_worker(self):
        """摄像头画面显示工作线程 - 从后端视频流获取"""
        try:
            print("启动摄像头画面显示...")
            print("从后端视频流获取画面，避免摄像头冲突...")

            # 创建窗口，保持宽高比
            cv2.namedWindow(self.window_name, cv2.WINDOW_NORMAL)
            # 设置窗口大小，保持4:3比例
            cv2.resizeWindow(self.window_name, 800, 600)

            # 从后端视频流获取画面
            video_url = f"{self.base_url}/video_feed"
            cap = cv2.VideoCapture(video_url)

            # 设置视频流的参数以优化读取
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            cap.set(cv2.CAP_PROP_FPS, 30)

            if not cap.isOpened():
                print("无法连接到后端视频流，尝试直接打开摄像头...")
                # 如果后端视频流不可用，尝试直接打开摄像头
                cap = cv2.VideoCapture(0)
                if not cap.isOpened():
                    print("无法打开任何视频源")
                    cv2.destroyWindow(self.window_name)
                    return

            frame_count = 0
            last_info_update = 0

            while self.camera_display_running and self.show_camera_window:
                ret, frame = cap.read()
                if ret and frame is not None and frame.size > 0:
                    current_time = time.time()
                    elapsed = current_time - self.stats['start_time']

                    # 每10帧更新一次信息，避免频繁文字渲染影响性能
                    if frame_count % 10 == 0:
                        last_info_update = current_time

                    # 修复画面拉伸和编码问题
                    try:
                        # 确保画面是有效的
                        if frame is not None and frame.size > 0:
                            # 获取原始画面尺寸
                            height, width = frame.shape[:2]

                            # 保持原始BGR格式，OpenCV的imshow函数期望BGR格式
                            # 不要进行颜色转换，这会导致颜色异常
                            display_frame = frame.copy()

                            # 计算保持宽高比的缩放尺寸
                            target_width = 800
                            target_height = 600
                            aspect_ratio = width / height

                            if aspect_ratio > target_width / target_height:
                                # 以宽度为准
                                new_width = target_width
                                new_height = int(target_width / aspect_ratio)
                            else:
                                # 以高度为准
                                new_height = target_height
                                new_width = int(target_height * aspect_ratio)

                            # 高质量缩放
                            display_frame = cv2.resize(display_frame, (new_width, new_height), interpolation=cv2.INTER_AREA)

                            # 在800x600的画布上居中显示
                            canvas = np.zeros((target_height, target_width, 3), dtype=np.uint8)
                            y_offset = (target_height - new_height) // 2
                            x_offset = (target_width - new_width) // 2
                            canvas[y_offset:y_offset+new_height, x_offset:x_offset+new_width] = display_frame

                            cv2.imshow(self.window_name, canvas)
                    except Exception as e:
                        # 如果处理出错，直接显示原始画面
                        print(f"画面处理错误: {e}")
                        if frame is not None:
                            cv2.imshow(self.window_name, frame)

                    frame_count += 1

                else:
                    # 如果视频流断开，尝试重新连接
                    print("视频流断开，尝试重新连接...")
                    cap.release()
                    time.sleep(0.5)

                    # 尝试重新连接视频流
                    cap = cv2.VideoCapture(video_url)
                    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    cap.set(cv2.CAP_PROP_FPS, 30)

                    if not cap.isOpened():
                        print("无法重新连接到后端视频流，尝试直接摄像头...")
                        # 如果后端视频流仍然不可用，尝试直接打开摄像头
                        cap = cv2.VideoCapture(0)
                        if not cap.isOpened():
                            print("无法重新连接任何视频源，退出显示")
                            break

                # 检查按键
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q') or key == ord('Q'):
                    break
                elif key == 27:  # ESC键
                    break
                elif key == ord('s') or key == ord('S'):  # S键切换数据源
                    print("切换数据源...")
                    cap.release()
                    if "video_feed" in video_url:
                        video_url = "0"  # 切换到直接摄像头
                    else:
                        video_url = f"{self.base_url}/video_feed"  # 切换到后端视频流
                    cap = cv2.VideoCapture(video_url)
                    frame_count = 0

            cap.release()
            cv2.destroyWindow(self.window_name)
            print("摄像头画面显示已关闭")

        except Exception as e:
            print(f"摄像头显示错误: {e}")
            cv2.destroyAllWindows()

    def toggle_camera_display(self):
        """切换摄像头画面显示"""
        self.show_camera_window = not self.show_camera_window
        if self.show_camera_window:
            self.start_camera_display()
        else:
            self.camera_display_running = False

    def detect_changes(self, data: Dict[str, Any]) -> bool:
        """检测数据变化"""
        current_angle = self.safe_float(
            data.get('state', {}).get('angle'),
            data.get('pendulum_angle', 0.0)
        )

        current_camera_angle = self.safe_float(
            data.get('camera_angle', {}).get('camera_angle', 0.0)
        )

        changes = False

        # 检测角度变化
        if abs(current_angle - self.last_angle) > 0.01:
            self.changes_detected.append({
                'type': 'angle',
                'old': self.last_angle,
                'new': current_angle,
                'time': time.time()
            })
            self.last_angle = current_angle
            changes = True

        # 检测摄像头角度变化
        if abs(current_camera_angle - self.last_camera_angle) > 0.01:
            self.changes_detected.append({
                'type': 'camera_angle',
                'old': self.last_camera_angle,
                'new': current_camera_angle,
                'time': time.time()
            })
            self.last_camera_angle = current_camera_angle
            changes = True

        return changes

    def data_monitor(self):
        """超高速数据监控 - 立即响应"""
        print("启动超高速监控...")

        while self.use_backend_only and self.backend_available:
            try:
                start_time = time.time()

                # 并行获取所有关键数据
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                    future1 = executor.submit(self.get_pendulum_state)
                    future2 = executor.submit(self.get_camera_angle)
                    future3 = executor.submit(self.get_pendulum_length)

                    state_data = future1.result()
                    camera_data = future2.result()
                    length_data = future3.result()

                # 检测变化
                current_angle = self.safe_float(state_data.get('angle'), 0.0) if state_data else 0.0
                current_camera_angle = self.safe_float(camera_data.get('camera_angle', 0.0), 0.0) if camera_data else 0.0
                current_length = self.safe_float(length_data.get('length', 100.0)) if length_data else 100.0
                current_period = self.safe_float(state_data.get('period', 0.0)) if state_data else 0.0

                changes = []
                change_threshold = 0.005  # 更敏感的变化检测

                # 检测角度变化
                if abs(current_angle - self.last_angle) > change_threshold:
                    changes.append(('angle', self.last_angle, current_angle))
                    self.last_angle = current_angle

                # 检测摄像头角度变化
                if abs(current_camera_angle - self.last_camera_angle) > change_threshold:
                    changes.append(('camera_angle', self.last_camera_angle, current_camera_angle))
                    self.last_camera_angle = current_camera_angle

                # 检测摆长变化
                if abs(current_length - self.data.length) > change_threshold:
                    changes.append(('length', self.data.length, current_length))
                    self.data.length = current_length

                # 如果有变化，立即更新和显示完整数据
                if changes:
                    self.data.update(
                        angle=current_angle,
                        camera_angle=current_camera_angle,
                        length=current_length,
                        period=current_period,
                        timestamp=time.time()
                    )

                    # 立即显示完整的变化数据
                    current_time = time.time()
                    # 转换为从程序开始运行的时间（秒）
                    elapsed_time = current_time - self.stats['start_time']

                    # 显示摄像头角度的实际变化
                    for change_type, old_val, new_val in changes:
                        if change_type == 'angle':
                            print(f"angle: {old_val:+6.2f}° → {new_val:+6.2f}° | 时间: {elapsed_time:.3f}s | 摆长: {current_length:.2f}cm | 周期: {current_period:.3f}s")
                        elif change_type == 'camera_angle':
                            print(f"camera_angle: {old_val:+6.2f}° → {new_val:+6.2f}° | 时间: {elapsed_time:.3f}s | 摆长: {current_length:.2f}cm | 周期: {current_period:.3f}s")
                        elif change_type == 'length':
                            print(f"摆长变化: {old_val:.2f}cm → {new_val:.2f}cm | 时间: {elapsed_time:.3f}s | camera_angle: {current_camera_angle:+6.2f}° | 周期: {current_period:.3f}s")

                # 5ms监控间隔
                processing_time = time.time() - start_time
                wait_time = max(0.005, 0.01 - processing_time)
                time.sleep(wait_time)

            except Exception:
                time.sleep(0.01)

    def get_current_data(self) -> Dict[str, Any]:
        """获取当前所有数据 - 包含真实更新时间"""
        # 获取数据
        data = self.get_all_data()

        # 提取数据
        state_data = data.get('state', {})

        return {
            "angle": self.last_angle,
            "length": self.safe_float(
                data.get('pendulum_length', {}).get('length', 100.0)
            ),
            "period": self.safe_float(state_data.get('period', 0.0)),
            "time": time.time(),
            "ball_x": self.safe_float(state_data.get('ball_x', 0)),
            "ball_y": self.safe_float(state_data.get('ball_y', 0)),
            "pivot_x": self.safe_float(state_data.get('pivot_x', 0)),
            "pivot_y": self.safe_float(state_data.get('pivot_y', 0)),
            "camera_angle": self.last_camera_angle,
            "timestamp": time.time(),
            "angle_history": data.get('angle_history', {}).get('history', []),
            "position_history": data.get('angle_history', {}).get('history', []),
            "pendulum_state": state_data,
            "pendulum_length": self.safe_float(
                data.get('pendulum_length', {}).get('length', 100.0)
            ),
            "pendulum_angle": self.safe_float(
                data.get('pendulum_angle', 0.0)
            ),
            "camera_angle_current": self.last_camera_angle,
            "angle_history_raw": data.get('angle_history', {}).get('history', []),
            "position_history_raw": data.get('angle_history', {}).get('history', []),
            "camera_available": self.camera_available,
            "backend_available": self.backend_available,
            "data_source": "backend" if self.backend_available else "camera",
            "last_update_time": self.data.last_realtime_update,  # 使用真实的更新时间
            "monitor_interval": "50-100ms",  # 监控间隔
            "cache_timeout": f"{self.cache_timeout*1000:.0f}ms"  # 缓存超时
        }

    def close(self):
        """关闭接口，释放资源"""
        # 关闭摄像头显示
        self.camera_display_running = False
        self.show_camera_window = False
        if self.camera_display_thread:
            self.camera_display_thread.join(timeout=1)

        # 关闭其他资源
        self.camera_running = False
        if self.camera_thread:
            self.camera_thread.join(timeout=1)
        if self.camera_cap:
            self.camera_cap.release()

        # 关闭所有OpenCV窗口
        cv2.destroyAllWindows()
        print("接口已关闭")


def realtime_start(host: str = "localhost", port: int = 5000, show_camera: bool = True) -> RealtimePendulumInterface:
    """超高速启动单摆接口"""
    print("超高速单摆接口启动...")

    interface = RealtimePendulumInterface(host=host, port=port)
    interface.show_camera_window = show_camera

    # 检查后端状态
    if interface.check_backend_status():
        print("后端服务可用，启动超高速监控")
        interface.use_backend_only = True

        # 启动超高速数据监控线程
        monitor_thread = threading.Thread(target=interface.data_monitor, daemon=True)
        monitor_thread.start()

        # 启动摄像头显示
        if show_camera:
            interface.start_camera_display()
    else:
        print("后端不可用")

    return interface


if __name__ == "__main__":
    print("=== 超高速单摆接口测试 ===\n")
    print("特色功能:")
    print("1. 实时角度、时间、摆长、周期数据输出")
    print("2. 可扩展的端点接口，支持DIY物理实验")
    print("3. 5ms超高速监控，变化时立即显示")
    print("4. 完整的数据获取方法封装")
    print("5. 摄像头实时画面显示")
    print("\nDIY实验指南:")
    print("- 使用pendulum.get_pendulum_state()获取单摆状态")
    print("- 使用pendulum.get_camera_angle()获取摄像头角度")
    print("- 使用pendulum.get_pendulum_length()获取摆长")
    print("- 使用pendulum.get_data_from_endpoint('端点名')获取自定义数据")
    print("\n")
    print("摄像头窗口控制:")
    print("- Press Q or ESC to close camera window")
    print("- Press S to switch video source (Backend/Direct Camera)")
    print("- Program uses backend video stream to avoid camera conflicts\n")

    # 询问是否显示摄像头
    show_camera = input("是否显示摄像头画面? (y/n, 默认y): ").lower().strip()
    if show_camera != 'n':
        show_camera = True
        print("将显示摄像头画面...")
    else:
        show_camera = False
        print("不显示摄像头画面...")

    # 使用超高速启动
    pendulum = realtime_start(host="localhost", port=5000, show_camera=show_camera)

    try:
        print("\nStarting high-speed data acquisition test...")
        print("Monitoring interval: 5ms, displaying changes immediately")
        if show_camera:
            print("Camera window started - real-time view available")
        print("\nPress Enter to start test, Ctrl+C to exit...")
        input()

        # 测试30秒
        start_time = time.time()
        count = 0

        try:
            while time.time() - start_time < 30:
                time.sleep(1)  # 每1秒输出一次状态
                count += 1
                data = pendulum.get_current_data()
                print(f"[{count:2d}s] 状态: 角度{data['angle']:+6.2f}° | 摄像头{data['camera_angle']:+6.2f}° | 摆长{data['length']:6.2f}cm | 周期{data['period']:6.3f}s")

        except KeyboardInterrupt:
            pass

        total_time = time.time() - start_time
        print(f"\nTest completed, total time: {total_time:.2f}s")

        # 显示DIY实验指南
        print("\n=== DIY Physics Experiment Interface Guide ===")
        print("Available data endpoints:")
        for endpoint, url in pendulum.data_endpoints.items():
            print(f"  {endpoint}: {url}")
        print("\nUsage:")
        print("  data = pendulum.get_pendulum_state()      # Get pendulum state")
        print("  data = pendulum.get_camera_angle()        # Get camera angle")
        print("  data = pendulum.get_pendulum_length()     # Get pendulum length")
        print("  data = pendulum.get_data_from_endpoint('custom_endpoint')  # Custom interface")

    finally:
        pendulum.close()
        print("\nHigh-speed test completed!")