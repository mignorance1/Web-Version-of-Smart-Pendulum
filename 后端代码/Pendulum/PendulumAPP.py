from typing import Optional, Tuple, Dict, Any
from .PendulumCore import Analyzer, Detector_HSV
from .Exporter import Exporter, PendulumState
from .SerialConncet import Serial_Daemon
from .HelpUI import HelpUI
from .WebCore import web_interface
from .WebSocketServer import update_frame  # 导入WebSocketServer模块

import cv2
import time
import math
from loguru import logger
from queue import Empty
import numpy as np


class App_Pendulum:
    """单摆应用主类，负责协调各个组件的工作"""

    def __init__(self, camera_source: int = 0) -> None:
        """
        初始化单摆应用

        Args:
            camera_source (int): 摄像头索引，默认0
        """
        self.detector: Detector_HSV = Detector_HSV()
        self.analyzer: Analyzer = Analyzer()
        self.exporter: Exporter = Exporter()
        self.serial: Serial_Daemon = Serial_Daemon()

        self.cap = cv2.VideoCapture(camera_source)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        self.cap.set(cv2.CAP_PROP_FPS, 20)  # 降低FPS到20，减少CPU占用

        self._run_status: bool = False
        self.window_name: str = "Pendulum Detection"
        self.font = cv2.FONT_HERSHEY_SIMPLEX

        self._frame_count: int = 0
        self._last_time: float = time.time()
        self.fps: float = 0.0

        self.physicalLength: float = 20.0  # 物理摆长（cm），初始值20cm
        self.detector.physicalLength = self.physicalLength

        self.ball_center: Optional[Tuple[int, int]] = None
        self.hsv_frame: Optional[np.ndarray] = None
        self.frame: Optional[np.ndarray] = None
        
        # 用于记录上一次的串口长度值，避免重复日志
        self._last_serial_length: Optional[float] = None

    def setPhysicalLength(self, length_cm: float) -> None:
        """设置物理摆长

        Args:
            length_cm (float): 摆长，单位厘米
        """
        self.physicalLength = length_cm
        self.detector.setPhysicalLength(self.physicalLength)

    def run(self) -> None:
        """启动单摆识别主循环"""
        self._run_status = True
        # cv2.namedWindow(self.window_name)
        # cv2.setMouseCallback(self.window_name, self.analyzer.updateMouse)
        self.serial.threadStart()
        while self._run_status:
            self.detector.setPhysicalLength(self.physicalLength)

            # 处理串口数据
            self._processSerialData()

            if web_interface.paused_flag.is_set():
                cv2.waitKey(10)
                self._checkWebMouse()
                self._checkWebRoi(None)
                self._checkWebKey()
                continue

            ret, framex = self.cap.read()
            frame = cv2.rotate(framex, cv2.ROTATE_90_CLOCKWISE)
            if not ret:
                break

            self._updateFps(frame)
            self._drawn(frame)
            # cv2.imshow(self.window_name, frame)

            self._checkWebMouse()
            self._checkWebRoi(frame)
            self._checkWebKey()
            self._keyEvent(frame)

        self._release()

    def _processSerialData(self) -> None:
        """处理串口数据，特别是解析L开头的长度数据"""
        try:
            # 获取最新的串口原始数据
            if hasattr(self.exporter, 'serial_raw_history') and self.exporter.serial_raw_history:
                # 获取最新的串口数据
                latest_data = self.exporter.serial_raw_history[-1] if self.exporter.serial_raw_history else None
                
                if latest_data and isinstance(latest_data, str):
                    # 检查是否是L开头的长度数据
                    if latest_data.startswith('L'):
                        try:
                            # 提取数字部分
                            length_str = latest_data[1:]  # 去掉'L'前缀
                            length_value = float(length_str)
                            
                            # 数据验证：丢弃大于100的异常数据
                            if length_value > 100:
                                logger.warning(f"⚠️ 丢弃异常摆长数据: {length_value:.6f} cm (大于100)")
                                return
                            
                            # 只在值发生变化时记录日志，避免频繁的重复日志
                            length_changed = (self._last_serial_length is None or 
                                            abs(length_value - self._last_serial_length) > 0.001)  # 0.001cm的精度阈值
                            
                            # 更新PendulumState中的physical_length字段（串口数据是物理长度）
                            PendulumState.update(physical_length=length_value)
                            
                            # 只在值发生变化时记录日志，减少日志量
                            if length_changed:
                                logger.info(f"📏 串口长度数据已更新: L{length_value:.6f} -> physical_length={length_value:.6f}")
                                logger.debug(f"🔄 数据来源: 串口接收 -> PendulumState.physical_length")
                                self._last_serial_length = length_value
                            
                            # 不再同时更新length字段，避免与周期数据混淆
                            # PendulumState.update(length=length_value)
                            
                        except ValueError as e:
                            logger.warning(f"⚠️ 无法解析长度数据: {latest_data}, 错误: {e}")
                        except Exception as e:
                            logger.error(f"❌ 处理串口长度数据时出错: {e}")
                    else:
                        # 记录其他类型的串口数据（可选）
                        # logger.debug(f"📡 其他串口数据: {latest_data}")
                        pass
                            
        except Exception as e:
            logger.error(f"❌ 处理串口数据时出错: {e}")

    def _checkWebMouse(self) -> None:
        """处理网页端鼠标事件"""
        while True:
            try:
                event: Dict[str, Any] = web_interface.mouse_queue.get_nowait()
                if event["type"] == "left":
                    self.analyzer.updateMouse(
                        cv2.EVENT_LBUTTONDOWN, event["x"], event["y"], None, None
                    )
                elif event["type"] == "right":
                    self.analyzer.updateMouse(
                        cv2.EVENT_RBUTTONDOWN, event["x"], event["y"], None, None
                    )
            except Empty:
                break

    def _checkWebRoi(self, frame) -> None:
        """处理网页端ROI事件

        Args:
            frame (cv2.typing.MatLike): 当前帧图像
        """
        while True:
            try:
                roi: Dict[str, int] = web_interface.roi_queue.get_nowait()
                if not roi or not all(key in roi for key in ["x", "y", "w", "h"]):
                    logger.warning("ROI数据格式错误，跳过处理")
                    continue

                x, y, w, h = roi["x"], roi["y"], roi["w"], roi["h"]

                if self.hsv_frame is None:
                    logger.info("HSV图像未就绪，跳过ROI处理")
                    continue

                hsv_height, hsv_width = self.hsv_frame.shape[:2]
                if x < 0 or y < 0 or x + w > hsv_width or y + h > hsv_height:
                    logger.warning(
                        f"ROI区域超出图像范围: roi=({x},{y},{w},{h}), 图像=({hsv_width}x{hsv_height})"
                    )
                    continue

                if w < 5 or h < 5:
                    logger.warning(f"ROI区域太小: {w}x{h}，建议至少5x5像素")
                    continue

                try:
                    self.detector.calibrate(self.hsv_frame, [x, y, w, h])
                    logger.info(f"网页ROI HSV校准成功: x={x}, y={y}, w={w}, h={h}")
                    logger.info(
                        f"新的HSV阈值: 下限={PendulumState.hsv_lower.tolist()}, 上限={PendulumState.hsv_upper.tolist()}"
                    )
                except Exception as e:
                    logger.error(f"HSV校准失败: {str(e)}")

            except Empty:
                break

    def _checkWebKey(self) -> None:
        """处理网页端按键事件"""
        while True:
            try:
                key: str = web_interface.key_queue.get_nowait()
                try:
                    exdata: dict = web_interface.exdata_queue.get_nowait()
                except Empty:
                    exdata = dict()
                self._keyEventWeb(key, exdata)
            except Empty:
                break

    def _keyEventWeb(self, key: str, exdata: dict) -> None:
        """网页端按键事件处理

        Args:
            key (str): 按键字符
            exdata (dict): 附加数据字典
        """
        key = key.lower()
        if key == "q":
            self._run_status = False
        elif key == "p":
            self.exporter.debug()
        elif key == "c":
            logger.info("请用鼠标拖动画面进行ROI选取")
        elif key == "z":
            self.analyzer.setReferenceAngle(self.ball_center)
            # 检查REFERENCE_ANGLE是否为None，避免TypeError
            if self.analyzer.REFERENCE_ANGLE is not None:
                PendulumState.update(reference_angle=float(self.analyzer.REFERENCE_ANGLE))
                logger.info(f"参考角度设为: {self.analyzer.REFERENCE_ANGLE:.2f} deg")
            else:
                logger.warning("无法设置参考角度：REFERENCE_ANGLE为None")
            # 发送z信号到单片机（用于设置角度零点）
            self.serial.send("z")
            logger.info("z信号已发送到单片机")
        elif key == "d":
            self.analyzer.cleanRef()
            logger.info("已删除摆轴固定点和参考角度")
        elif key == "l":
            self.serial.changeStatus()
        elif key == "x":
            self.exporter.exportToJson()
            logger.info("已导出数据到exported.json")
        elif key == "w":
            logger.info("↑")
            self.serial.send("m2")
        elif key == "s":
            logger.info("↓")
            self.serial.send("m1")
        elif key == "a":
            logger.info("stop")
            self.serial.send("m0")
        elif key == "r":
            logger.info("清除数据")
            self.serial.send("r")
            self.exporter.cleanHistory()
            self.exporter.setZero()
        elif key == "0":
            logger.info("清除数据")
            self.serial.send("r")
            self.exporter.cleanHistory()
            self.exporter.setZero()
        elif key == "1" and exdata.get("n"):
            logger.info(f"count{exdata['n']:d}")
            self.serial.send(f"c{exdata['n']:d}")
        elif key == "2" and exdata.get("m"):
            logger.info(f"length{exdata['m']:.2f}")
            self.serial.send(f"l{exdata['m']:.2f}")
        elif key == "3":
            logger.info("u2")
            self.serial.send("u2")
        elif key == "4":
            logger.info("u1")
            self.serial.send("u1")
        elif key == "5":
            logger.info("u0")
            self.serial.send("u0")
        elif key == "6":
            logger.info("n2")
            self.serial.send("n2")
        elif key == "7":
            logger.info("n1")
            self.serial.send("n1")
        elif key == "8":
            logger.info("n0")
            self.serial.send("n0")
        elif key == "d0":
            logger.info("d0")
            self.serial.send("d0")
        elif key == "d1":
            logger.info("d1")
            self.serial.send("d1")
        elif key == "a" and exdata.get("angle"):
            logger.info(f"angle{exdata['angle']:.2f}")
            # 更新PendulumState中的角度数据
            PendulumState.update(angle=float(exdata['angle']))
            # 发送角度数据到单片机（如果需要的话）
            # self.serial.send(f"a{exdata['angle']:.2f}")
        else:
            logger.info(f"未处理的网页快捷键: {key}")

    def _release(self) -> None:
        """释放摄像头和窗口资源"""
        self._run_status = False
        self.cap.release()
        cv2.destroyAllWindows()
        HelpUI.stop()

    def _keyEvent(self, frame) -> None:
        """处理本地键盘事件

        Args:
            frame (cv2.typing.MatLike): 当前帧图像
        """
        key = cv2.waitKey(1) & 0xFF
        if key in {27, ord("q"), ord("Q")}:
            self._release()
        elif key in {ord("p"), ord("P")}:
            self.exporter.debug()
        # elif key in {ord("c"), ord("C")}:
        #     roi = cv2.selectROI(self.window_name, frame, showCrosshair=True)
        #     cv2.setMouseCallback(self.window_name, self.analyzer.updateMouse)
        #     if roi[2] > 0 and roi[3] > 0:
        #         self.detector.calibrate(self.hsv_frame, roi)
        elif key in {ord("z"), ord("Z")}:
            self.analyzer.setReferenceAngle(self.ball_center)
            # 检查REFERENCE_ANGLE是否为None，避免TypeError
            if self.analyzer.REFERENCE_ANGLE is not None:
                logger.info(f"参考角度设为: {self.analyzer.REFERENCE_ANGLE:.2f} deg")
            else:
                logger.warning("无法设置参考角度：REFERENCE_ANGLE为None")
        elif key in {ord("d"), ord("D")}:
            self.analyzer.cleanRef()
            logger.info("已删除摆轴固定点和参考角度")
        elif key in {ord("l"), ord("L")}:
            self.serial.changeStatus()
        elif key in {ord("x"), ord("X")}:
            self.exporter.exportToJson()
            logger.info("已导出数据到exported.json")
        elif key == ord("0"):
            logger.info("清除数据")
            self.serial.send("r")
            self.exporter.cleanHistory()
            self.exporter.setZero()

    def _updateFps(self, frame) -> None:
        """更新帧率显示"""
        self._frame_count += 1
        if self._frame_count >= 60:
            # self.serial.send("x")
            now = time.time()
            self.fps = self._frame_count / (now - self._last_time)
            self._last_time = now
            self._frame_count = 0
        cv2.putText(
            frame, f"FPS: {self.fps:.1f}", (10, 20), self.font, 0.5, (255, 255, 0), 1
        )

    def _drawn(self, frame) -> None:
        """绘制检测和分析结果到当前帧上

        Args:
            frame (cv2.typing.MatLike): 当前帧图像
        """
        mask_frame, self.hsv_frame = self.detector.getHsvMask(frame)
        self.ball_center, contour = self.detector.getBallCenter(mask_frame)

        # 显示HSV阈值范围
        cv2.putText(
            frame,
            f"HSV: {PendulumState.hsv_lower} - {PendulumState.hsv_upper}",
            (10, 80),
            self.font,
            0.5,
            (255, 255, 0),
            1,
        )

        if self.ball_center:
            cv2.putText(
                frame,
                f"Ball: {self.ball_center}",
                (10, 100),
                self.font,
                0.5,
                (0, 255, 0),
                1,
            )
        else:
            cv2.putText(
                frame, "No ball detected", (10, 100), self.font, 0.5, (0, 0, 255), 1
            )

        # 显示HSV掩码小窗口
        if mask_frame is not None:
            mask_display = cv2.cvtColor(mask_frame, cv2.COLOR_GRAY2BGR)
            h, w = frame.shape[:2]
            mask_resized = cv2.resize(mask_display, (w // 4, h // 4))
            frame[10 : 10 + h // 4, w - w // 4 - 10 : w - 10] = mask_resized
            cv2.rectangle(
                frame, (w - w // 4 - 10, 10), (w - 10, 10 + h // 4), (255, 255, 0), 2
            )
            cv2.putText(
                frame,
                "HSV Mask",
                (w - w // 4 - 10, 10 + h // 4 + 20),
                self.font,
                0.4,
                (255, 255, 0),
                1,
            )

        angle_val: Optional[float] = None
        length_val: float = 0.0

        if self.ball_center:
            cv2.circle(frame, self.ball_center, 5, (0, 255, 0), -1)
            cv2.drawContours(frame, [contour], -1, (0, 255, 0), 2)

            angle, line, rel_pos = self.analyzer.getAngleAndLine(
                frame, self.ball_center
            )
            ntime = time.time()

            if line:
                x1, y1, x2, y2 = line
                cv2.line(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)

            if angle is not None:
                cv2.putText(
                    frame,
                    f"Angle: {angle:.1f} deg",
                    (10, 50),
                    self.font,
                    0.6,
                    (255, 255, 255),
                    2,
                )
                self.exporter.recordSyncAP(angle, rel_pos, ntime)
                angle_val = angle

            # 计算摆长（像素距离）
            if self.analyzer.PIVOT_POINT and self.ball_center:
                dx = self.ball_center[0] - self.analyzer.PIVOT_POINT[0]
                dy = self.ball_center[1] - self.analyzer.PIVOT_POINT[1]
                length_val = math.hypot(dx, dy)
                
                # 显示手动设置的摆轴（只在画面内时显示）
                height, width = frame.shape[:2]
                if (0 <= self.analyzer.PIVOT_POINT[0] < width and 
                    0 <= self.analyzer.PIVOT_POINT[1] < height):
                    cv2.circle(frame, self.analyzer.PIVOT_POINT, 8, (0, 255, 255), -1)
                    cv2.putText(
                        frame,
                        "Manual Pivot",
                        (self.analyzer.PIVOT_POINT[0] + 10, self.analyzer.PIVOT_POINT[1] - 10),
                        self.font,
                        0.4,
                        (0, 255, 255),
                        1,
                    )
            else:
                # 显示自动检测的摆轴（只在画面内时显示）
                if (self.analyzer.auto_pivot_enabled and 
                    hasattr(self.analyzer, 'auto_detected_pivot')):
                    auto_pivot = self.analyzer.auto_detected_pivot
                    height, width = frame.shape[:2]
                    if (0 <= auto_pivot[0] < width and 0 <= auto_pivot[1] < height):
                        cv2.circle(frame, auto_pivot, 8, (255, 0, 255), -1)
                        cv2.putText(
                            frame,
                            "Auto Pivot",
                            (auto_pivot[0] + 10, auto_pivot[1] - 10),
                            self.font,
                            0.4,
                            (255, 0, 255),
                            1,
                        )

            if length_val > 0:
                # 假设比例因子0.5转换像素距离到厘米，调整此比例可做校准
                physical_length = self.physicalLength
                cv2.putText(
                    frame,
                    f"Length: {length_val:.1f} px ({physical_length:.1f} cm)",
                    (10, 130),
                    self.font,
                    0.5,
                    (255, 255, 0),
                    1,
                )

        # 更新Web接口的帧
        web_interface.updateFrame(frame)
        
        # 将处理后的帧发送到WebSocket服务器
        try:
            # 将当前帧发送到WebSocket服务器进行处理
            update_frame(frame)
        except Exception as e:
            logger.error(f"WebSocket更新帧失败: {str(e)}")

        # 约60FPS更新状态信息，减少性能消耗
        current_time = time.time()
        if (
            not hasattr(self, "_last_state_update")
            or current_time - self._last_state_update > 0.016
        ):
            self._last_state_update = current_time
            # 确定摆轴位置（优先使用手动设置的，否则使用固定的自动检测摆轴）
            pivot_x = 0.0
            pivot_y = 0.0
            if self.analyzer.PIVOT_POINT:
                pivot_x = float(self.analyzer.PIVOT_POINT[0])
                pivot_y = float(self.analyzer.PIVOT_POINT[1])
            elif (self.analyzer.auto_pivot_enabled and 
                  hasattr(self.analyzer, 'auto_detected_pivot')):
                auto_pivot = self.analyzer.auto_detected_pivot
                pivot_x = float(auto_pivot[0])
                pivot_y = float(auto_pivot[1])
            
            PendulumState.update(
                camera_angle=float(angle_val) if angle_val is not None else 0.0,
                # 不更新length字段，避免摄像头数据覆盖串口数据
                # length=float(length_val),
                ball_x=float(self.ball_center[0]) if self.ball_center else 0.0,
                ball_y=float(self.ball_center[1]) if self.ball_center else 0.0,
                pivot_x=pivot_x,
                pivot_y=pivot_y,
                reference_angle=float(self.analyzer.REFERENCE_ANGLE)
                if self.analyzer.REFERENCE_ANGLE is not None
                else 0.0,
                # 不更新physical_length，保持串口数据的优先级
                # physical_length=float(self.physicalLength),
                timestamp=current_time * 1000,  # 毫秒时间戳
            )
