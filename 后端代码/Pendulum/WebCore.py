from typing import Optional, Dict, Any
from queue import Queue
import threading
import time

import cv2
import numpy as np
from flask import Flask, Response, request, jsonify
from flask_cors import CORS
from loguru import logger

from .Logger import Logger
from .Exporter import Exporter, PendulumState


class WebInterface:
    """Web接口类，负责处理网页端的请求和响应"""

    def __init__(self, host: str = "0.0.0.0", port: int = 5000) -> None:
        """
        初始化Web接口

        Args:
            host (str, optional): 主机地址. 默认 "0.0.0.0".
            port (int, optional): 端口号. 默认 5000.
        """
        self.app: Flask = Flask(__name__)
        CORS(self.app)
        self.host: str = host
        self.port: int = port
        # 尝试初始化摄像头，从多个索引中选择可用的
        self.cap: cv2.VideoCapture = None
        camera_indices = [0, 1, 2]  # 尝试多个摄像头索引

        for idx in camera_indices:
            try:
                logger.info(f"尝试初始化摄像头索引 {idx}")
                cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
                if cap.isOpened():
                    # 测试读取一帧
                    ret, frame = cap.read()
                    if ret and frame is not None:
                        self.cap = cap
                        logger.info(f"摄像头初始化成功，使用索引 {idx}")
                        break
                    else:
                        cap.release()
                else:
                    cap.release()
            except Exception as e:
                logger.error(f"摄像头索引 {idx} 初始化失败: {e}")

        if self.cap is None:
            logger.warning("所有摄像头索引都失败，创建虚拟摄像头")
            self.cap = cv2.VideoCapture()  # 创建空的VideoCapture对象
        else:
            # 设置摄像头参数，降低FPS以减少CPU占用
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            self.cap.set(cv2.CAP_PROP_FPS, 20)  # 降低摄像头FPS到20，减少CPU占用

        self.last_drawn_frame: Optional[np.ndarray] = None
        self.last_drawn_lock: threading.Lock = threading.Lock()
        self.key_queue: Queue[str] = Queue()
        self.exdata_queue: Queue[Dict[str, Any]] = Queue()
        self.mouse_queue: Queue[Dict[str, Any]] = Queue()
        self.roi_queue: Queue[Dict[str, int]] = Queue()
        self.paused_flag: threading.Event = threading.Event()

        self._register_routes()

    def _register_routes(self) -> None:
        """注册Flask路由"""

        @self.app.route("/video_feed")
        def video_feed() -> Response:
            """视频流接口"""
            return Response(
                self._gen_frames(),
                mimetype="multipart/x-mixed-replace; boundary=frame",
            )

        @self.app.route("/pendulum_key", methods=["POST"])
        def pendulum_key() -> tuple[str, int]:
            """接收按键事件"""
            data = request.get_json(force=True) or {}
            key: Optional[str] = data.get("key")
            exdata: Dict[str, Any] = {}
            try:
                exdata["m"] = data.get("m")
            except Exception:
                pass
            try:
                exdata["n"] = data.get("n")
            except Exception:
                pass
            try:
                exdata["angle"] = data.get("angle")
            except Exception:
                pass
            if key:
                self.key_queue.put(key)
                self.exdata_queue.put(exdata)
            return "", 204

        @self.app.route("/pendulum_mouse", methods=["POST"])
        def pendulum_mouse() -> tuple[str, int]:
            """接收鼠标事件"""
            data = request.get_json(force=True) or {}
            self.mouse_queue.put(data)
            return "", 204

        @self.app.route("/pendulum_roi", methods=["POST"])
        def pendulum_roi() -> Any:
            """接收ROI事件"""
            data = request.get_json(force=True) or {}
            try:
                if not data or not all(k in data for k in ("x", "y", "w", "h")):
                    return jsonify({"success": False, "error": "ROI数据格式错误"})

                x, y, w, h = data["x"], data["y"], data["w"], data["h"]

                if w < 5 or h < 5:
                    return jsonify(
                        {"success": False, "error": "ROI区域太小，建议至少5x5像素"}
                    )

                if x < 0 or y < 0 or w <= 0 or h <= 0:
                    return jsonify({"success": False, "error": "ROI坐标无效"})

                self.roi_queue.put(data)
                logger.info(f"网页ROI数据已接收: x={x}, y={y}, w={w}, h={h}")
                return jsonify({"success": True, "message": "ROI数据已接收"})

            except Exception as e:
                logger.error(f"ROI处理错误: {str(e)}")
                return jsonify({"success": False, "error": f"ROI处理失败: {str(e)}"})

        @self.app.route("/pendulum_pause", methods=["POST"])
        def pendulum_pause() -> tuple[str, int]:
            """暂停视频流"""
            self.paused_flag.set()
            return "", 204

        @self.app.route("/pendulum_resume", methods=["POST"])
        def pendulum_resume() -> tuple[str, int]:
            """恢复视频流"""
            self.paused_flag.clear()
            return "", 204

        @self.app.route("/get_log")
        def get_log() -> Any:
            """获取日志"""
            return jsonify({"log": Logger.getLogs()})

        @self.app.route("/get_pendulum_state")
        def get_pendulum_state() -> Any:
            """获取单摆当前状态"""
            return jsonify(PendulumState.getState())

        @self.app.route("/get_camera_resolution")
        def get_camera_resolution() -> Any:
            """获取摄像头分辨率"""
            width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            return jsonify({"width": width, "height": height})

        @self.app.route("/pendulum_data")
        def pendulum_data() -> Any:
            """获取单摆数据"""
            return jsonify(PendulumState.getState())

        @self.app.route("/get_angle_history")
        def get_angle_history() -> Any:
            """获取角度历史记录"""
            try:
                exporter = Exporter
            except Exception:
                exporter = None

            if exporter is not None:
                data = exporter.angle_history[-200:]
                result = [{"time": t, "angle": a} for t, a in data]
            else:
                result = []
            return jsonify({"history": result})

        @self.app.route("/get_position_history")
        def get_position_history() -> Any:
            """获取位置历史记录"""
            try:
                exporter = Exporter
            except Exception:
                exporter = None

            if exporter is not None:
                data = exporter.position_history[-200:]
                result = [{"time": t, "x": pos[0], "y": pos[1]} for t, pos in data]
            else:
                result = []
            return jsonify({"history": result})

        @self.app.route("/get_serial_log")
        def get_serial_log() -> Any:
            """获取串口日志"""
            try:
                exporter = Exporter
            except Exception:
                exporter = None

            if exporter is not None:
                data = list(exporter.serial_raw_history)[-200:]
            else:
                data = []
            return jsonify({"log": data})

        @self.app.route("/get_pendulum_length")
        def get_pendulum_length() -> Any:
            """获取单摆摆长数据"""
            try:
                state = PendulumState.getState()
                # 获取physical_length字段（串口数据更新的是physical_length）
                length_value = state.get("physical_length", 100.0)
                
                # 数据验证：如果大于100，返回默认值
                if length_value > 100:
                    logger.warning(f"⚠️ API返回异常摆长数据: {length_value:.6f} cm，使用默认值")
                    length_value = 100.0
                
                return jsonify({"length": length_value})
            except Exception as e:
                logger.error(f"获取摆长数据失败: {e}")
                return jsonify({"error": str(e)}), 500

        @self.app.route("/get_pendulum_angle")
        def get_pendulum_angle() -> Any:
            """获取单摆角度数据"""
            try:
                state = PendulumState.getState()
                return jsonify({"angle": state.get("angle", 0.0)})
            except Exception as e:
                logger.error(f"获取角度数据失败: {e}")
                return jsonify({"error": str(e)}), 500

        @self.app.route("/adjust_hsv", methods=["POST"])
        def adjust_hsv() -> Any:
            """调整HSV阈值"""
            data = request.get_json(force=True) or {}
            try:
                if data.get("lower") and data.get("upper"):
                    PendulumState.setHsv(
                        np.array(data["lower"]), np.array(data["upper"])
                    )
                    logger.info(
                        f"HSV阈值已调整: {PendulumState.hsv_lower} - {PendulumState.hsv_upper}"
                    )
                return jsonify(
                    {
                        "success": True,
                        "lower": PendulumState.hsv_lower.tolist(),
                        "upper": PendulumState.hsv_upper.tolist(),
                    }
                )
            except Exception as e:
                return jsonify({"success": False, "error": str(e)})

        @self.app.route("/get_hsv")
        def get_hsv() -> Any:
            """获取当前HSV阈值"""
            try:
                return jsonify(
                    {
                        "lower": PendulumState.hsv_lower.tolist(),
                        "upper": PendulumState.hsv_upper.tolist(),
                    }
                )
            except Exception as e:
                return jsonify({"error": str(e)})

        @self.app.route("/hsv_calibration", methods=["POST"])
        def hsv_calibration() -> Any:
            """HSV校准接口"""
            data = request.get_json(force=True) or {}
            try:
                roi_data = data.get("roi")
                if not roi_data:
                    return jsonify({"success": False, "message": "缺少ROI数据"})

                # 获取当前摄像头帧
                if not self.cap or not self.cap.isOpened():
                    return jsonify({"success": False, "message": "摄像头未就绪"})

                ret, frame = self.cap.read()
                if not ret or frame is None:
                    return jsonify({"success": False, "message": "无法获取摄像头画面"})

                # 获取原始图像尺寸
                original_height, original_width = frame.shape[:2]
                print(f"🔍 原始图像尺寸: {original_width}x{original_height}")
                logger.info(f"原始图像尺寸: {original_width}x{original_height}")
                
                # 旋转画面以匹配PendulumAPP的处理
                frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
                
                # 转换为HSV
                hsv_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

                # 提取ROI坐标 - 前端发送的是 {x, y, w, h} 格式
                x = int(roi_data.get("x", 0))
                y = int(roi_data.get("y", 0))
                w = int(roi_data.get("w", 0))
                h = int(roi_data.get("h", 0))

                # 由于图像旋转了90度，需要调整ROI坐标
                # 旋转前: (x, y) -> 旋转后: (y, original_width - x - w)
                rotated_x = y
                rotated_y = original_width - x - w
                
                # 边界检查，确保ROI在图像范围内
                rotated_x = max(0, min(rotated_x, original_height - h))
                rotated_y = max(0, min(rotated_y, original_width - w))

                roi = (rotated_x, rotated_y, h, w)  # 注意：宽高也要交换
                print(f"🎯 收到HSV校准请求，原始ROI数据: {roi_data}")
                print(f"🔄 旋转前ROI坐标: ({x}, {y}, {w}, {h})")
                print(f"🔄 旋转后ROI坐标: {roi}")
                print(f"📏 旋转后图像尺寸: {frame.shape[1]}x{frame.shape[0]}")
                logger.info(f"收到HSV校准请求，原始ROI数据: {roi_data}")
                logger.info(f"旋转前ROI坐标: ({x}, {y}, {w}, {h})")
                logger.info(f"旋转后ROI坐标: {roi}")
                logger.info(f"旋转后图像尺寸: {frame.shape[1]}x{frame.shape[0]}")

                # 使用Detector_HSV进行校准
                from .PendulumCore import Detector_HSV
                detector = Detector_HSV()
                detector.calibrate(hsv_frame, roi)

                return jsonify({
                    "success": True,
                    "message": "HSV校准成功",
                    "lower": PendulumState.hsv_lower.tolist(),
                    "upper": PendulumState.hsv_upper.tolist()
                })

            except Exception as e:
                logger.error(f"HSV校准失败: {str(e)}")
                return jsonify({"success": False, "message": f"HSV校准失败: {str(e)}"})

        @self.app.route("/get_camera_angle")
        def get_camera_angle() -> Any:
            """获取摄像头识别角度"""
            try:
                state = PendulumState.getState()
                return jsonify({"camera_angle": state.get("camera_angle", 0.0)})
            except Exception as e:
                logger.error(f"获取摄像头角度失败: {e}")
                return jsonify({"error": str(e)}), 500

        @self.app.route("/get_chart_config", methods=["GET"])
        def get_chart_config() -> Any:
            """获取可视化分析图片配置
            返回: {"use_static_charts": 1或0}
            1: 使用静态图片（可视化分析文件夹中的图片）
            0: 使用实验数据动态生成的图片
            """
            try:
                # 从__main__模块导入配置
                import sys
                if '__main__' in sys.modules:
                    main_module = sys.modules['__main__']
                    use_static_charts = getattr(main_module, 'USE_STATIC_CHARTS', 1)
                else:
                    # 如果无法获取，默认使用静态图片
                    use_static_charts = 1
                return jsonify({"use_static_charts": use_static_charts})
            except Exception as e:
                logger.error(f"获取图表配置失败: {e}")
                return jsonify({"use_static_charts": 1}), 500

    def _gen_frames(self) -> Any:
        """生成视频帧流"""
        target_fps = 20  # 降低目标FPS到20，减少CPU占用和网络负载
        frame_interval = 1.0 / target_fps  # 每帧间隔时间
        last_frame_time = time.time()
        
        while True:
            # 检查是否暂停
            if self.paused_flag.is_set():
                time.sleep(0.1)  # 暂停时减少CPU使用
                continue
                
            current_time = time.time()
            
            # 控制帧率，确保不超过目标FPS
            if current_time - last_frame_time >= frame_interval:
                # 优先使用共享的帧数据
                with self.last_drawn_lock:
                    frame = (
                        self.last_drawn_frame.copy()
                        if self.last_drawn_frame is not None
                        else None
                    )
                
                # 如果没有共享帧数据，直接从摄像头读取
                if frame is None:
                    ret, frame = self.cap.read()
                    if not ret:
                        # 如果摄像头读取失败，生成一个黑色帧
                        frame = np.zeros((720, 1280, 3), dtype=np.uint8)
                        cv2.putText(frame, "Camera Not Available", (50, 360), 
                                  cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
                    else:
                        # 旋转画面以匹配PendulumAPP的处理
                        frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
                
                if frame is not None:
                    ret, buffer = cv2.imencode(".jpg", frame)
                    frame_bytes = buffer.tobytes()
                    yield (
                        b"--frame\r\n"
                        b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
                    )
                    last_frame_time = current_time
                else:
                    time.sleep(0.001)  # 减少睡眠时间，提高响应速度
            else:
                # 如果还没到下一帧时间，短暂等待
                time.sleep(0.001)

    def updateFrame(self, frame) -> None:
        """
        更新最新的视频帧

        Args:
            frame (np.ndarray): 视频帧
        """
        with self.last_drawn_lock:
            self.last_drawn_frame = frame.copy()

    def run(self) -> None:
        """启动Flask Web服务"""

        from werkzeug.serving import WSGIRequestHandler

        class SilentRequestHandler(WSGIRequestHandler):
            def log_request(self, code: str = "-", size: str = "-") -> None:
                # 静默日志，仅输出非 GET 或非特定路径的请求日志
                if self.command == "GET":
                    # 静默 /video_feed 和 /pendulum_data 的 GET 请求日志
                    # if self.path in ("/video_feed", "/pendulum_data"):
                    return
                super().log_request(code, size)

        self.app.run(
            host=self.host,
            port=self.port,
            debug=False,
            use_reloader=False,
            threaded=True,
            request_handler=SilentRequestHandler,
        )

    def run_in_thread(self) -> threading.Thread:
        """
        在线程中启动Web服务

        Returns:
            threading.Thread: 启动的线程对象
        """
        thread = threading.Thread(target=self.run, daemon=True)
        thread.start()
        return thread


web_interface = WebInterface()

web_thread = web_interface.run_in_thread()
