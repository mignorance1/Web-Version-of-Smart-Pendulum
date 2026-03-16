后端代码
__init__.py
from .HelpUI import HelpUI
from .Logger import Logger
from .PendulumAPP import App_Pendulum
from .WebCore import web_interface, web_thread
from .SerialConncet import Serial_PortManager, Serial_Daemon


__all__ = [
    "HelpUI",
    "Logger",
    "App_Pendulum",
    "web_interface",
    "web_thread",
    "Serial_PortManager",
    "Serial_Daemon",
]
Exporter.py
import threading
import time
from collections import deque
import json
from typing import List, Tuple, Any, Optional, Dict
import numpy as np


class Exporter:
    """
    数据导出类.

    Attributes:
        start_time (float): 记录开始时间戳
        angle_history (List[Tuple[float, Any]]): 角度历史记录，(时间, 角度)
        position_history (List[Tuple[float, Any]]): 位置历史记录，(时间, 位置)
        serial_history (List[Tuple[float, Any]]): 串口数据历史，(时间, 数据)
        serial_raw_history (deque): 原始串口数据缓冲区，最大长度1000

    Methods:
        recordAngle(angle, ntime)
        recordPosition(position, ntime)
        recordSyncAP(angle, position, ntime)
        recordSerial(serial, ntime)
        recordSerialRaw(raw)
        debug()
        setZero()
        cleanHistory()
        exportToJson(filename)
    """

    start_time: float = time.time()
    angle_history: List[Tuple[float, Any]] = []
    position_history: List[Tuple[float, Any]] = []
    serial_history: List[Tuple[float, Any]] = []
    serial_raw_history: deque = deque(maxlen=1000)

    @classmethod
    def recordAngle(cls, angle: Any, ntime: float) -> None:
        cls.angle_history.append((ntime, angle))

    @classmethod
    def recordPosition(cls, position: Any, ntime: float) -> None:
        cls.position_history.append((ntime, position))

    @classmethod
    def recordSyncAP(cls, angle: Any, position: Any, ntime: float) -> None:
        cls.angle_history.append((ntime, angle))
        cls.position_history.append((ntime, position))

    @classmethod
    def recordSerial(cls, serial: Any, ntime: float) -> None:
        cls.serial_history.append((ntime, serial))

    @classmethod
    def recordSerialRaw(cls, raw: Any) -> None:
        cls.serial_raw_history.append(raw)

    @classmethod
    def debug(cls) -> None:
        print(f"----Angle----{cls.start_time}")
        for i in range(min(10, len(cls.angle_history))):
            print(f"{cls.angle_history[len(cls.angle_history) - 1 - i]}")
        print("---Position---")
        for i in range(min(10, len(cls.position_history))):
            print(f"{cls.position_history[len(cls.position_history) - 1 - i]}")
        print("----Serial----")
        for i in range(min(10, len(cls.serial_history))):
            print(f"{cls.serial_history[len(cls.serial_history) - 1 - i]}")
        print("--------------")

    @classmethod
    def setZero(cls) -> None:
        cls.start_time = time.time()

    @classmethod
    def cleanHistory(cls) -> None:
        cls.angle_history = []
        cls.position_history = []
        cls.serial_history = []
        cls.serial_raw_history.clear()  # 清空原始串口数据

    @classmethod
    def exportToJson(cls, filename: str = "exported.json") -> None:
        out_data = {
            "start_time": cls.start_time,
            "serial": cls.serial_history,
            "angle": cls.angle_history,
            "position": cls.position_history,
        }
        with open(filename, "w", encoding="utf-8") as jf:
            json.dump(out_data, jf, ensure_ascii=False)


class PendulumState:
    """单摆状态管理类，负责存储和更新单摆的状态"""

    hsv_lower: List[int] = [40, 70, 70]
    hsv_upper: List[int] = [80, 255, 255]

    state: Dict = {
        "angle": 0.0,           # 角度
        "camera_angle": 0.0,    # 摄像头识别角度
        "length": 100.0,
        "ball_x": 0.0,
        "ball_y": 0.0,
        "pivot_x": 0.0,
        "pivot_y": 0.0,
        "reference_angle": 0.0,
        "physical_length": 20.0,  # 初始摆长20cm
        "timestamp": 0.0,
    }

    state_lock = threading.Lock()

    @classmethod
    def setHsv(cls, lower: np.ndarray, upper: np.ndarray) -> None:
        """
        设置HSV颜色阈值，用于颜色识别。

        Args:
            lower (np.ndarray): HSV下限。
            upper (np.ndarray): HSV上限。
        """
        cls.hsv_lower = np.array(lower)
        cls.hsv_upper = np.array(upper)

    @classmethod
    def update(
        cls,
        angle: Optional[float] = None,
        camera_angle: Optional[float] = None,
        length: Optional[float] = None,
        ball_x: Optional[float] = None,
        ball_y: Optional[float] = None,
        pivot_x: Optional[float] = None,
        pivot_y: Optional[float] = None,
        reference_angle: Optional[float] = None,
        physical_length: Optional[float] = None,
        timestamp: Optional[float] = None,
    ) -> None:
        """
        更新单摆状态。
        参数只更新非 None 项。
        """
        with cls.state_lock:
            if angle is not None:
                cls.state["angle"] = float(angle)
            if camera_angle is not None:
                cls.state["camera_angle"] = float(camera_angle)
            if length is not None:
                cls.state["length"] = float(length)
            if ball_x is not None:
                cls.state["ball_x"] = float(ball_x)
            if ball_y is not None:
                cls.state["ball_y"] = float(ball_y)
            if pivot_x is not None:
                cls.state["pivot_x"] = float(pivot_x)
            if pivot_y is not None:
                cls.state["pivot_y"] = float(pivot_y)
            if reference_angle is not None:
                cls.state["reference_angle"] = float(reference_angle)
            if physical_length is not None:
                cls.state["physical_length"] = float(physical_length)
            if timestamp is not None:
                cls.state["timestamp"] = float(timestamp)

    @classmethod
    def getState(cls) -> Dict[str, float]:
        """
        获取当前单摆状态。

        Returns:
            dict: 包含所有状态字段的副本。
        """
        with cls.state_lock:
            return cls.state.copy()
HelpUI.py
import multiprocessing.sharedctypes
from multiprocessing import freeze_support, Process
from ctypes import c_bool
from loguru import logger
import tkinter as tk
from tkinter import Tk, Text
from typing import Optional


freeze_support()


class classproperty(property):
    """允许类属性支持装饰器访问（如 @classmethod + property）"""

    def __get__(self, instance, owner):
        return self.fget(owner)


class HelpUI:
    """
    基于 Tkinter + multiprocessing 的子进程 GUI 提示系统。

    功能：
    - 启动子进程展示提示信息
    - 通过共享变量控制子进程运行状态
    - 支持 run() 启动、stop() 关闭、status 查询状态
    """

    _process: Optional[Process] = None
    _content: str = "默认提示"
    _is_run: multiprocessing.sharedctypes.Synchronized = multiprocessing.Value(
        c_bool, False
    )

    @classmethod
    def _UILoop(
        cls, _is_run: multiprocessing.sharedctypes.Synchronized, content: str
    ) -> None:
        """子进程主循环，创建 Tkinter 窗口并监视共享状态"""
        logger.debug("进入 HelpUI 子进程")
        root: Tk = tk.Tk()
        root.title("OpenCV_UI 快捷键提示")
        root.attributes("-topmost", True)
        root.geometry("320x480")
        root.resizable(False, True)

        text: Text = tk.Text(root, font=("Consolas", 12), bg="white", fg="black")
        text.insert(tk.END, content)
        text.config(state=tk.DISABLED)
        text.pack(expand=True, fill="both")

        def _checkFlag():
            if _is_run.value:
                root.after(100, _checkFlag)
            else:
                logger.info("HelpUI 子进程手动结束")
                root.destroy()

        root.after(100, _checkFlag)
        root.mainloop()

    @classmethod
    def run(cls, content: str = _content) -> None:
        """启动 HelpUI 子进程并展示提示内容"""
        if cls._process is None or not cls._process.is_alive():
            cls._is_run.value = True
            cls._content = content
            cls._process = Process(
                target=cls._UILoop,
                name="Process-HelpUI",
                args=(cls._is_run, cls._content),
            )
            cls._process.start()
        else:
            print("HelpUI 窗口已在运行")

    @classmethod
    def stop(cls) -> None:
        """停止 HelpUI 子进程"""
        if cls._is_run.value:
            cls._is_run.value = False
            if cls._process is not None:
                cls._process.join(timeout=2)
                if cls._process.is_alive():
                    cls._process.terminate()
            cls._process = None

    @classproperty
    def status(cls) -> bool:
        """返回 HelpUI 子进程运行状态（True 表示运行中）"""
        is_alive = cls._process is not None and cls._process.is_alive()
        cls._is_run.value = is_alive
        logger.info(f"HelpUI 子进程状态: {cls._is_run.value}")
        return bool(cls._is_run.value)

    @classmethod
    def setContent(cls, content: str) -> None:
        """设置 HelpUI 子进程提示文本"""
        cls._content: str = str(content)


if __name__ == "__main__":
    import os

    HelpUI.run()
    os.system("pause")
    print(HelpUI.status)
    os.system("pause")
    HelpUI.stop()
    os.system("pause")
    print(HelpUI.status)
    os.system("pause")
Logger.py
import os
import loguru
from collections import deque
from typing import Type, List

MAX_LOG_LENGTH: int = 500


def autoRegisterLogger(cls: Type) -> Type:
    """
    装饰器：为类自动注册 loguru 日志缓冲区和文件输出。
    """
    global MAX_LOG_LENGTH
    cls.log_buffer: deque = deque(maxlen=MAX_LOG_LENGTH)  # type: ignore
    # 自动注册 loguru sink 输出到文件
    # 增加日志文件大小限制到10MB，保留最多5个历史文件，避免频繁轮转
    loguru.logger.add(
        "my_log.log", 
        enqueue=True, 
        rotation="10 MB",  # 增加到10MB，减少轮转频率
        retention=5,  # 只保留最近5个日志文件（整数表示文件数量）
        compression="zip",  # 压缩旧日志文件，节省空间
        mode="a",  # 改为追加模式，避免覆盖
        encoding="utf-8"
    )
    # 注册一个 sink，写入缓冲区
    loguru.logger.add(
        lambda msg: cls.log_buffer.append(msg), enqueue=True, format="{message}"
    )

    return cls


@autoRegisterLogger
class Logger:
    """日志管理类，负责日志的记录和获取"""

    @classmethod
    def getLogs(cls) -> List[str]:
        """
        获取所有日志，返回日志消息列表。
        """
        return list(cls.log_buffer)


if __name__ == "__main__":
    loguru.logger.info("help")
    loguru.logger.info("help")
    loguru.logger.info("help")
    loguru.logger.info("help")
    os.system("pause")
    print(Logger.getLogs())
    os.system("pause")
PendulumAPP.py
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
            # 发送z信号（用于设置角度零点）
            self.serial.send("z")
            logger.info("z信号已发送")
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
            # 发送角度数据（如果需要的话）
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
PendulumCore.py
from typing import Optional, Tuple
from .Exporter import PendulumState
import math
import cv2
import numpy as np
from loguru import logger


HSV_LOWER = [40, 70, 70]
HSV_UPPER = [80, 255, 255]


class Detector:
    """识别器基类."""

    pass


class Detector_HSV(Detector):
    """识别器类,使用HSV法."""

    """识别器类,使用HSV法."""

    def __init__(self, lower: list = None, upper: list = None):
        if lower is None:
            lower = HSV_LOWER
        if upper is None:
            upper = HSV_UPPER
        _lower = np.array(lower)
        _upper = np.array(upper)
        PendulumState.setHsv(_lower, _upper)
        self.physicalLength: float = 120.0

    def setPhysicalLength(self, Length: float) -> None:
        self.physicalLength = Length

    def calibrate(self, hsv_frame, roi) -> None:
        try:
            x, y, w, h = roi
            hsv_height, hsv_width = hsv_frame.shape[:2]
            
            print(f"🔍 HSV校准调试信息:")
            print(f"  原始ROI: ({x}, {y}, {w}, {h})")
            print(f"  HSV图像尺寸: {hsv_width}x{hsv_height}")
            logger.info(f"🔍 HSV校准调试信息:")
            logger.info(f"  原始ROI: ({x}, {y}, {w}, {h})")
            logger.info(f"  HSV图像尺寸: {hsv_width}x{hsv_height}")
            
            # 边界检查和调整
            original_x, original_y, original_w, original_h = x, y, w, h
            x = max(0, min(x, hsv_width - 1))
            y = max(0, min(y, hsv_height - 1))
            w = max(1, min(w, hsv_width - x))
            h = max(1, min(h, hsv_height - y))
            
            print(f"  边界调整: 原始({original_x}, {original_y}, {original_w}, {original_h}) -> 调整后({x}, {y}, {w}, {h})")
            logger.info(f"  调整后ROI: ({x}, {y}, {w}, {h})")
            
            roi_hsv = hsv_frame[y : y + h, x : x + w]
            logger.info(f"  ROI区域大小: {roi_hsv.shape}")
            
            if roi_hsv.size == 0:
                logger.warning("❌ ROI区域为空，无法进行HSV校准")
                return
                
            mean_hsv = cv2.mean(roi_hsv)[:3]
            std_hsv = np.std(roi_hsv.reshape(-1, 3), axis=0)
            
            print(f"  ROI区域平均HSV: {mean_hsv}")
            print(f"  ROI区域HSV标准差: {std_hsv}")
            logger.info(f"  ROI区域平均HSV: {mean_hsv}")
            logger.info(f"  ROI区域HSV标准差: {std_hsv}")

            h_tol = max(5, std_hsv[0] * 2)
            s_tol = max(30, std_hsv[1] * 2)
            v_tol = max(30, std_hsv[2] * 2)

            tol = np.array([h_tol, s_tol, v_tol])
            logger.info(f"  计算的容差: {tol}")

            new_lower = np.clip(
                np.array(mean_hsv) - tol, [0, 0, 0], [179, 255, 255]
            ).astype(int)
            new_upper = np.clip(
                np.array(mean_hsv) + tol, [0, 0, 0], [179, 255, 255]
            ).astype(int)

            logger.info(f"  初始HSV阈值: 下限={new_lower.tolist()}, 上限={new_upper.tolist()}")

            if np.any(new_upper - new_lower < [5, 10, 10]):
                logger.warning("⚠️ 计算出的HSV阈值范围太小，使用默认容差")
                tol = np.array([10, 50, 50])
                new_lower = np.clip(
                    np.array(mean_hsv) - tol, [0, 0, 0], [179, 255, 255]
                ).astype(int)
                new_upper = np.clip(
                    np.array(mean_hsv) + tol, [0, 0, 0], [179, 255, 255]
                ).astype(int)
                logger.info(f"  使用默认容差后的HSV阈值: 下限={new_lower.tolist()}, 上限={new_upper.tolist()}")

            PendulumState.setHsv(new_lower, new_upper)

            logger.info(f"✅ HSV校准成功: ROI=({x},{y},{w},{h})")
            print(f"  最终HSV阈值: 下限={PendulumState.hsv_lower.tolist()}, 上限={PendulumState.hsv_upper.tolist()}")
            logger.info(f"  最终HSV阈值: 下限={PendulumState.hsv_lower.tolist()}, 上限={PendulumState.hsv_upper.tolist()}")
        except Exception as e:
            logger.error(f"❌ HSV校准失败: {str(e)}")
            PendulumState.setHsv(np.array(HSV_LOWER), np.array(HSV_UPPER))

    def getHsvMask(
        self, frame
    ):
        self.hsv_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        lower = np.array(PendulumState.hsv_lower)
        upper = np.array(PendulumState.hsv_upper)
        self.mask_frame = cv2.inRange(self.hsv_frame, lower, upper)
        return self.mask_frame, self.hsv_frame

    def getBallCenter(
        self, mask_frame = None
    ) -> Tuple[Optional[Tuple[int, int]], Optional[np.ndarray]]:
        if mask_frame is None:
            mask_frame = self.mask_frame
        contours, _ = cv2.findContours(
            mask_frame, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        if contours:
            c = max(contours, key=cv2.contourArea)
            M = cv2.moments(c)
            if M["m00"] != 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
                return (cx, cy), c
        return None, None


class Analyzer:
    def __init__(self, alpha: float = 0.8):
        self.PIVOT_POINT: Optional[Tuple[int, int]] = None
        self.ORIGIN_POINT: Optional[Tuple[int, int]] = None
        self.REFERENCE_ANGLE: Optional[float] = None
        self.REFERENCE_VECTOR: Optional[Tuple[float, float]] = None  # 参考摆线方向向量
        self.alpha = alpha
        self._prev_angle: Optional[float] = None
        # 自动摆轴识别相关参数
        self.auto_pivot_enabled: bool = True
        self.pivot_detection_history: list = []
        self.pivot_confidence_threshold: float = 0.7
        self.max_pivot_distance: int = 300  # 最大摆轴距离

    def updateMouse(self, event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            self.PIVOT_POINT = (x, y)
            self.REFERENCE_ANGLE = None
            self.REFERENCE_VECTOR = None
            logger.info(f"已设置摆轴固定点: {self.PIVOT_POINT},清除参考角度和参考向量")
            PendulumState.update(
                pivot_x=float(x), pivot_y=float(y), reference_angle=0.0
            )
        elif event == cv2.EVENT_RBUTTONDOWN:
            self.ORIGIN_POINT = (x, y)
            logger.info(f"已设置坐标原点: {self.ORIGIN_POINT}")

    def getAngleAndLine(
        self, frame: np.ndarray, ball_center: Tuple[int, int]
    ) -> Optional[Tuple[float, Tuple[int, int, int, int], Tuple[int, int]]]:
        if not ball_center:
            return None, None, None

        angle_rel = None
        line = None

        # 优先使用手动设置的摆轴
        if self.PIVOT_POINT and self.PIVOT_POINT[0] is not None:
            # 使用已知的摆轴点计算角度
            dx = ball_center[0] - self.PIVOT_POINT[0]
            dy = ball_center[1] - self.PIVOT_POINT[1]

            # 如果没有参考角度，设置当前角度为参考
            if self.REFERENCE_ANGLE is None:
                self.REFERENCE_ANGLE = math.degrees(math.atan2(dx, dy))

            # 计算相对角度
            current_angle = math.degrees(math.atan2(dx, dy))
            angle_rel = current_angle - self.REFERENCE_ANGLE

            line = (*self.PIVOT_POINT, *ball_center)
        else:
            # 使用自动检测的摆轴或霍夫变换
            if self.auto_pivot_enabled and hasattr(self, 'auto_detected_pivot'):
                # 使用自动检测的摆轴
                auto_pivot = self.auto_detected_pivot
                dx = ball_center[0] - auto_pivot[0]
                dy = ball_center[1] - auto_pivot[1]

                if self.REFERENCE_ANGLE is None:
                    self.REFERENCE_ANGLE = math.degrees(math.atan2(dx, dy))

                current_angle = math.degrees(math.atan2(dx, dy))
                angle_rel = current_angle - self.REFERENCE_ANGLE
                line = (*auto_pivot, *ball_center)
            else:
                # 使用霍夫变换检测摆线
                edges = cv2.Canny(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), 50, 150)
                angle_raw, line = self._getHoughAngle(edges, ball_center)
                if angle_raw is not None:
                    if self.REFERENCE_ANGLE is None:
                        self.REFERENCE_ANGLE = angle_raw
                    angle_rel = angle_raw - self.REFERENCE_ANGLE
                else:
                    return None, None, None

        if angle_rel is not None:
            # 角度平滑处理
            if self._prev_angle is not None:
                angle_rel = self.alpha * self._prev_angle + (1 - self.alpha) * angle_rel
            self._prev_angle = angle_rel

            # 计算相对原点的位置
            x0 = ball_center[0] - (self.ORIGIN_POINT[0] if self.ORIGIN_POINT else 0)
            y0 = ball_center[1] - (self.ORIGIN_POINT[1] if self.ORIGIN_POINT else 0)

            return angle_rel, line, (x0, y0)

        return None, None, None

    def _calculateAngleBetweenVectors(self, vec1: Tuple[float, float], vec2: Tuple[float, float]) -> float:
        """计算两个向量之间的夹角（以度为单位）
        
        Args:
            vec1: 第一个向量 (dx1, dy1)
            vec2: 第二个向量 (dx2, dy2)
            
        Returns:
            夹角（度），正值表示逆时针旋转，负值表示顺时针旋转
        """
        # 计算向量的点积
        dot_product = vec1[0] * vec2[0] + vec1[1] * vec2[1]
        
        # 计算向量的模长
        mag1 = math.sqrt(vec1[0] * vec1[0] + vec1[1] * vec1[1])
        mag2 = math.sqrt(vec2[0] * vec2[0] + vec2[1] * vec2[1])
        
        # 避免除零错误
        if mag1 == 0 or mag2 == 0:
            return 0.0
        
        # 计算夹角的余弦值
        cos_angle = dot_product / (mag1 * mag2)
        
        # 限制余弦值在[-1, 1]范围内，避免数值误差
        cos_angle = max(-1.0, min(1.0, cos_angle))
        
        # 计算夹角（弧度）
        angle_rad = math.acos(cos_angle)
        
        # 计算叉积的符号来确定旋转方向
        cross_product = vec1[0] * vec2[1] - vec1[1] * vec2[0]
        
        # 转换为度，并根据叉积符号确定方向
        angle_deg = math.degrees(angle_rad)
        if cross_product < 0:
            angle_deg = -angle_deg
            
        return angle_deg

    def _getHoughAngle(
        self, edges: np.ndarray, ball_center: Tuple[int, int]
    ) -> Tuple[Optional[float], Optional[Tuple[int, int, int, int]]]:
        x, y = ball_center
        search_h = 200
        region = edges[max(0, y - search_h) : y, max(0, x - 50) : x + 50]
        if region.size == 0:
            return None, None
        lines = cv2.HoughLinesP(
            region, 1, np.pi / 180, threshold=30, minLineLength=30, maxLineGap=10
        )
        best_line = None
        best_dist = float("inf")
        best_angle = None
        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]
                # 映射到全图坐标
                gx1, gy1 = x1 + x - 50, y1 + y - search_h
                gx2, gy2 = x2 + x - 50, y2 + y - search_h
                # 取距离球心最近的线段
                dist = min(np.hypot(gx1 - x, gy1 - y), np.hypot(gx2 - x, gy2 - y))
                if dist < best_dist:
                    best_dist = dist
                    best_line = (gx1, gy1, gx2, gy2)
                    dx = gx2 - gx1
                    dy = gy2 - gy1
                    # 注意这里使用dx, dy计算相对竖直的角度
                    best_angle = math.degrees(math.atan2(dx, dy))
        return best_angle, best_line

    def autoDetectPivot(self, frame: np.ndarray, ball_center: Tuple[int, int]) -> Optional[Tuple[int, int]]:
        """自动检测摆轴位置
        
        Args:
            frame: 输入图像
            ball_center: 小球中心位置
            
        Returns:
            检测到的摆轴位置，如果检测失败返回None
        """
        if not ball_center:
            return None
            
        x, y = ball_center
        height, width = frame.shape[:2]
        
        # 转换为灰度图
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # 边缘检测
        edges = cv2.Canny(gray, 50, 150)
        
        # 在小球上方区域检测直线
        search_height = min(400, y)  # 搜索高度
        search_width = min(200, width // 2)  # 搜索宽度
        
        # 定义搜索区域（小球上方）
        y_start = max(0, y - search_height)
        y_end = y
        x_start = max(0, x - search_width)
        x_end = min(width, x + search_width)
        
        search_region = edges[y_start:y_end, x_start:x_end]
        
        if search_region.size == 0:
            return None
            
        # 霍夫变换检测直线
        lines = cv2.HoughLinesP(
            search_region, 
            rho=1, 
            theta=np.pi/180, 
            threshold=20, 
            minLineLength=50, 
            maxLineGap=20
        )
        
        if lines is None:
            return None
            
        # 分析检测到的直线，寻找最可能的摆轴
        best_pivot = None
        best_score = 0
        
        for line in lines:
            x1, y1, x2, y2 = line[0]
            
            # 转换到全局坐标
            gx1, gy1 = x1 + x_start, y1 + y_start
            gx2, gy2 = x2 + x_start, y2 + y_start
            
            # 计算直线参数
            if gx2 - gx1 == 0:  # 垂直线
                continue
                
            # 计算直线斜率
            slope = (gy2 - gy1) / (gx2 - gx1)
            
            # 计算直线与小球的距离
            # 使用点到直线的距离公式
            A = slope
            B = -1
            C = gy1 - slope * gx1
            
            distance = abs(A * x + B * y + C) / math.sqrt(A * A + B * B)
            
            # 计算摆轴候选位置（直线延长线与图像上边界的交点）
            pivot_y = 0
            if abs(slope) < 0.1:  # 接近水平线
                pivot_x = x
            else:
                pivot_x = gx1 + (pivot_y - gy1) / slope
                
            # 检查摆轴是否在合理范围内
            if pivot_x < 0 or pivot_x >= width:
                continue
                
            # 计算评分（距离越小，角度越垂直，评分越高）
            angle_score = abs(slope)  # 越垂直越好
            distance_score = max(0, 1 - distance / 50)  # 距离越近越好
            length_score = min(1, math.hypot(gx2 - gx1, gy2 - gy1) / 100)  # 长度越长越好
            
            total_score = angle_score * 0.4 + distance_score * 0.4 + length_score * 0.2
            
            if total_score > best_score:
                best_score = total_score
                best_pivot = (int(pivot_x), int(pivot_y))
        
        # 如果找到合适的摆轴，且还没有设置过自动摆轴，则设置一次
        if best_pivot and best_score > self.pivot_confidence_threshold and not hasattr(self, 'auto_detected_pivot'):
            # 使用历史记录的平均位置作为最终摆轴
            self.pivot_detection_history.append({
                'pivot': best_pivot,
                'score': best_score,
                'ball_center': ball_center
            })
            
            # 保持历史记录在合理范围内
            if len(self.pivot_detection_history) > 10:
                self.pivot_detection_history.pop(0)
                
            # 使用历史记录的平均位置作为最终摆轴
            if len(self.pivot_detection_history) >= 3:
                avg_x = sum(item['pivot'][0] for item in self.pivot_detection_history) / len(self.pivot_detection_history)
                avg_y = sum(item['pivot'][1] for item in self.pivot_detection_history) / len(self.pivot_detection_history)
                final_pivot = (int(avg_x), int(avg_y))
                
                # 设置自动检测的摆轴（只设置一次）
                self.auto_detected_pivot = final_pivot
                logger.info(f"自动检测并设置摆轴: {final_pivot}, 置信度: {best_score:.3f}")
                return final_pivot
                
        return None

    def setReferenceAngle(self, ball_center: Tuple[int, int]) -> None:
        if not ball_center:
            return
            
        # 确定摆轴位置（优先使用手动设置的，否则使用自动检测的）
        pivot_point = None
        if self.PIVOT_POINT:
            pivot_point = self.PIVOT_POINT
        elif hasattr(self, 'auto_detected_pivot'):
            pivot_point = self.auto_detected_pivot
            
        if not pivot_point:
            logger.warning("没有可用的摆轴，无法设置参考角度")
            return
            
        # 计算参考摆线方向向量
        dx = ball_center[0] - pivot_point[0]
        dy = ball_center[1] - pivot_point[1]
        self.REFERENCE_VECTOR = (dx, dy)
        
        # 计算参考角度（相对于垂直向下的角度）
        self.REFERENCE_ANGLE = math.degrees(math.atan2(dx, dy))
        
        logger.info(f"参考摆线向量设为: {self.REFERENCE_VECTOR} (摆轴: {pivot_point})")
        logger.info(f"参考角度设为: {self.REFERENCE_ANGLE:.2f}°")

    def setReferenceAngleFromKey(self, frame: np.ndarray, ball_center: Tuple[int, int]) -> None:
        """按z键设置参考角度（零点）

        Args:
            frame: 输入图像
            ball_center: 小球中心位置
        """
        if not ball_center:
            logger.warning("没有小球位置，无法设置参考角度")
            return

        # 优先使用手动设置的摆轴
        if self.PIVOT_POINT and self.PIVOT_POINT[0] is not None:
            dx = ball_center[0] - self.PIVOT_POINT[0]
            dy = ball_center[1] - self.PIVOT_POINT[1]
            self.REFERENCE_ANGLE = math.degrees(math.atan2(dx, dy))
            logger.info(f"参考角度设为: {self.REFERENCE_ANGLE:.2f}° (摆轴: {self.PIVOT_POINT})")
        # 如果没有摆轴，尝试使用霍夫变换
        else:
            edges = cv2.Canny(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), 50, 150)
            angle_raw, line = self._getHoughAngle(edges, ball_center)
            if angle_raw is not None:
                self.REFERENCE_ANGLE = angle_raw
                logger.info(f"参考角度设为: {self.REFERENCE_ANGLE:.2f}° (霍夫检测)")
            else:
                logger.warning("无法检测摆线，无法设置参考角度")

    def cleanRef(self) -> None:
        self.PIVOT_POINT = None
        self.ORIGIN_POINT = None
        self.REFERENCE_ANGLE = None
        self.REFERENCE_VECTOR = None
        self._prev_angle = None
        # 清除自动检测的摆轴
        if hasattr(self, 'auto_detected_pivot'):
            delattr(self, 'auto_detected_pivot')
        self.pivot_detection_history.clear()
        logger.info("已删除摆轴固定点、参考角度、参考向量和自动检测摆轴")

    def refPrint(self) -> None:
        logger.info(self.PIVOT_POINT)
        logger.info(self.ORIGIN_POINT)
        logger.info(self.REFERENCE_ANGLE)

    def enableAutoPivotDetection(self, enabled: bool = True) -> None:
        """启用或禁用自动摆轴检测
        
        Args:
            enabled: 是否启用自动摆轴检测
        """
        self.auto_pivot_enabled = enabled
        if enabled:
            logger.info("自动摆轴检测已启用")
        else:
            logger.info("自动摆轴检测已禁用")

    def clearPivotHistory(self) -> None:
        """清除摆轴检测历史记录"""
        self.pivot_detection_history.clear()
        logger.info("摆轴检测历史记录已清除")
SerialConncet.py
import serial
import serial.tools.list_ports
import threading
import time
from loguru import logger
from serial.tools.list_ports_common import ListPortInfo


class classproperty(property):
    def __get__(self, instance, owner):
        return self.fget(owner)


class Serial_PortManager:
    """串口管理类，负责列出和选择串口"""

    _selected_port: str = "COM3"
    _ports: list[ListPortInfo] = []

    @classmethod
    def listPorts(cls) -> list[dict]:
        """
        列出所有可用串口

        Returns:
            list: 串口信息列表
        """
        cls._ports = serial.tools.list_ports.comports()
        port_info = []
        for port in cls._ports:
            info = {
                "device": port.device,
                "description": port.description,
                "hwid": port.hwid,
            }
            port_info.append(info)
            logger.info(f"设备名称: {port.device}")
            logger.info(f"描述信息: {port.description}")
            logger.info(f"硬件ID:   {port.hwid}")
            logger.info("-" * 30)
        return port_info

    @classmethod
    def selectFirstPort(cls) -> str:
        """
        选择第一个可用串口

        Returns:
            str: 串口名称
        """
        logger.info(f"默认串口为: {cls._selected_port}")
        if cls._ports:
            cls._selected_port = cls._ports[0].device
            logger.info(f"自动设置串口为: {cls._selected_port}")
        else:
            logger.warning(f"串口设置未发生改变: {cls._selected_port}")
        return cls._selected_port

    @classproperty
    def defaultPort(cls) -> str:
        """当前默认串口"""
        return cls._selected_port

    @classmethod
    def selectPortFromStdin(cls) -> str:
        """手动输入串口"""
        logger.info("手动输入端口:")
        stdin_port: str = input()
        if stdin_port:
            cls._selected_port: str = stdin_port
            logger.info(f"设置串口为: {cls._selected_port}")
        else:
            logger.warning(f"串口设置未发生改变: {cls._selected_port}")
        return cls._selected_port

    @classmethod
    def selectPortFromPara(cls,inputs) -> str:
        """手动输入串口"""
        logger.info("手动输入端口:")
        stdin_port: str = inputs
        if stdin_port:
            cls._selected_port: str = stdin_port
            logger.info(f"设置串口为: {cls._selected_port}")
        else:
            logger.warning(f"串口设置未发生改变: {cls._selected_port}")
        return cls._selected_port








class Serial_Daemon:
    """串口通信守护进程，负责串口数据的收发"""

    def __init__(
        self, port: str = None, baudrate: int = 115200, reconnect_interval: float = 2
    ):
        """
        初始化串口守护进程

        Args:
            port (str): 串口号
            baudrate (int): 波特率，默认 115200
            reconnect_interval (float): 重连时间间隔（秒）
        """
        self.port: str = port if port else Serial_PortManager.defaultPort
        self.baudrate: int = baudrate
        self.reconnect_interval: float = reconnect_interval
        self.serial: serial.Serial | None = None
        self._stop_event = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)

    def threadStart(self) -> None:
        """启动串口守护线程"""
        self._stop_event.clear()
        if not self._thread.is_alive():
            self._thread.start()

    def threadStatus(self) -> bool:
        """返回串口守护线程是否运行中"""
        return self._thread.is_alive()

    def threadStop(self) -> None:
        """停止串口守护线程"""
        self._stop_event.set()
        if self.serial and self.serial.is_open:
            self.serial.close()
            logger.info("[串口] 已断开连接")

    def serialStatus(self) -> bool:
        """返回串口是否已连接"""
        return self.serial.is_open if self.serial else False

    def _run(self) -> None:
        """线程运行体，持续尝试接收串口数据"""
        while not self._stop_event.is_set():
            if not self.serial or not self.serial.is_open:
                try:
                    logger.info(f"[串口] 尝试连接 {self.port}...")
                    self.serial = serial.Serial(self.port, self.baudrate, timeout=1)
                    logger.info(f"[串口] 连接成功: {self.port}@{self.baudrate}")
                except serial.SerialException as e:
                    logger.error(f"[失败] 连接失败：{e}")
                    time.sleep(self.reconnect_interval)
                    continue

            try:
                line = (
                    self.serial.readline()
                    .decode("ascii", errors="ignore")
                    .replace("\x00", "")
                    .strip()
                )
                if line:
                    logger.info(f"[接收] {line}")
                    # 可接入外部处理模块
                    try:
                        from .Exporter import Exporter
                        Exporter.recordSerialRaw(line)
                    except ImportError:
                        pass  # 如果Exporter不可用，忽略错误
            except serial.SerialException as e:
                logger.error(f"[失败] 异常断开：{e}")
                self.serial.close()
                logger.warning("[串口] 等待重连中...")
                time.sleep(self.reconnect_interval)
            except Exception as e:
                logger.error("[串口] 其他错误: {}", e)

    def send(self, message: str) -> None:
        """发送数据到串口

        Args:
            message (str): 发送的字符串
        """
        try:
            if self.serial and self.serial.is_open:
                logger.info(f"send{message}")
                self.serial.write((message + "\n").encode("utf-8"))
                logger.info(f"[发送] {message}")
        except Exception as e:
            logger.error(f"[发送错误] {e}")

    def changeStatus(self) -> None:
        """切换串口连接状态（启停）"""
        if self._thread.is_alive():
            print("终止串口")
            self.threadStop()
        else:
            print("启动串口")
            self.threadStart()

WebCore.py
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
WebSocketServer.py
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WebSocketServer.py
提供WebSocket服务，实时推送摄像头数据和单摆状态
"""

import asyncio
import json
import logging
import time
import threading
from typing import Dict, List, Set, Any, Optional
import numpy as np
import cv2
import traceback

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("WebSocketServer")

# 尝试导入websockets，如果失败则自动安装
try:
    import websockets
except ImportError:
    import subprocess
    import sys
    logger.info("正在安装websockets库...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets"])
    import websockets
    logger.info("websockets库安装成功")

# 导入项目中的其他模块
from .Exporter import PendulumState
from .Logger import Logger

# 保存所有连接的WebSocket客户端
CLIENTS: Set[websockets.WebSocketServerProtocol] = set()

# 历史数据缓存
angle_history: List[Dict[str, float]] = []
position_history: List[Dict[str, float]] = []
MAX_HISTORY_SIZE = 200  # 限制历史数据大小

# 图像处理参数
hsv_lower = np.array([40, 70, 70])  # 默认HSV下限
hsv_upper = np.array([80, 255, 255])  # 默认HSV上限

# 服务器状态标志
server_running = False
server_error = None

async def register(websocket: websockets.WebSocketServerProtocol):
    """注册新的WebSocket客户端"""
    CLIENTS.add(websocket)
    logger.info(f"新客户端连接，当前连接数: {len(CLIENTS)}")


async def unregister(websocket: websockets.WebSocketServerProtocol):
    """注销WebSocket客户端"""
    CLIENTS.remove(websocket)
    logger.info(f"客户端断开连接，当前连接数: {len(CLIENTS)}")


async def process_message(websocket: websockets.WebSocketServerProtocol, message: str):
    """处理从客户端接收的消息"""
    try:
        data = json.loads(message)
        cmd = data.get("command", "")
        
        if cmd == "get_state":
            # 获取当前摆状态
            await send_pendulum_state(websocket)
        elif cmd == "get_angle_history":
            # 获取角度历史数据
            await send_angle_history(websocket)
        elif cmd == "get_position_history":
            # 获取位置历史数据
            await send_position_history(websocket)
        elif cmd == "get_log":
            # 获取日志
            await send_logs(websocket)
        elif cmd == "get_serial_log":
            # 获取串口日志
            await send_serial_logs(websocket)
        elif cmd == "set_hsv":
            # 设置HSV阈值
            if "lower" in data and "upper" in data:
                global hsv_lower, hsv_upper
                hsv_lower = np.array(data["lower"])
                hsv_upper = np.array(data["upper"])
                PendulumState.setHsv(hsv_lower, hsv_upper)
                await websocket.send(json.dumps({"status": "ok", "message": "HSV阈值已更新"}))
        elif cmd == "pendulum_key":
            # 处理按键命令
            key = data.get("key", "")
            extra = data.get("extra", {})
            # 这里可以调用原有的按键处理函数
            logger.info(f"收到按键命令: {key}, 附加数据: {extra}")
            # 假设有一个函数处理按键
            # handle_key_command(key, extra)
            await websocket.send(json.dumps({"status": "ok", "message": f"按键命令 {key} 已处理"}))
        else:
            await websocket.send(json.dumps({"status": "error", "message": f"未知命令: {cmd}"}))
    except json.JSONDecodeError:
        await websocket.send(json.dumps({"status": "error", "message": "无效的JSON格式"}))
    except Exception as e:
        logger.error(f"处理消息时出错: {str(e)}")
        logger.error(traceback.format_exc())
        await websocket.send(json.dumps({"status": "error", "message": f"处理消息时出错: {str(e)}"}))


async def send_logs(websocket: Optional[websockets.WebSocketServerProtocol] = None):
    """发送日志"""
    message = json.dumps({
        "type": "logs",
        "data": {
            "log": Logger.getLogs()
        }
    })
    
    if websocket:
        # 发送给特定客户端
        await websocket.send(message)
    else:
        # 广播给所有客户端
        if CLIENTS:  # 确保有连接的客户端
            await asyncio.gather(*(client.send(message) for client in CLIENTS))


async def send_serial_logs(websocket: Optional[websockets.WebSocketServerProtocol] = None):
    """发送串口日志"""
    try:
        from .Exporter import Exporter
        data = list(Exporter.serial_raw_history)[-200:]
    except Exception:
        data = []
        
    message = json.dumps({
        "type": "serial_logs",
        "data": {
            "log": data
        }
    })
    
    if websocket:
        # 发送给特定客户端
        await websocket.send(message)
    else:
        # 广播给所有客户端
        if CLIENTS:  # 确保有连接的客户端
            await asyncio.gather(*(client.send(message) for client in CLIENTS))


async def send_pendulum_state(websocket: Optional[websockets.WebSocketServerProtocol] = None):
    """发送当前摆状态"""
    state = PendulumState.getState()
    state["timestamp"] = time.time() * 1000  # 添加时间戳，毫秒
    
    message = json.dumps({
        "type": "pendulum_state",
        "data": state
    })
    
    if websocket:
        # 发送给特定客户端
        await websocket.send(message)
    else:
        # 广播给所有客户端
        if CLIENTS:  # 确保有连接的客户端
            await asyncio.gather(*(client.send(message) for client in CLIENTS))


async def send_angle_history(websocket: Optional[websockets.WebSocketServerProtocol] = None):
    """发送角度历史数据"""
    message = json.dumps({
        "type": "angle_history",
        "data": {
            "history": angle_history
        }
    })
    
    if websocket:
        # 发送给特定客户端
        await websocket.send(message)
    else:
        # 广播给所有客户端
        if CLIENTS:  # 确保有连接的客户端
            await asyncio.gather(*(client.send(message) for client in CLIENTS))


async def send_position_history(websocket: Optional[websockets.WebSocketServerProtocol] = None):
    """发送位置历史数据"""
    message = json.dumps({
        "type": "position_history",
        "data": {
            "history": position_history
        }
    })
    
    if websocket:
        # 发送给特定客户端
        await websocket.send(message)
    else:
        # 广播给所有客户端
        if CLIENTS:  # 确保有连接的客户端
            await asyncio.gather(*(client.send(message) for client in CLIENTS))


async def websocket_handler(websocket: websockets.WebSocketServerProtocol):
    """处理WebSocket连接"""
    try:
        await register(websocket)
        try:
            # 连接建立后，立即发送当前状态
            await send_pendulum_state(websocket)
            await send_angle_history(websocket)
            await send_position_history(websocket)
            
            # 循环处理消息
            async for message in websocket:
                await process_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            logger.info("客户端连接已关闭")
        finally:
            await unregister(websocket)
    except Exception as e:
        logger.error(f"WebSocket处理错误: {str(e)}")
        logger.error(traceback.format_exc())


def update_pendulum_data(frame: np.ndarray) -> Dict[str, Any]:
    """
    处理摄像头帧，提取单摆数据
    这个函数实现与原来的图像处理逻辑相同
    """
    # 转换为HSV颜色空间
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    
    # 根据HSV阈值创建掩码
    mask = cv2.inRange(hsv, hsv_lower, hsv_upper)
    
    # 查找轮廓
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # 初始化结果
    result = {
        "angle": 0.0,
        "length": PendulumState.state["length"],
        "ball_x": 0,
        "ball_y": 0,
        "pivot_x": PendulumState.state["pivot_x"],
        "pivot_y": PendulumState.state["pivot_y"],
        "timestamp": time.time()
    }
    
    # 如果找到轮廓
    if contours:
        # 找到最大的轮廓（假设是小球）
        c = max(contours, key=cv2.contourArea)
        
        # 计算轮廓的矩
        M = cv2.moments(c)
        
        # 避免除以零
        if M["m00"] != 0:
            # 计算轮廓中心
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            
            # 更新小球位置
            result["ball_x"] = cx
            result["ball_y"] = cy
            
            # 计算摆长和角度
            pivot_x = result["pivot_x"]
            pivot_y = result["pivot_y"]
            
            # 计算像素距离（仅用于调试，不更新到length字段）
            pixel_length = np.sqrt((cx - pivot_x) ** 2 + (cy - pivot_y) ** 2)
            # 不更新result["length"]，避免像素数据覆盖串口数据
            # result["length"] = pixel_length
            
            # 计算角度（相对于垂直向下的角度）
            # 修改角度计算：参考零点左边为负，右边为正
            angle = np.arctan2(cx - pivot_x, cy - pivot_y) * 180 / np.pi
            # 确保角度在正确的范围内：左边为负，右边为正
            if angle > 180:
                angle = angle - 360
            elif angle < -180:
                angle = angle + 360
            result["angle"] = angle
    
    return result


async def broadcast_loop():
    """定期广播数据给所有客户端"""
    while True:
        try:
            if CLIENTS:  # 只有在有客户端连接时才广播
                try:
                    await send_pendulum_state()
                    await asyncio.sleep(0.05)  # 20Hz更新率
                    
                    # 每秒发送一次历史数据
                    if int(time.time()) % 1 == 0:
                        await send_angle_history()
                        await send_position_history()
                except Exception as e:
                    logger.error(f"广播数据时出错: {str(e)}")
                    logger.error(traceback.format_exc())
            
            await asyncio.sleep(0.02)  # 防止CPU占用过高
        except Exception as e:
            logger.error(f"广播循环出错: {str(e)}")
            logger.error(traceback.format_exc())
            await asyncio.sleep(1)  # 出错时等待较长时间再重试


def process_camera_frame(frame: np.ndarray):
    """处理摄像头帧，更新状态和历史数据"""
    global angle_history, position_history
    
    try:
        # 处理帧，提取单摆数据
        result = update_pendulum_data(frame)
        
        # 更新状态
        PendulumState.update(
            camera_angle=result["angle"],
            # 不更新length字段，避免摄像头像素数据覆盖串口数据
            # length=result["length"],
            ball_x=result["ball_x"],
            ball_y=result["ball_y"],
            timestamp=result["timestamp"]
        )
        
        # 更新历史数据
        current_time = time.time()
        
        # 添加角度历史
        angle_history.append({
            "time": current_time,
            "angle": result["angle"]
        })
        
        # 添加位置历史
        position_history.append({
            "time": current_time,
            "x": result["ball_x"] - result["pivot_x"],
            "y": result["ball_y"] - result["pivot_y"]
        })
        
        # 限制历史数据大小
        if len(angle_history) > MAX_HISTORY_SIZE:
            angle_history = angle_history[-MAX_HISTORY_SIZE:]
        
        if len(position_history) > MAX_HISTORY_SIZE:
            position_history = position_history[-MAX_HISTORY_SIZE:]
    except Exception as e:
        logger.error(f"处理摄像头帧时出错: {str(e)}")
        logger.error(traceback.format_exc())


async def start_websocket_server(host: str = "127.0.0.1", port: int = 5001):
    """启动WebSocket服务器"""
    global server_running, server_error
    
    try:
        logger.info(f"正在启动WebSocket服务器，监听 {host}:{port}")
        server = await websockets.serve(websocket_handler, host, port)
        logger.info(f"WebSocket服务器已启动，监听 {host}:{port}")
        
        # 启动广播循环
        asyncio.create_task(broadcast_loop())
        
        server_running = True
        server_error = None
        
        # 保持服务器运行
        await server.wait_closed()
    except Exception as e:
        server_error = str(e)
        logger.error(f"启动WebSocket服务器时出错: {str(e)}")
        logger.error(traceback.format_exc())
        server_running = False
        raise


def run_websocket_server():
    """在单独的线程中运行WebSocket服务器"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        loop.run_until_complete(start_websocket_server())
    except Exception as e:
        logger.error(f"WebSocket服务器运行出错: {str(e)}")
        logger.error(traceback.format_exc())


class WebSocketServerThread(threading.Thread):
    """WebSocket服务器线程"""
    
    def __init__(self, host: str = "127.0.0.1", port: int = 5001):
        super().__init__()
        self.host = host
        self.port = port
        self.daemon = True  # 设置为守护线程，主线程结束时自动结束
    
    def run(self):
        """运行线程"""
        try:
            logger.info(f"WebSocket服务器线程开始运行，监听 {self.host}:{self.port}")
            run_websocket_server()
        except Exception as e:
            logger.error(f"WebSocket服务器线程运行出错: {str(e)}")
            logger.error(traceback.format_exc())


# 导出函数，用于在摄像头处理循环中调用
def update_frame(frame: np.ndarray):
    """处理摄像头帧，更新WebSocket数据"""
    try:
        process_camera_frame(frame)
        return True
    except Exception as e:
        logger.error(f"更新帧时出错: {str(e)}")
        logger.error(traceback.format_exc())
        return False


# 启动WebSocket服务器的函数
def start_server(host: str = "127.0.0.1", port: int = 5001):
    """启动WebSocket服务器线程"""
    try:
        logger.info(f"正在启动WebSocket服务器线程，监听 {host}:{port}")
        server_thread = WebSocketServerThread(host, port)
        server_thread.start()
        logger.info(f"WebSocket服务器线程已启动，监听 {host}:{port}")
        
        # 等待服务器启动
        time.sleep(2)
        
        if server_error:
            logger.error(f"WebSocket服务器启动失败: {server_error}")
            return None
        
        return server_thread
    except Exception as e:
        logger.error(f"启动WebSocket服务器线程时出错: {str(e)}")
        logger.error(traceback.format_exc())
        return None


# 测试代码
if __name__ == "__main__":
    # 启动WebSocket服务器
    start_server()
    
    # 保持主线程运行
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("服务器已停止") 
__main__.py
import os
import time
from Pendulum import HelpUI, App_Pendulum, Serial_PortManager, Serial_Daemon
from Pendulum.WebSocketServer import start_server

HELP_TEXT = """
快捷操作说明
左键:设定摆心
右键:设定坐标轴零点
z:设置角度零点
p:输出最近10条数据
c:校准HSV识别
d:删除参考点和参考角度
l:启动/终止串口通信
x:导出数据为json
ws:控制点击运动上下
a:停止运动
0:清除所有数据并置零
-:count-5
+:count+5
"""
if __name__ == "__main__":
    # 启动WebSocket服务器
    print("正在启动WebSocket服务器...")
    websocket_server = start_server(host="127.0.0.1", port=5001)
    print(f"WebSocket服务器已启动，监听端口 5001")
    
    # 启动串口（允许失败）
    try:
        Serial_PortManager.listPorts()
        # Serial_PortManager.selectFirstPort()
        # Serial_PortManager.selectPortFromPara("COM9")
        print("串口初始化完成")
    except Exception as e:
        print(f"串口初始化失败，但程序将继续运行: {e}")

    # 启动主应用
    print("正在启动主应用...")
    try:
        app = App_Pendulum(0)
        app.run()
    except Exception as e:
        print(f"主应用启动失败: {e}")
        import traceback
        traceback.print_exc()
        input("按任意键退出...")


"""
# from multiprocessing import Process, freeze_support, Value, Manager
# import tkinter as tk
# import time
# import serial
# import serial.tools.list_ports
# import threading
# import json
# import os
# import cv2
# import numpy as np
# import math


# HSV_LOWER = [40, 70, 70]
# HSV_UPPER = [80, 255, 255]
# SERIAL_PORT = "COM6"
# AUTO_SEARCH_PORT = True
# START_TIME = time.time()
# RESIZE_GUI = {"height": None, "width": 1000}
# CAMERA_SOURCE = 1
# GUI_NAME = "Pendulum Detection"

    # os.system("pause")
    # # HelpUI.run(HELP_TEXT)
    # # Serial_PortManager.listPorts()
    # # Serial_PortManager.selectPortFromStdin()
    # # comm = Serial_Daemon()
    # # comm.threadStart()
    # # while True:
    # #     print(Logger.getLogs())
    # #     time.sleep(5)
    # print(Logger.getLogs())
    # os.system("pause")
    # Serial_PortManager.selectPortFromStdin()
"""
前端代码
ai-chat.css
/* AI对话框样式 */

/* AI聊天切换按钮 */
.ai-chat-toggle {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 50px;
  padding: 12px 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  z-index: 9998;
  font-family: inherit;
}

.ai-chat-toggle:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.ai-chat-toggle.active {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.ai-chat-toggle-icon {
  font-size: 18px;
}

.ai-chat-toggle-text {
  font-size: 14px;
  font-weight: 500;
}

/* AI聊天容器 */
.ai-chat-container {
  position: fixed;
  bottom: 90px;
  right: 20px;
  width: 380px;
  height: 600px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 9999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  transition: all 0.3s ease;
  transform: translateY(20px);
  opacity: 0;
  visibility: hidden;
}

.ai-chat-container.open {
  transform: translateY(0);
  opacity: 1;
  visibility: visible;
}

.ai-chat-container.minimized {
  height: 60px;
  overflow: hidden;
}

/* AI聊天头部 */
.ai-chat-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 20px;
  border-radius: 16px 16px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ai-chat-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}

.ai-chat-icon {
  font-size: 18px;
}

.ai-chat-controls {
  display: flex;
  gap: 8px;
}

.ai-chat-control-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s ease;
}

.ai-chat-control-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

/* AI聊天消息区域 */
.ai-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f8fafc;
}

.ai-chat-messages::-webkit-scrollbar {
  width: 6px;
}

.ai-chat-messages::-webkit-scrollbar-track {
  background: #e2e8f0;
  border-radius: 3px;
}

.ai-chat-messages::-webkit-scrollbar-thumb {
  background: #cbd5e0;
  border-radius: 3px;
}

.ai-chat-messages::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* AI消息样式 */
.ai-message {
  margin-bottom: 16px;
  animation: fadeInUp 0.3s ease;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.ai-message-user {
  text-align: right;
}

.ai-message-user .ai-message-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  margin-left: 20%;
  border-radius: 18px 18px 4px 18px;
  padding: 12px 16px;
  display: inline-block;
  max-width: 80%;
  word-wrap: break-word;
}

.ai-message-ai .ai-message-content {
  background: white;
  color: #334155;
  margin-right: 20%;
  border-radius: 18px 18px 18px 4px;
  padding: 12px 16px;
  display: inline-block;
  max-width: 80%;
  word-wrap: break-word;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.ai-message-loading .ai-message-content {
  background: #f1f5f9;
  color: #64748b;
  font-style: italic;
}

.ai-message-error .ai-message-content {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.ai-message-welcome .ai-message-content {
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
  color: #3730a3;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

/* 建议问题样式 */
.ai-message-suggestions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-top: 12px;
}

.ai-suggestion-item {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: #475569;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-suggestion-item:hover {
  background: #f8fafc;
  border-color: #cbd5e0;
  transform: translateY(-1px);
}

/* AI聊天输入区域 */
.ai-chat-input-container {
  padding: 16px 20px;
  background: white;
  border-top: 1px solid #e2e8f0;
  border-radius: 0 0 16px 16px;
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.ai-chat-input {
  flex: 1;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 14px;
  resize: none;
  outline: none;
  transition: border-color 0.2s ease;
  font-family: inherit;
  line-height: 1.4;
  min-height: 44px;
  max-height: 120px;
}

.ai-chat-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.ai-chat-send-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-chat-send-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.ai-chat-send-btn:active {
  transform: translateY(0);
}

.ai-chat-send-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .ai-chat-container {
    width: 320px;
    height: 500px;
    bottom: 80px;
    right: 10px;
  }
  
  .ai-chat-toggle {
    bottom: 10px;
    right: 10px;
    padding: 10px 16px;
  }
  
  .ai-message-user .ai-message-content {
    margin-left: 10%;
  }
  
  .ai-message-ai .ai-message-content {
    margin-right: 10%;
  }
}

@media (max-width: 480px) {
  .ai-chat-container {
    width: 280px;
    height: 450px;
  }
  
  .ai-chat-input-container {
    flex-direction: column;
    gap: 8px;
  }
  
  .ai-chat-send-btn {
    width: 100%;
  }
}

/* 加载动画 */
.ai-message-loading .ai-message-content::after {
  content: '';
  display: inline-block;
  width: 20px;
  height: 20px;
  background: linear-gradient(90deg, transparent, #64748b, transparent);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  margin-left: 8px;
  vertical-align: middle;
}

@keyframes loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* 消息内容格式化 */
.ai-message-content strong {
  font-weight: 600;
  color: #1e293b;
}

.ai-message-content em {
  font-style: italic;
  color: #475569;
}

.ai-message-content code {
  background: #f1f5f9;
  color: #e11d48;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 13px;
}

.ai-message-content br {
  display: block;
  margin: 4px 0;
}
style.css
/* 数字孪生系统样式 - 参考设计图 */
body {
    background: linear-gradient(135deg, #0a1428 0%, #1a2b4a 25%, #2d4a6b 50%, #1a2b4a 75%, #0a1428 100%);
    background-attachment: fixed;
    color: #ffffff;
    min-height: 100vh;
    padding: 0;
    margin: 0;
    font-family: 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
    overflow-x: hidden;
}

/* 添加动态背景效果 */
body::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background:
        radial-gradient(circle at 20% 20%, rgba(0, 150, 255, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 80% 80%, rgba(0, 255, 200, 0.08) 0%, transparent 50%),
        radial-gradient(circle at 40% 60%, rgba(100, 200, 255, 0.05) 0%, transparent 50%);
    pointer-events: none;
    z-index: -1;
}
/* 顶部导航栏 */
.top-nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: linear-gradient(90deg, rgba(10, 20, 40, 0.95) 0%, rgba(26, 43, 74, 0.95) 100%);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(0, 150, 255, 0.3);
    display: flex;
    align-items: center;
    padding: 0 20px;
    z-index: 1000;
    box-shadow: 0 2px 20px rgba(0, 150, 255, 0.2);
}

.nav-title {
    font-size: 1.8rem;
    font-weight: 700;
    color: #00d4ff;
    text-shadow: 0 0 15px rgba(0, 212, 255, 0.6);
    text-align: center;
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
}



/* 主容器 */
.container {
    display: flex;
    flex-direction: row;
    gap: 20px;
    max-width: 2000px;
    min-height: calc(100vh - 80px);
    height: auto;
    margin: 0 auto;
    padding: 80px 20px 20px;
    box-sizing: border-box;
}

/* 左栏 - 动画区域 */
.animation-section {
    flex: 1.2 1 0;
    min-width: 400px;
    max-width: 600px;
    display: flex;
    flex-direction: column;
    background: linear-gradient(135deg, rgba(10, 20, 40, 0.9) 0%, rgba(15, 30, 60, 0.8) 100%);
    border-radius: 15px;
    padding: 25px;
    box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(0, 150, 255, 0.3);
    backdrop-filter: blur(10px);
    position: relative;
    overflow: hidden;
    min-height: 800px;
}

.animation-section::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0, 150, 255, 0.5), transparent);
}

.animation-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid rgba(0, 150, 255, 0.3);
    position: relative;
}

.animation-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #00d4ff;
    text-shadow: 0 0 15px rgba(0, 212, 255, 0.6);
    position: relative;
}

.animation-title::before {
    content: '';
    position: absolute;
    left: -10px;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 20px;
    background: linear-gradient(180deg, #00d4ff, #0096ff);
    border-radius: 2px;
    box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
}

.animation-status {
    display: flex;
    align-items: center;
}

.run-status {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 18px;
    border-radius: 25px;
    font-size: 0.95rem;
    font-weight: 600;
    transition: all 0.3s ease;
    box-shadow:
        0 4px 15px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    letter-spacing: 0.5px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    transition: all 0.3s ease;
    animation: pulse 2s infinite;
    box-shadow: 0 0 10px currentColor;
    position: relative;
}

.status-dot::after {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    border-radius: 50%;
    border: 1px solid currentColor;
    opacity: 0.3;
    animation: ripple 2s infinite;
}

@keyframes pulse {
    0% {
        box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4);
        transform: scale(1);
    }
    70% {
        box-shadow: 0 0 0 6px rgba(255, 255, 255, 0);
        transform: scale(1.05);
    }
    100% {
        box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
        transform: scale(1);
    }
}

@keyframes ripple {
    0% {
        transform: scale(1);
        opacity: 0.3;
    }
    100% {
        transform: scale(2);
        opacity: 0;
    }
}

.run-status.not-running {
    background: linear-gradient(135deg, rgba(244, 67, 54, 0.1), rgba(244, 67, 54, 0.2));
    border: 1px solid rgba(244, 67, 54, 0.3);
}

.run-status.not-running .status-dot {
    background-color: #f44336;
    box-shadow: 0 0 8px #f44336;
    animation: pulse-red 1.5s infinite;
}

@keyframes pulse-red {
    0% { box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.4); }
    70% { box-shadow: 0 0 0 6px rgba(244, 67, 54, 0); }
    100% { box-shadow: 0 0 0 0 rgba(244, 67, 54, 0); }
}

.run-status.not-running .status-text {
    color: #f44336;
    text-shadow: 0 0 5px rgba(244, 67, 54, 0.3);
}

.run-status.running {
    background: linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(76, 175, 80, 0.2));
    border: 1px solid rgba(76, 175, 80, 0.3);
}

.run-status.running .status-dot {
    background-color: #4caf50;
    box-shadow: 0 0 8px #4caf50;
    animation: pulse-green 1.5s infinite;
}

@keyframes pulse-green {
    0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4); }
    70% { box-shadow: 0 0 0 6px rgba(76, 175, 80, 0); }
    100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
}

.run-status.running .status-text {
    color: #4caf50;
    text-shadow: 0 0 5px rgba(76, 175, 80, 0.3);
}

.status-indicator {
    padding: 6px 12px;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 0.3s ease;
    display: inline-block;
    background: rgba(244, 67, 54, 0.15);
    color: #f44336;
    border: 1px solid rgba(244, 67, 54, 0.3);
    box-shadow: 0 0 10px rgba(244, 67, 54, 0.2);
}

.status-indicator.running {
    background: rgba(76, 175, 80, 0.15) !important;
    color: #4caf50 !important;
    border: 1px solid rgba(76, 175, 80, 0.3) !important;
    box-shadow: 0 0 10px rgba(76, 175, 80, 0.2) !important;
}

.status-indicator.not-running {
    background: rgba(244, 67, 54, 0.15) !important;
    color: #f44336 !important;
    border: 1px solid rgba(244, 67, 54, 0.3) !important;
    box-shadow: 0 0 10px rgba(244, 67, 54, 0.2) !important;
}

.canvas-container {
    position: relative;
    background: linear-gradient(160deg, #0d1021, #1c213d);
    border-radius: 15px;
    height: 700px; /* 小球动画高度 */
    overflow: hidden;
    box-shadow: 0 10px 35px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(100, 180, 255, 0.4);
    margin-bottom: 18px;
}

#pendulumCanvas {
    width: 100%;
    height: 100%;
    display: block;
}

.timer-display {
    position: absolute;
    top: 20px;
    right: 20px;
    background: rgba(0, 30, 60, 0.7);
    color: #80d6ff;
    padding: 12px 20px;
    border-radius: 10px;
    font-size: 1.1rem;
    font-weight: bold;
    z-index: 10;
    box-shadow: 0 0 15px rgba(0, 20, 50, 0.7);
}

/* 实时数据信息板块样式 */
.pendulum-data-panel {
    margin-top: 20px;
    background: linear-gradient(135deg, rgba(10, 20, 40, 0.9) 0%, rgba(15, 30, 60, 0.8) 100%);
    border-radius: 15px;
    box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(0, 150, 255, 0.3);
    backdrop-filter: blur(10px);
    overflow: hidden;
}

.data-panel-header {
    background: linear-gradient(135deg, rgba(10, 20, 40, 0.95) 0%, rgba(15, 30, 60, 0.9) 100%);
    padding: 15px 20px;
    border-bottom: 1px solid rgba(0, 150, 255, 0.3);
}

.data-panel-header h3 {
    margin: 0;
    color: #00d4ff;
    font-size: 1.2rem;
    font-weight: 600;
    text-shadow: 0 0 15px rgba(0, 212, 255, 0.6);
}

.data-panel-content {
    padding: 20px;
    display: flex;
    justify-content: space-between;
    gap: 15px;
    flex-wrap: wrap;
}

.data-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 18px 25px;
    background: rgba(0, 150, 255, 0.1);
    border-radius: 10px;
    border: 1px solid rgba(0, 150, 255, 0.2);
    min-width: 180px;
    flex: 1;
    transition: all 0.3s ease;
}

.data-item:hover {
    background: rgba(0, 150, 255, 0.15);
    border-color: rgba(0, 150, 255, 0.4);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 150, 255, 0.2);
}

.data-label {
    color: #80d6ff;
    font-size: 0.95rem;
    font-weight: 600;
    white-space: nowrap;
}

.data-value {
    color: #ffffff;
    font-size: 1.2rem;
    font-weight: 700;
    text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.visual-scale-info {
    position: absolute;
    top: 20px;
    left: 20px;
    background: rgba(0, 30, 60, 0.7);
    color: #ffcc80;
    padding: 8px 15px;
    border-radius: 8px;
    font-size: 0.9rem;
    z-index: 10;
}

.quick-instructions {
    margin-top: 15px;
    background: rgba(26, 32, 44, 0.6);
    border-radius: 12px;
    padding: 15px;
    border: 1px solid rgba(79, 195, 247, 0.2);
}
.instructions-title {
    font-size: 1rem;
    font-weight: 600;
    color: #4fc3f7;
    margin-bottom: 10px;
}
.instructions-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    font-size: 0.85rem;
    color: #cbd5e0;
}
.instruction-item {
    padding: 4px 8px;
    background: rgba(79, 195, 247, 0.1);
    border-radius: 6px;
    border-left: 3px solid #4fc3f7;
}

/* 中栏 - 控制区域 */
.controls-section {
    flex: 1.5 1 0;
    min-width: 500px;
    max-width: 800px;
    display: flex;
    flex-direction: column;
    gap: 15px;
    background: linear-gradient(135deg, rgba(10, 20, 40, 0.9) 0%, rgba(15, 30, 60, 0.8) 100%);
    border-radius: 12px;
    padding: 20px;
    border: 1px solid rgba(59, 130, 246, 0.3);
    box-shadow:
        0 6px 24px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(12px);
    position: relative;
}

.controls-section::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0, 150, 255, 0.5), transparent);
}
/* 摄像头画面 */
.camera-container {
    width: 100%;
    max-width: 100%;
    margin: 0 0 20px 0;
    background: linear-gradient(135deg, rgba(5, 15, 35, 0.9) 0%, rgba(10, 25, 50, 0.8) 100%);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    border: 1px solid rgba(0, 150, 255, 0.2);
    box-sizing: border-box;
    box-shadow:
        0 4px 20px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
    position: relative;
}

.camera-container::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0, 150, 255, 0.3), transparent);
}
#cameraWrapper {
    width: 100%;
    max-width: 400px;
    aspect-ratio: 9/16;
    position: relative;
    margin: 0 auto;
    background: #222;
    overflow: hidden;
}
#cameraFeed {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    border-radius: 8px;
    border: 2px solid #4fc3f7;
    background: #222;
}
#roiDiv {
    position: absolute;
    border: 2px dashed #ff9800;
    pointer-events: none;
    z-index: 10;
    display: none;
}
#syncStatus {
    margin: 8px auto 0 auto;
    text-align: center;
    color: #4fc3f7;
    font-size: 0.9rem;
    background: rgba(20,30,60,0.8);
    border-radius: 6px;
    max-width: 340px;
    padding: 6px 0;
}
.control-group {
    background: rgba(15, 23, 42, 0.6);
    border-radius: 12px;
    padding: 12px;
    border: 1px solid rgba(79, 195, 247, 0.2);
    margin-bottom: 8px;
}
.control-group h2 {
    font-size: 1rem;
    color: #60a5fa;
    margin-bottom: 8px;
    text-align: center;
    font-weight: 600;
    text-shadow: 0 0 10px rgba(96, 165, 250, 0.3);
}
.slider-container {
    margin-bottom: 10px;
}
label {
    display: block;
    margin-bottom: 8px;
    color: #e2e8f0;
    font-size: 0.9rem;
    font-weight: 500;
}
.value-display {
    color: #4fc3f7;
    font-weight: 600;
    margin-left: 8px;
}
/* 滑块样式 */
input[type="range"] {
    width: 100%;
    height: 8px;
    border-radius: 4px;
    background: linear-gradient(90deg, rgba(0, 150, 255, 0.2), rgba(0, 200, 255, 0.3));
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    border: 1px solid rgba(0, 150, 255, 0.3);
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
}

input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #00d4ff, #0096ff);
    cursor: pointer;
    box-shadow:
        0 3px 8px rgba(0, 212, 255, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.3);
    border: 2px solid rgba(255, 255, 255, 0.2);
    transition: all 0.2s ease;
}

input[type="range"]::-webkit-slider-thumb:hover {
    transform: scale(1.1);
    box-shadow:
        0 4px 12px rgba(0, 212, 255, 0.6),
        inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
.btn-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 10px;
    align-items: center;/*导出数据字体居中*/
}
/* 基础按钮样式 - 用于非modern-btn的按钮 */
button:not(.modern-btn) {
    background: linear-gradient(45deg, #1976d2, #2196f3);
    color: white;
    border: none;
    padding: 10px 30px;
    /* 导出数据按钮 */
    border-radius: 8px;
    cursor: pointer;
    font-size: 1.1rem;
    font-weight: bold;
    letter-spacing: 0.8px;
    transition: all 0.3s ease;
    box-shadow: 0 6px 20px rgba(33, 150, 243, 0.4);
    margin-top: 8px;
    /* width: 100%; */
    min-width: 150px;
    position: relative;
    overflow: hidden;
}
button:not(.modern-btn):hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(33, 150, 243, 0.6);
}
.status-display {
    background: linear-gradient(135deg, rgba(5, 15, 35, 0.8), rgba(10, 25, 50, 0.7));
    border-radius: 12px;
    padding: 20px;
    border: 1px solid rgba(0, 150, 255, 0.3);
    margin-bottom: 15px;
    box-shadow:
        0 6px 20px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    position: relative;
}

.status-display::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0, 150, 255, 0.4), transparent);
}

.status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-size: 0.95rem;
    padding: 10px 15px;
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(0, 150, 255, 0.05), rgba(0, 200, 255, 0.08));
    border: 1px solid rgba(0, 150, 255, 0.1);
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
}

.status-item::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: linear-gradient(180deg, #00d4ff, #0096ff);
    opacity: 0;
    transition: opacity 0.3s ease;
}

.status-item:hover {
    background: linear-gradient(135deg, rgba(0, 150, 255, 0.1), rgba(0, 200, 255, 0.15));
    border-color: rgba(0, 150, 255, 0.3);
    transform: translateX(5px);
}

.status-item:hover::before {
    opacity: 1;
}

.status-label {
    color: #b0c4de;
    font-weight: 500;
    font-size: 0.9rem;
    letter-spacing: 0.5px;
}

.status-value {
    color: #00d4ff;
    font-weight: 600;
    text-shadow: 0 0 8px rgba(0, 212, 255, 0.4);
    transition: all 0.3s ease;
    font-size: 0.95rem;
    padding: 4px 8px;
    border-radius: 4px;
    background: rgba(0, 212, 255, 0.1);
    border: 1px solid rgba(0, 212, 255, 0.2);
}

.status-value.running {
    color: #00ff88;
    text-shadow: 0 0 8px rgba(0, 255, 136, 0.4);
    background: rgba(0, 255, 136, 0.1);
    border-color: rgba(0, 255, 136, 0.2);
}

.status-value.waiting {
    color: #ffaa00;
    text-shadow: 0 0 8px rgba(255, 170, 0, 0.4);
    background: rgba(255, 170, 0, 0.1);
    border-color: rgba(255, 170, 0, 0.2);
}

.status-value.error {
    color: #ff4444;
    text-shadow: 0 0 8px rgba(255, 68, 68, 0.4);
    background: rgba(255, 68, 68, 0.1);
    border-color: rgba(255, 68, 68, 0.2);
}

/* 圆形进度指示器 */
.circular-progress {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: conic-gradient(from 0deg, #00d4ff 0deg, #0096ff 180deg, rgba(0, 150, 255, 0.2) 360deg);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    margin: 10px auto;
}

.circular-progress::before {
    content: '';
    position: absolute;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(10, 20, 40, 0.9), rgba(15, 30, 60, 0.8));
}

.circular-progress .progress-text {
    position: relative;
    z-index: 1;
    color: #00d4ff;
    font-weight: 600;
    font-size: 0.9rem;
    text-shadow: 0 0 5px rgba(0, 212, 255, 0.5);
}

/* 数据卡片 */
.data-card {
    background: linear-gradient(135deg, rgba(5, 15, 35, 0.8), rgba(10, 25, 50, 0.7));
    border-radius: 12px;
    padding: 20px;
    border: 1px solid rgba(0, 150, 255, 0.3);
    margin-bottom: 15px;
    box-shadow:
        0 6px 20px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    position: relative;
    transition: all 0.3s ease;
}

.data-card:hover {
    transform: translateY(-2px);
    box-shadow:
        0 8px 25px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    border-color: rgba(0, 150, 255, 0.5);
}

.data-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0, 150, 255, 0.4), transparent);
}

.status-value.highlight {
    animation: highlight-pulse 2s infinite;
}

@keyframes highlight-pulse {
    0% { opacity: 1; }
    50% { opacity: 0.7; }
    100% { opacity: 1; }
}
/* 右栏 - 图表区域 */
.charts-section {
    flex: 1.2 1 0;
    min-width: 400px;
    max-width: 600px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-height: 800px;
    overflow-y: auto;
    padding-bottom: 40px;
}
.chart-container {
    background: linear-gradient(135deg, rgba(10, 20, 40, 0.9) 0%, rgba(15, 30, 60, 0.8) 100%);
    border-radius: 15px;
    padding: 20px;
    border: 1px solid rgba(0, 150, 255, 0.3);
    box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    position: relative;
    overflow: visible;
    margin-bottom: 20px;
    flex: 1;
    display: flex;
    flex-direction: column;
}

.chart-container::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0, 150, 255, 0.5), transparent);
}
.chart-title {
    font-size: 1.2rem;
    color: #00d4ff;
    margin-bottom: 15px;
    text-align: center;
    font-weight: 600;
    text-shadow: 0 0 15px rgba(0, 212, 255, 0.6);
    position: relative;
    padding-left: 15px;
    flex-shrink: 0;
}

.chart-title::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 16px;
    background: linear-gradient(180deg, #00d4ff, #0096ff);
    border-radius: 2px;
    box-shadow: 0 0 8px rgba(0, 212, 255, 0.5);
}

.chart-title::after {
    content: "";
}
.chart-canvas {
    width: 100%;
    height: 320px;
    min-height: 300px;
    background: rgba(15, 23, 42, 0.6);
    border-radius: 12px;
    border: 1px solid rgba(79, 195, 247, 0.2);
    display: flex;
    align-items: stretch;
    justify-content: center;
    margin-bottom: 10px;
    padding: 10px;
    position: relative;
    flex: 1;
    box-sizing: border-box;
}

.chart-canvas canvas {
    width: 100% !important;
    height: 100% !important;
    display: block;
    border-radius: 8px;
    object-fit: contain;
    box-sizing: border-box;
    background: transparent;
    flex: 1;
}
.logs-section {
    display: flex;
    flex-direction: column;
    gap: 15px;
    flex: 1;
}
.log-container {
    background: rgba(26, 32, 44, 0.8);
    border-radius: 16px;
    padding: 15px;
    border: 1px solid rgba(79, 195, 247, 0.2);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    flex: 1;
    display: flex;
    flex-direction: column;
}
.log-title {
    font-size: 1rem;
    color: #4fc3f7;
    margin-bottom: 10px;
    font-weight: 600;
    text-align: center;
}
.log-content {
    flex: 1;
    background: rgba(15, 23, 42, 0.6);
    border-radius: 8px;
    padding: 10px;
    border: 1px solid rgba(79, 195, 247, 0.2);
    font-family: 'Courier New', monospace;
    font-size: 0.8rem;
    color: #cbd5e0;
    overflow-y: auto;
    max-height: 150px;
}
/* 响应式设计 */
@media (max-width: 1600px) {
    .container {
        gap: 15px;
        max-width: 1400px;
        padding: 80px 15px 20px;
    }
    .animation-section, .charts-section {
        max-width: 450px;
        min-width: 350px;
    }
    .controls-section {
        max-width: 700px;
        min-width: 450px;
    }
}

@media (max-width: 1200px) {
    .container {
        flex-direction: column;
        max-width: 900px;
        height: auto;
        padding: 80px 15px 20px;
    }
    .animation-section, .charts-section, .controls-section {
        max-width: 100%;
        min-width: 300px;
    }

}

@media (max-width: 768px) {
    .container {
        padding: 80px 10px 20px;
        gap: 15px;
    }
    .animation-section, .charts-section, .controls-section {
        padding: 20px 15px;
        border-radius: 12px;
    }
    .chart-canvas {
        height: 250px;
        min-height: 220px;
    }
    .top-nav {
        height: 50px;
        padding: 0 15px;
    }
    .nav-title {
        font-size: 1.4rem;
    }

    .animation-title {
        font-size: 1.3rem;
    }
    .chart-title {
        font-size: 1.1rem;
    }
}

@media (max-width: 480px) {
    .nav-title {
        font-size: 1.2rem;
    }
    .container {
        padding: 60px 8px 15px;
    }
    .animation-section, .charts-section, .controls-section {
        padding: 15px 12px;
    }
    .chart-canvas {
        height: 280px;
        min-height: 250px;
    }
    .animation-section, .controls-section, .charts-section {
        min-height: 600px;
    }
}

/* 页面加载动画 */
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes slideInLeft {
    from {
        opacity: 0;
        transform: translateX(-50px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

@keyframes slideInRight {
    from {
        opacity: 0;
        transform: translateX(50px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

/* 应用动画 */
.animation-section {
    animation: slideInLeft 0.8s ease-out;
}

.controls-section {
    animation: fadeInUp 0.8s ease-out 0.2s both;
}

.charts-section {
    animation: slideInRight 0.8s ease-out 0.4s both;
}

.top-nav {
    animation: fadeInUp 0.6s ease-out;
}

/* 数据流动效果 */
@keyframes dataFlow {
    0% {
        transform: translateX(-100%);
        opacity: 0;
    }
    50% {
        opacity: 1;
    }
    100% {
        transform: translateX(100%);
        opacity: 0;
    }
}

/* 现代化按键样式 */
.modern-btn-group {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
    align-items: center;
    justify-content: center;
}

.modern-btn-group.input-group {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
}

/* 特殊布局类 */
.modern-btn-group.two-column {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    justify-items: center;
    width: 100%;
}

.modern-btn-group.four-column {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    justify-items: center;
    width: 100%;
}

.modern-btn-group.three-column {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    justify-items: center;
    width: 100%;
}

/* 2x2网格布局 */
.modern-btn-group.grid-2x2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 8px;
    justify-items: center;
    align-items: center;
    width: 100%;
}

.modern-btn {
    width: 130px;
    height: 38px;
    font-size: 0.9em;
    cursor: pointer;
    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
    color: #ffffff;
    border: 1px solid rgba(59, 130, 246, 0.4);
    border-radius: 8px;
    transition: all .3s cubic-bezier(0.4, 0, 0.2, 1);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    white-space: nowrap;
    font-weight: 600;
    backdrop-filter: blur(8px);
    box-shadow:
        0 2px 8px rgba(30, 58, 138, 0.25),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.modern-btn:hover {
    transform: translateY(-1px);
    background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
    border-color: rgba(59, 130, 246, 0.6);
    box-shadow:
        0 4px 12px rgba(30, 58, 138, 0.3),
        0 6px 16px rgba(30, 58, 138, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.modern-btn:active {
    transition: all 0.15s;
    transform: translateY(0px);
    box-shadow:
        0 2px 6px rgba(30, 58, 138, 0.3),
        0 3px 8px rgba(30, 58, 138, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.modern-btn .btn-icon {
    font-size: 0.9rem;
    opacity: 0.9;
}

/* 特殊尺寸按钮 - 统一尺寸 */
.modern-btn.small {
    width: 120px;
    height: 38px;
    font-size: 0.85em;
}

.modern-btn.large {
    width: 130px;
    height: 38px;
    font-size: 0.9em;
}

.modern-btn.extra-small {
    width: 100px;
    height: 38px;
    font-size: 0.8em;
}

.modern-btn.medium {
    width: 130px;
    height: 38px;
    font-size: 0.9em;
}

/* 实验控制按钮样式 - 蓝色黑色主题 */
/* 主要控制按钮 - 深蓝色 */
.modern-btn.control-primary {
    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
    border-color: rgba(59, 130, 246, 0.5);
    width: 130px;
    height: 38px;
    font-size: 0.9em;
}

.modern-btn.control-primary:hover {
    background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
    box-shadow:
        0 4px 12px rgba(30, 58, 138, 0.3),
        0 6px 16px rgba(30, 58, 138, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

/* 电磁铁控制按钮 - 深蓝色 */
.modern-btn.control-electromagnet {
    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
    border-color: rgba(59, 130, 246, 0.4);
    width: 120px;
    height: 38px;
    font-size: 0.85em;
}

.modern-btn.control-electromagnet:hover {
    background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
    box-shadow:
        0 3px 10px rgba(30, 58, 138, 0.25),
        0 5px 15px rgba(30, 58, 138, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

/* 摆线推杆控制按钮 - 青色 */
.modern-btn.control-pendulum {
    background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);
    border-color: rgba(20, 184, 166, 0.4);
    width: 120px;
    height: 38px;
    font-size: 0.85em;
}

.modern-btn.control-pendulum:hover {
    background: linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%);
    box-shadow:
        0 3px 10px rgba(15, 118, 110, 0.25),
        0 5px 15px rgba(15, 118, 110, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

/* 数据获取按钮 - 紫色 */
.modern-btn.control-data {
    background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
    border-color: rgba(168, 85, 247, 0.4);
    width: 130px;
    height: 38px;
    font-size: 0.9em;
}

.modern-btn.control-data:hover {
    background: linear-gradient(135deg, #a855f7 0%, #c084fc 100%);
    box-shadow:
        0 3px 10px rgba(124, 58, 237, 0.25),
        0 5px 15px rgba(124, 58, 237, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

/* 操作按钮 - 深蓝色 */
.modern-btn.control-action {
    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
    border-color: rgba(59, 130, 246, 0.5);
    width: 130px;
    height: 38px;
    font-size: 0.9em;
}

.modern-btn.control-action:hover {
    background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
    box-shadow:
        0 3px 10px rgba(30, 58, 138, 0.25),
        0 5px 15px rgba(30, 58, 138, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

/* 清除按钮 - 深灰色 */
.modern-btn.control-clear {
    background: linear-gradient(135deg, #374151 0%, #6b7280 100%);
    border-color: rgba(107, 114, 128, 0.5);
    width: 130px;
    height: 38px;
    font-size: 0.9em;
}

.modern-btn.control-clear:hover {
    background: linear-gradient(135deg, #6b7280 0%, #9ca3af 100%);
    box-shadow:
        0 3px 10px rgba(55, 65, 81, 0.25),
        0 5px 15px rgba(55, 65, 81, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

/* 控制区域样式 */
.control-section {
    margin-bottom: 15px;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid rgba(59, 130, 246, 0.2);
}

/* 电磁铁控制区域 - 深蓝色背景 */
.electromagnet-section {
    background: rgba(30, 58, 138, 0.15);
    border-color: rgba(59, 130, 246, 0.3);
}

/* 摆线推杆控制区域 - 青色背景 */
.pendulum-section {
    background: rgba(15, 118, 110, 0.15);
    border-color: rgba(20, 184, 166, 0.3);
}

.control-section-title {
    color: #80d6ff;
    font-size: 0.9rem;
    font-weight: 600;
    margin-bottom: 8px;
    text-align: center;
}

.control-input-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
}

.control-input {
    width: 80px;
    height: 38px;
    text-align: center;
    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
    border: 1px solid rgba(59, 130, 246, 0.4);
    border-radius: 8px;
    color: #ffffff;
    font-size: 0.9rem;
    font-weight: 600;
}

.control-input:focus {
    background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
    border-color: rgba(59, 130, 246, 0.6);
    box-shadow:
        0 0 0 2px rgba(30, 58, 138, 0.2),
        0 3px 8px rgba(30, 58, 138, 0.2);
}



/* 现代化输入框样式 */
.modern-input {
    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
    border: 1px solid rgba(59, 130, 246, 0.4);
    border-radius: 6px;
    padding: 10px 14px;
    color: #ffffff;
    font-size: 0.9rem;
    width: 100px;
    height: 42px;
    text-align: center;
    backdrop-filter: blur(8px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-sizing: border-box;
    box-shadow:
        0 2px 6px rgba(59, 130, 246, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.modern-input:focus {
    outline: none;
    border-color: rgba(59, 130, 246, 0.7);
    background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
    box-shadow:
        0 0 0 2px rgba(30, 58, 138, 0.3),
        0 4px 12px rgba(30, 58, 138, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.modern-input::placeholder {
    color: rgba(255, 255, 255, 0.7);
}

/* 响应式调整 */
@media (max-width: 768px) {
    .modern-btn {
        width: 130px;
        height: 40px;
        font-size: 0.9em;
    }

    .modern-btn.small {
        width: 100px;
        height: 36px;
        font-size: 0.85em;
    }

    .modern-input {
        width: 80px;
        height: 38px;
        padding: 8px 12px;
        font-size: 0.85rem;
    }

    .modern-btn-group {
        gap: 8px;
    }
    
    /* 实时数据面板响应式 */
    .data-panel-content {
        flex-direction: column;
        gap: 10px;
    }
    
    .data-item {
        min-width: auto;
        width: 100%;
        justify-content: space-between;
    }
    
    .data-label {
        font-size: 0.9rem;
    }
    
    .data-value {
        font-size: 1.1rem;
    }
}

@media (max-width: 480px) {
    .modern-btn-group {
        gap: 6px;
        margin-bottom: 10px;
    }

    .modern-btn {
        width: 110px;
        height: 35px;
        font-size: 0.85em;
    }

    .modern-btn.small {
        width: 85px;
        height: 32px;
        font-size: 0.8em;
    }

    .modern-input {
        width: 70px;
        height: 35px;
        padding: 6px 10px;
        font-size: 0.8rem;
    }
}

.data-flow {
    position: relative;
    overflow: hidden;
}

.data-flow::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, #00d4ff, transparent);
    animation: dataFlow 3s infinite;
}
#exportBtn { /* 保留布局属性最小化，避免覆盖尺寸 */
    white-space: nowrap;
}

.run-status.not-running .status-text::before {
    content: "";
}

.run-status.running .status-text::before {
    content: "";
}


ai-assistant.js
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
camera.js
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
chart.js
// chart.js - 修改时间: 2025-08-03 17:30
// 图表相关模块
import { pendulumWebSocket } from './websocket-client.js';

/**
 * ChartModule 负责角度-时间图和XY轨迹图的初始化与动态更新
 */
export const ChartModule = {
    angleChart: null,
    xyChart: null,
    xyAllData: [],
    xyDuration: 0.5,
    angleChartTimer: null,
    xyChartTimer: null,
    // 添加本地历史数据缓存
    angleHistory: [],
    positionHistory: [],
  
    /**
     * 初始化图表模块，绑定滑块事件，定时刷新
     */
    init() {
      this.setupAngleChart();
      this.setupXYChart();

      // 确保图表标题正确 - 修改版本 2025-08-03 17:30
      console.log('ChartModule: 正在设置图表标题...');
      const angleChartTitle = document.querySelector('#angleChart').closest('.chart-container').querySelector('.chart-title');
      const xyChartTitle = document.querySelector('#xyChart').closest('.chart-container').querySelector('.chart-title');
      if (angleChartTitle) {
        angleChartTitle.textContent = '角度-时间曲线';
        console.log('ChartModule: 角度图表标题已设置为:', angleChartTitle.textContent);
      }
      if (xyChartTitle) {
        xyChartTitle.textContent = '小球XY位置轨迹';
        console.log('ChartModule: XY轨迹图表标题已设置为:', xyChartTitle.textContent);
      }

      // 绑定XY轨迹显示时长滑块
      const xyDurationSlider = document.getElementById('xyDuration');
      const xyDurationValue = document.getElementById('xyDurationValue');
      if (xyDurationSlider) {
        xyDurationSlider.addEventListener('input', () => {
          this.xyDuration = parseFloat(xyDurationSlider.value);
          xyDurationValue.textContent = this.xyDuration.toFixed(1);
          this.renderXYChart();
        });
      }

      // 注册WebSocket回调
      pendulumWebSocket.onAngleHistory(data => {
        this.angleHistory = data || [];
        this.updateAngleChart();
      });

      pendulumWebSocket.onPositionHistory(data => {
        this.positionHistory = data || [];
        this.updateXYChart();
      });

      // 定时刷新图表
      this.angleChartTimer = setInterval(() => this.updateAngleChart(), 500); // 降低刷新频率为500ms
      this.xyChartTimer = setInterval(() => this.updateXYChart(), 500); // 降低刷新频率为500ms
    },
  
    /**
     * 初始化角度-时间图
     */
    setupAngleChart() {
      const ctx = document.getElementById('angleChart').getContext('2d');
      this.angleChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: '角度 (°)',
            data: [],
            borderColor: '#42a5f5',
            backgroundColor: 'rgba(66,165,245,0.08)',
            pointRadius: 0,
            borderWidth: 2,
            tension: 0.2,
            fill: true
          }]
        },
        options: {
          responsive: true,
          animation: { duration: 0 },
          plugins: { legend: { display: false } },
          scales: {
            x: {
              title: { display: true, text: '时间 (s)' },
              ticks: { color: '#bbdefb', maxTicksLimit: 8 }
            },
            y: {
              title: { display: true, text: '角度 (°)' },
              ticks: { color: '#bbdefb' },
              min: -30,
              max: 30
            }
          }
        }
      });
    },
  
    /**
     * 初始化XY轨迹图
     */
    setupXYChart() {
      const ctx = document.getElementById('xyChart').getContext('2d');
      this.xyChart = new Chart(ctx, {
        type: 'scatter',
        data: {
          datasets: [{
            label: '轨迹',
            data: [],
            borderColor: '#ff9800',
            backgroundColor: '#ff9800',
            pointRadius: 3,
            showLine: false,
            fill: false
          }]
        },
        options: {
          responsive: true,
          animation: { duration: 0 },
          plugins: { legend: { display: false } },
          scales: {
            x: {
              title: { display: true, text: 'X 像素' },
              ticks: { color: '#bbdefb' }
            },
            y: {
              title: { display: true, text: 'Y 像素' },
              ticks: { color: '#bbdefb' }
            }
          }
        }
      });
    },
  
    /**
     * 更新角度-时间图
     * 只使用WebSocket数据（摄像头数据）
     */
    updateAngleChart() {
      if (!this.angleChart) return;
      
      // 只使用WebSocket数据，不再使用动画数据
        if (!this.angleHistory || this.angleHistory.length === 0) {
              this.angleChart.data.labels = [];
              this.angleChart.data.datasets[0].data = [];
              this.angleChart.options.scales.y.min = -30;
              this.angleChart.options.scales.y.max = 30;
              this.angleChart.update('none');
              return;
            }
        
        const t0 = this.angleHistory[0].time;
        this.angleChart.data.labels = this.angleHistory.map(d => (d.time - t0).toFixed(2));
        this.angleChart.data.datasets[0].data = this.angleHistory.map(d => d.angle);
        const maxabs = Math.max(10, Math.ceil(Math.max(...this.angleHistory.map(d => Math.abs(d.angle))) / 5) * 5);
            this.angleChart.options.scales.y.min = -maxabs;
            this.angleChart.options.scales.y.max = maxabs;
            this.angleChart.update('none');
    },
  
    /**
     * 更新XY轨迹图
     * 只使用WebSocket数据（摄像头数据）
     */
    updateXYChart() {
      if (!this.xyChart) return;
      
      // 只使用WebSocket数据，不再使用动画数据
            this.renderXYChart();
    },
  
    /**
     * 渲染XY轨迹图（使用WebSocket数据）
     */
    renderXYChart() {
      if (!this.xyChart) return;
      
      if (!this.positionHistory || this.positionHistory.length === 0) {
        this.xyChart.data.datasets[0].data = [];
        this.xyChart.options.scales.x.min = -100;
        this.xyChart.options.scales.x.max = 100;
        this.xyChart.options.scales.y.min = -100;
        this.xyChart.options.scales.y.max = 100;
        this.xyChart.update('none');
        return;
      }
      
      const tmax = this.positionHistory[this.positionHistory.length-1].time;
      const tmin = tmax - this.xyDuration;
      const filtered = this.positionHistory.filter(d => d.time >= tmin);
      let maxabsX = 100, maxabsY = 100;
      
      if (filtered.length > 0) {
        maxabsX = Math.max(50, Math.ceil(Math.max(...filtered.map(d => Math.abs(d.x))) / 50) * 50);
        maxabsY = Math.max(50, Math.ceil(Math.max(...filtered.map(d => Math.abs(d.y))) / 50) * 50);
      }
      
      this.xyChart.options.scales.x.min = -maxabsX;
      this.xyChart.options.scales.x.max = maxabsX;
      this.xyChart.options.scales.y.min = -maxabsY;
      this.xyChart.options.scales.y.max = maxabsY;
      this.xyChart.data.datasets[0].data = filtered.map(d => ({x: d.x, y: d.y}));
      this.xyChart.update('none');
    }
  };
export.js
// export.js
// 数据导出与报告生成模块

console.log('export.js文件开始加载 - 立即执行');

/**
 * ExportModule 负责实验数据的导出（CSV）和实验报告生成
 */
export const ExportModule = {
  /**
   * 初始化导出模块，绑定导出按钮事件
   */
  init() {
    console.log('ExportModule.init()被调用');
    
    // 动态创建导出按钮并绑定事件
    let exportBtn = document.getElementById('exportBtn');
    if (!exportBtn) {
      exportBtn = document.createElement('button');
      exportBtn.id = 'exportBtn';
      exportBtn.textContent = '导出数据';
      // 统一使用现代按钮中等尺寸
      exportBtn.className = 'modern-btn medium';
    } else {
      // 统一规范已有按钮的样式
      exportBtn.className = 'modern-btn medium';
      // 清除内联尺寸与外边距，避免样式漂移
      exportBtn.style.margin = '';
      exportBtn.style.width = '';
      exportBtn.style.height = '';
      exportBtn.style.padding = '';
    }
    // 新增：生成可视化分析按钮
    console.log('准备创建可视化分析按钮');
    let visualizationBtn = document.getElementById('visualizationBtn');
    if (!visualizationBtn) {
      visualizationBtn = document.createElement('button');
      visualizationBtn.id = 'visualizationBtn';
      visualizationBtn.textContent = '生成可视化分析';
      visualizationBtn.className = 'modern-btn medium';
      console.log('可视化分析按钮创建完成');
      // 移除内联样式，使用CSS类
    }
    // 新增：生成实验报告按钮
    let reportBtn = document.getElementById('reportBtn');
    if (!reportBtn) {
      reportBtn = document.createElement('button');
      reportBtn.id = 'reportBtn';
      reportBtn.textContent = '生成实验报告';
      reportBtn.className = 'modern-btn medium';
    }
    // 新增：导出角度与时间数据按钮
    let exportAngleTimeBtn = document.getElementById('exportAngleTimeBtn');
    if (!exportAngleTimeBtn) {
      exportAngleTimeBtn = document.createElement('button');
      exportAngleTimeBtn.id = 'exportAngleTimeBtn';
      exportAngleTimeBtn.textContent = '导出角度-时间数据';
      exportAngleTimeBtn.className = 'modern-btn medium';
    }
    // 创建按钮容器并插入到controls-section最下方
    console.log('准备创建按钮容器');
    let buttonContainer = document.getElementById('exportButtonContainer');
    if (!buttonContainer) {
      buttonContainer = document.createElement('div');
      buttonContainer.id = 'exportButtonContainer';
      buttonContainer.className = 'modern-btn-group';
      buttonContainer.style.cssText = `
        justify-content: center;
        margin: 20px auto;`;
      console.log('按钮容器创建完成');
    }
    // 清空容器再添加按钮，避免重复
    buttonContainer.innerHTML = '';
    buttonContainer.appendChild(exportBtn);
    buttonContainer.appendChild(visualizationBtn);
    buttonContainer.appendChild(reportBtn);
    buttonContainer.appendChild(exportAngleTimeBtn);
    
    const controlsSection = document.querySelector('.controls-section');
    if (controlsSection) {
      controlsSection.appendChild(buttonContainer);
    } else {
      document.body.appendChild(buttonContainer);
    }
    // 绑定事件
    exportBtn.onclick = () =>{
      this.exportCSV();
      console.log('导出数据按钮被点击');
    }
    visualizationBtn.onclick = () => {
      console.log('生成可视化分析按钮被点击');
      this.showVisualizationAnalysis();
    };
    reportBtn.onclick = () => {
      console.log('生成实验报告按钮被点击');
      this.generateReport();
    };
    exportAngleTimeBtn.onclick = () => {
      console.log('导出角度与时间数据按钮被点击');
      this.exportAngleTimeData();
    };  
  },

  /**
   * 导出CSV数据
   * 依赖 window.experimentGroups
   */
  exportCSV() {
    if (!window.experimentGroups || !window.experimentGroups.length) {
      alert('没有可导出的实验数据！');
      return;
    }
    let csv = '实验编号,初始角度(°),摆长(cm),周期编号,本周期时长(s),累计时长(s),重力加速度(m/s²)\n';
    window.experimentGroups.forEach((exp, expIdx) => {
      if (exp.periods && exp.periods.length > 0) {
        // 过滤掉duration为0的周期数据
        const validPeriods = exp.periods.filter(p => p.duration > 0);
        
        if (validPeriods.length > 0) {
          validPeriods.forEach((p, i) => {
            csv += [
              expIdx + 1,
              exp.initialAngle,
              exp.length,
              p.index, // 使用已经重新编号的周期编号
              p.duration.toFixed(4),
              p.total.toFixed(4),
              (i === 0 ? (exp.gravity?.toFixed(4) || '') : '')
            ].join(',') + '\n';
          });
        } else {
          // 如果没有有效周期数据，只导出实验基本信息
          csv += [
            expIdx + 1,
            exp.initialAngle,
            exp.length,
            '', '', '', exp.gravity?.toFixed(4) || ''
          ].join(',') + '\n';
        }
      } else {
        csv += [
          expIdx + 1,
          exp.initialAngle,
          exp.length,
          '', '', '', exp.gravity?.toFixed(4) || ''
        ].join(',') + '\n';
      }
    });
    // 添加UTF-8 BOM头
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '实验数据.csv';
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * 导出角度与时间数据
   * 记录从WebSocket获取的angle_history数据，时间精确到小数点后三位
   */
  exportAngleTimeData() {
    // 使用全局的AngleTimeRecorder获取数据
    console.log('准备导出角度-时间数据...');
    console.log('AngleTimeRecorder状态:', window.PendulumApp?.AngleTimeRecorder);
    
    if (!window.PendulumApp || !window.PendulumApp.AngleTimeRecorder) {
      alert('角度记录器未初始化！请刷新页面重试。');
      console.error('AngleTimeRecorder未找到');
      return;
    }
    
    const angleTimeData = window.PendulumApp.AngleTimeRecorder.getData();
    console.log('获取到的数据:', angleTimeData);
    console.log('数据长度:', angleTimeData?.length);

    if (!angleTimeData || !angleTimeData.length) {
      const isRecording = window.PendulumApp.AngleTimeRecorder.isRecording;
      const message = isRecording 
        ? '没有可导出的角度与时间数据！数据可能还在收集中，请稍后再试。\n\n提示：确保WebSocket已连接并正在接收角度数据。'
        : '没有可导出的角度与时间数据！请先点击"开始实验"按钮开始记录数据。';
      alert(message);
      console.warn('导出失败：', { 
        dataLength: angleTimeData?.length || 0, 
        isRecording,
        hasRecorder: !!window.PendulumApp.AngleTimeRecorder
      });
      return;
    }

    let csv = '时间(秒),角度(度)\n';
    angleTimeData.forEach((data, index) => {
      csv += [
        data.time.toFixed(3),
        data.angle.toFixed(3)
      ].join(',') + '\n';
    });

    // 添加UTF-8 BOM头
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '角度与时间数据.csv';
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * 生成实验报告（HTML文件下载）
   * 依赖 processExperimentData
   */
  generateReport() {
    const data = this.processExperimentData();
    // 需要内嵌的图片（尝试转为DataURL，失败则使用相对路径）
    const pics = [
      { key: 'imgTL', path: '可视化分析/T-L曲线拟合.png', alt: 'T-L曲线拟合' },
      { key: 'imgSqrt', path: '可视化分析/T-根号L直线拟合.png', alt: 'T-根号L直线拟合' },
      { key: 'imgGL', path: '可视化分析/g与L的关系.png', alt: 'g与L的关系' },
      { key: 'imgTheta', path: '可视化分析/摆角与周期关系.png', alt: '摆角与周期关系' }
    ];

    const toDataURL = (url) => new Promise((resolve) => {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } catch (e) { resolve(url); }
        };
        img.onerror = function() { resolve(url); };
        img.src = url;
      } catch (e) { resolve(url); }
    });

    Promise.all(pics.map(async p => ({ key: p.key, alt: p.alt, data: await toDataURL(p.path) }))).then((arr) => {
      const M = Object.fromEntries(arr.map(x => [x.key, x]));
      let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>单摆测重力加速度实验报告</title>
  <style>
    body {
      font-family: "Microsoft YaHei", Arial, sans-serif;
      line-height: 1.6;
      max-width: 1000px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1, h2 {
      color: #2c3e50;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
    }
    .formula {
      background: #f8f9fa;
      padding: 10px;
      border-radius: 5px;
      margin: 10px 0;
      text-align: center;
      font-style: italic;
    }
    .chart-container {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin: 20px 0;
      flex-wrap: wrap;
    }
    .chart {
      border: 1px solid #ddd;
      padding: 10px;
      border-radius: 5px;
      background: white;
    }
    .question {
      background: #f5f6fa;
      padding: 15px;
      border-left: 4px solid #5d6d7e;
      margin: 10px 0;
    }
    .answer {
      margin-left: 20px;
      color: #2c3e50;
    }
  </style>
</head>
<body>
  <h1>单摆测重力加速度实验报告</h1>
  
  <p>摆测重力加速度伽利略在比萨大教堂内观察一个圣灯缓慢地摆动时，用他的脉搏跳动作为计时器计算圣灯摆动的周期。他发现连续摆动的圣灯，每次摆动的时间间隔是相等的，与圣灯摆动的振幅无关，并用实验证实了观察的结果。这就是单摆的等时性原理。用单摆来测量重力加速度简单方便，因为单摆的振动周期取决于振动系统本身的性质，即取决于重力加速度g和摆长L.只需要测出摆长L和摆动周期T，就可算出g的值。地球上各个地区重力加速度g的数值，随该地区的地理纬度和相对于海平面的高度的不同而稍有差异。</p>

  <h2>【实验目的】</h2>
  <ol>
    <li>掌握用单摆测量重力加速度的方法并分析重力加速度与摆长之间的关系。</li>
    <li>研究单摆的周期与单摆的摆长、摆动角度之间的关系。</li>
    <li>学习用作图法处理测量数据。</li>
  </ol>

  <h2>【实验原理】</h2>
  <p>一根长为L的不可伸长的细线，上端固定，下端悬挂一个质量为m的小球。当细线质量比小球的质量小很多，而且小球的直径又比细线的长度小很多，摆角小于或等于10°,空气阻力不计，此种装置称为单摆。</p>
  
  <p>如果把小球稍微拉开一定距离，小球在重力作用下可在竖直平面内作往复运动，一个完整的往复运动所用的时间称为一个周期。</p>

  <p>可以证明单摆的周期T满足下面公式：</p>
  <div class="formula">
    T = 2π√(L/g)
  </div>

  <p>式中L为单摆摆长。单摆摆长是指上端悬挂点到球心之间的距离，g为重力加速度。如果测量得出周期T，单摆的摆长L，利用上面式子可计算出当地的重力加速度g.从上面公式可知T²和L具有线性关系，对不同的单摆摆长L测量得出相对应的周期，可由线的斜率求出g值。</p>

  <p>当摆动角度θ较大(θ>10°)时，单摆的振动周期T和摆动的角度θ之间存在下列关系：</p>
  <div class="formula">
    T = T₀(1 + (1/16)sin²(θ/2) + ...)
  </div>

  <h2>【实验仪器】</h2>
  <p>单摆实验装置，光电门，米尺，游标卡尺。</p>

  <h2>【数据处理与结果】</h2>
  <h3>实验1：周期与摆长的关系</h3>
  <div class="chart-container">
    <div class="chart">
      <canvas id="chart1" width="400" height="300" style="max-width:400px;width:100%;display:block;margin:8px auto;border:1px solid #ddd;border-radius:6px;background:#fff;"></canvas>
      <p>图1：T vs L 散点图与曲线拟合</p>
    </div>
    <div class="chart">
      <canvas id="chart2" width="400" height="300" style="max-width:400px;width:100%;display:block;margin:8px auto;border:1px solid #ddd;border-radius:6px;background:#fff;"></canvas>
      <p>图2：T vs √L 散点图与线性拟合</p>
    </div>
  </div>

  <div class="question">
    <p><strong>思考题1：</strong>为什么是曲线不是直线？能否找到一种方法，让数据变成线性关系？</p>
    <div class="answer" id="answer1"></div>
  </div>

  <div class="question">
    <p><strong>思考题2：</strong>为什么选择√L？是否有其他方法得到线性？</p>
    <div class="answer" id="answer2"></div>
  </div>

  <h3>实验2：重力加速度与摆长的关系</h3>
  <div class="chart-container">
    <div class="chart">
      <canvas id="chart3" width="400" height="300" style="max-width:400px;width:100%;display:block;margin:8px auto;border:1px solid #ddd;border-radius:6px;background:#fff;"></canvas>
      <p>图3：g vs L 散点图与曲线拟合</p>
    </div>
  </div>

  <div class="question">
    <p><strong>思考题1：</strong>为什么g在小摆长和大摆长时偏小，中摆长时稳定？</p>
    <div class="answer" id="answer4"></div>
  </div>

  <div class="question">
    <p><strong>思考题2：</strong>如何改进实验让重力加速度的测量更精准呢？</p>
    <div class="answer" id="answer6"></div>
  </div>

  <h3>实验3：周期与摆角的关系</h3>
  <div class="chart-container">
    <div class="chart">
      <canvas id="chart4" width="400" height="300" style="max-width:400px;width:100%;display:block;margin:8px auto;border:1px solid #ddd;border-radius:6px;background:#fff;"></canvas>
      <p>图4：小摆角下的周期变化 (1-10°)</p>
    </div>
  </div>

  <div class="question">
    <p><strong>思考题1：</strong>为什么小摆角下得到的图像周期基本不变？</p>
    <div class="answer" id="answer7"></div>
  </div>

  <div class="question">
    <p><strong>思考题2：</strong>为什么大摆角下周期变化幅度这么大？</p>
    <div class="answer" id="answer9"></div>
  </div>

  <h2>【注意事项】</h2>
  <p>单摆必须在竖直面内摆动,防止形成锥摆。</p>

  <h2>【分析讨论题】</h2>
  <div class="question">
    <p><strong>1. </strong>单摆在摆动中受空气阻力的影响,摆幅会越来越小,试问它的周期是否会变化?请根据实验观察进行回答,并说明理论依据。</p>
    <div class="answer"></div>
  </div>

  <div class="question">
    <p><strong>2. </strong>根据间接测量误差传递公式分析本实验中哪个物理量的测量对g测量影响最大?应采用什么方法减小测量误差?</p>
    <div class="answer"></div>
  </div>

  <script>
    // 注入用于绘图的实验数据
    window.experimentData = ${JSON.stringify(data)};

    // 获取学生填写的答案
    function getAnswers() {
      const answers = document.querySelectorAll('textarea');
      answers.forEach((answer, index) => {
        const answerDiv = document.getElementById('answer' + (index + 1));
        if (answerDiv) {
          answerDiv.textContent = answer.value || '（未作答）';
        }
      });
    }

    // 自带的绘图（与可视化分析一致）
    function drawTvsLChartLocal(data, canvas) { const ctx=canvas.getContext('2d'); const w=canvas.width,h=canvas.height; ctx.clearRect(0,0,w,h); if(!data||data.length===0){ctx.fillStyle='#f0f0f0';ctx.fillRect(0,0,w,h);ctx.fillStyle='#666';ctx.font='16px Arial';ctx.textAlign='center';ctx.fillText('暂无实验数据',w/2,h/2);return;} const m=60,pw=w-2*m,ph=h-2*m; const Ls=data.map(d=>d.length), Ts=data.map(d=>d.period); const Lmin=Math.min(...Ls),Lmax=Math.max(...Ls),Tmin=Math.min(...Ts),Tmax=Math.max(...Ts); const l0=Math.max(0,Lmin-(Lmax-Lmin)*0.1),l1=Lmax+(Lmax-Lmin)*0.1; const t0=Math.max(0,Tmin-(Tmax-Tmin)*0.1),t1=Tmax+(Tmax-Tmin)*0.1; const dL=l1-l0,dT=t1-t0; ctx.strokeStyle='#f0f0f0';ctx.lineWidth=1; for(let i=0;i<=10;i++){const x=m+(i/10)*pw;ctx.beginPath();ctx.moveTo(x,m);ctx.lineTo(x,h-m);ctx.stroke();} for(let i=0;i<=10;i++){const y=m+(i/10)*ph;ctx.beginPath();ctx.moveTo(m,y);ctx.lineTo(w-m,y);ctx.stroke();} ctx.strokeStyle='#333';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(m,m);ctx.lineTo(m,h-m);ctx.lineTo(w-m,h-m);ctx.stroke(); ctx.fillStyle='#333';ctx.font='12px Arial';ctx.textAlign='center'; for(let i=0;i<=6;i++){const L=l0+(l1-l0)*i/6; const x=m+(L-l0)/dL*pw; const y=h-m; ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+5);ctx.stroke(); ctx.fillText(L.toFixed(1),x,y+20);} for(let i=0;i<=6;i++){const T=t0+(t1-t0)*i/6; const x=m; const y=h-m-(T-t0)/dT*ph; ctx.beginPath();ctx.moveTo(x-5,y);ctx.lineTo(x,y);ctx.stroke(); ctx.textAlign='right';ctx.fillText(T.toFixed(2),x-10,y+4);} ctx.fillStyle='#ff6b6b';ctx.strokeStyle='#d32f2f';ctx.lineWidth=1; data.forEach(d=>{const x=m+(d.length-l0)/dL*pw; const y=h-m-(d.period-t0)/dT*ph; ctx.beginPath();ctx.arc(x,y,5,0,2*Math.PI);ctx.fill();ctx.stroke();}); ctx.strokeStyle='#4caf50';ctx.lineWidth=3;ctx.beginPath(); for(let i=0;i<=100;i++){const L=l0+dL*i/100; const T=2*Math.PI*Math.sqrt(L/100/9.8); const x=m+(L-l0)/dL*pw; const y=h-m-(T-t0)/dT*ph; if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);} ctx.stroke(); ctx.fillStyle='#333';ctx.font='16px Arial';ctx.textAlign='center';ctx.fillText('摆长 L (cm)',w/2,h-15); ctx.save();ctx.translate(15,h/2);ctx.rotate(-Math.PI/2);ctx.fillText('周期 T (s)',0,0);ctx.restore(); }
    function drawTvsSqrtLChartLocal(data, canvas){ const ctx=canvas.getContext('2d'); const w=canvas.width,h=canvas.height; ctx.clearRect(0,0,w,h); if(!data||data.length===0){ctx.fillStyle='#f0f0f0';ctx.fillRect(0,0,w,h);ctx.fillStyle='#666';ctx.font='16px Arial';ctx.textAlign='center';ctx.fillText('暂无实验数据',w/2,h/2);return;} const m=60,pw=w-2*m,ph=h-2*m; const Xs=data.map(d=>d.sqrtLength), Ys=data.map(d=>d.period); const xmin=Math.min(...Xs),xmax=Math.max(...Xs),ymin=Math.min(...Ys),ymax=Math.max(...Ys); const x0=Math.max(0,xmin-(xmax-xmin)*0.1),x1=xmax+(xmax-xmin)*0.1; const y0=Math.max(0,ymin-(ymax-ymin)*0.1),y1=ymax+(ymax-ymin)*0.1; const dX=x1-x0,dY=y1-y0; ctx.strokeStyle='#f0f0f0';ctx.lineWidth=1; for(let i=0;i<=10;i++){const x=m+(i/10)*pw;ctx.beginPath();ctx.moveTo(x,m);ctx.lineTo(x,h-m);ctx.stroke();} for(let i=0;i<=10;i++){const y=m+(i/10)*ph;ctx.beginPath();ctx.moveTo(m,y);ctx.lineTo(w-m,y);ctx.stroke();} ctx.strokeStyle='#333';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(m,m);ctx.lineTo(m,h-m);ctx.lineTo(w-m,h-m);ctx.stroke(); ctx.fillStyle='#333';ctx.font='12px Arial';ctx.textAlign='center'; for(let i=0;i<=6;i++){const X=x0+(x1-x0)*i/6; const x=m+(X-x0)/dX*pw; const y=h-m; ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+5);ctx.stroke(); ctx.fillText(X.toFixed(1),x,y+20);} for(let i=0;i<=6;i++){const Y=y0+(y1-y0)*i/6; const x=m; const y=h-m-(Y-y0)/dY*ph; ctx.beginPath();ctx.moveTo(x-5,y);ctx.lineTo(x,y);ctx.stroke(); ctx.textAlign='right';ctx.fillText(Y.toFixed(2),x-10,y+4);} ctx.fillStyle='#ff6b6b'; data.forEach(d=>{const x=m+(d.sqrtLength-x0)/dX*pw; const y=h-m-(d.period-y0)/dY*ph; ctx.beginPath();ctx.arc(x,y,4,0,2*Math.PI);ctx.fill();}); ctx.strokeStyle='#4caf50';ctx.lineWidth=2;ctx.beginPath(); for(let i=0;i<=100;i++){const X=x0+dX*i/100; const Y=2*Math.PI/Math.sqrt(9.8)*X/10; const x=m+(X-x0)/dX*pw; const y=h-m-(Y-y0)/dY*ph; if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);} ctx.stroke(); ctx.fillStyle='#333';ctx.font='16px Arial';ctx.textAlign='center';ctx.fillText('√L (cm^0.5)',w/2,h-15); ctx.save();ctx.translate(15,h/2);ctx.rotate(-Math.PI/2);ctx.fillText('周期 T (s)',0,0);ctx.restore(); }
    function drawGvsLChartLocal(data, canvas){ const ctx=canvas.getContext('2d'); const w=canvas.width,h=canvas.height; ctx.clearRect(0,0,w,h); const gs=data.map(d=>d.gravity).filter(g=>g!=null); if(gs.length===0){ctx.fillStyle='#f0f0f0';ctx.fillRect(0,0,w,h);ctx.fillStyle='#666';ctx.font='16px Arial';ctx.textAlign='center';ctx.fillText('暂无重力加速度数据',w/2,h/2);return;} const m=60,pw=w-2*m,ph=h-2*m; const Ls=data.map(d=>d.length); const Lmin=Math.min(...Ls),Lmax=Math.max(...Ls),Gmin=Math.min(...gs),Gmax=Math.max(...gs); const l0=Math.max(0,Lmin-(Lmax-Lmin)*0.1),l1=Lmax+(Lmax-Lmin)*0.1; const g0=Math.max(8,Gmin-(Gmax-Gmin)*0.1),g1=Math.min(12,Gmax+(Gmax-Gmin)*0.1); const dL=l1-l0,dG=g1-g0; ctx.strokeStyle='#f0f0f0';ctx.lineWidth=1; for(let i=0;i<=10;i++){const x=m+(i/10)*pw;ctx.beginPath();ctx.moveTo(x,m);ctx.lineTo(x,h-m);ctx.stroke();} for(let i=0;i<=10;i++){const y=m+(i/10)*ph;ctx.beginPath();ctx.moveTo(m,y);ctx.lineTo(w-m,y);ctx.stroke();} ctx.strokeStyle='#333';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(m,m);ctx.lineTo(m,h-m);ctx.lineTo(w-m,h-m);ctx.stroke(); ctx.fillStyle='#333';ctx.font='12px Arial';ctx.textAlign='center'; for(let i=0;i<=6;i++){const L=l0+(l1-l0)*i/6; const x=m+(L-l0)/dL*pw; const y=h-m; ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+5);ctx.stroke(); ctx.fillText(L.toFixed(0),x,y+20);} for(let i=0;i<=6;i++){const G=g0+(g1-g0)*i/6; const x=m; const y=h-m-(G-g0)/dG*ph; ctx.beginPath();ctx.moveTo(x-5,y);ctx.lineTo(x,y);ctx.stroke(); ctx.textAlign='right';ctx.fillText(G.toFixed(2),x-10,y+4);} ctx.fillStyle='#ff6b6b'; data.forEach(d=>{if(d.gravity!=null){const x=m+(d.length-l0)/dL*pw; const y=h-m-(d.gravity-g0)/dG*ph; ctx.beginPath();ctx.arc(x,y,4,0,2*Math.PI);ctx.fill();}}); ctx.strokeStyle='#4caf50';ctx.setLineDash([5,5]);ctx.lineWidth=2; const ref=9.79; const yRef=h-m-(ref-g0)/dG*ph; ctx.beginPath();ctx.moveTo(m,yRef);ctx.lineTo(w-m,yRef);ctx.stroke();ctx.setLineDash([]); ctx.fillStyle='#333';ctx.font='16px Arial';ctx.textAlign='center';ctx.fillText('摆长 L (cm)',w/2,h-15); ctx.save();ctx.translate(15,h/2);ctx.rotate(-Math.PI/2);ctx.fillText('重力加速度 g (m/s²)',0,0);ctx.restore(); }
    function drawTvsSmallThetaChartLocal(data, canvas){ const ctx=canvas.getContext('2d'); const w=canvas.width,h=canvas.height; ctx.clearRect(0,0,w,h); if(!data||data.length===0){ctx.fillStyle='#f0f0f0';ctx.fillRect(0,0,w,h);ctx.fillStyle='#666';ctx.font='16px Arial';ctx.textAlign='center';ctx.fillText('暂无小摆角数据',w/2,h/2);return;} const m=60,pw=w-2*m,ph=h-2*m; const As=data.map(d=>d.initialAngle), Ts=data.map(d=>d.period); const Amin=Math.min(...As),Amax=Math.max(...As),Tmin=Math.min(...Ts),Tmax=Math.max(...Ts); const a0=Math.max(0,Amin-(Amax-Amin)*0.1),a1=Amax+(Amax-Amin)*0.1; const t0=Math.max(0,Tmin-(Tmax-Tmin)*0.1),t1=Tmax+(Tmax-Tmin)*0.1; const dA=a1-a0,dT=t1-t0; ctx.strokeStyle='#f0f0f0';ctx.lineWidth=1; for(let i=0;i<=10;i++){const x=m+(i/10)*pw;ctx.beginPath();ctx.moveTo(x,m);ctx.lineTo(x,h-m);ctx.stroke();} for(let i=0;i<=10;i++){const y=m+(i/10)*ph;ctx.beginPath();ctx.moveTo(m,y);ctx.lineTo(w-m,y);ctx.stroke();} ctx.strokeStyle='#333';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(m,m);ctx.lineTo(m,h-m);ctx.lineTo(w-m,h-m);ctx.stroke(); ctx.fillStyle='#333';ctx.font='12px Arial';ctx.textAlign='center'; for(let i=0;i<=6;i++){const A=a0+(a1-a0)*i/6; const x=m+(A-a0)/dA*pw; const y=h-m; ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+5);ctx.stroke(); ctx.fillText(A.toFixed(1),x,y+20);} for(let i=0;i<=6;i++){const T=t0+(t1-t0)*i/6; const x=m; const y=h-m-(T-t0)/dT*ph; ctx.beginPath();ctx.moveTo(x-5,y);ctx.lineTo(x,y);ctx.stroke(); ctx.textAlign='right';ctx.fillText(T.toFixed(2),x-10,y+4);} ctx.fillStyle='#ff6b6b'; data.forEach(d=>{const x=m+(d.initialAngle-a0)/dA*pw; const y=h-m-(d.period-t0)/dT*ph; ctx.beginPath();ctx.arc(x,y,4,0,2*Math.PI);ctx.fill();}); const avg=Ts.reduce((s,v)=>s+v,0)/Ts.length; ctx.strokeStyle='#4caf50';ctx.setLineDash([5,5]);ctx.lineWidth=2; const yRef=h-m-(avg-t0)/dT*ph; ctx.beginPath();ctx.moveTo(m,yRef);ctx.lineTo(w-m,yRef);ctx.stroke();ctx.setLineDash([]); ctx.fillStyle='#333';ctx.font='16px Arial';ctx.textAlign='center';ctx.fillText('摆角 θ (°)',w/2,h-15); ctx.save();ctx.translate(15,h/2);ctx.rotate(-Math.PI/2);ctx.fillText('周期 T (s)',0,0);ctx.restore(); }

    // 绘制图表
    function drawReportCharts() {
      drawTvsLChartLocal(window.experimentData, document.getElementById('chart1'));
      drawTvsSqrtLChartLocal(window.experimentData, document.getElementById('chart2'));
      drawGvsLChartLocal(window.experimentData, document.getElementById('chart3'));
      drawTvsSmallThetaChartLocal(window.experimentData, document.getElementById('chart4'));
    }

    // 页面加载完成后执行
    window.onload = function() {
      getAnswers();
      drawReportCharts();
    };
  </script>
</body>
</html>`;
 
      // 创建并下载报告
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '单摆测重力加速度实验报告.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  },

  /**
   * 显示可视化分析界面
   */
  showVisualizationAnalysis() {
    console.log('showVisualizationAnalysis函数被调用');
    
    // 移除已存在的可视化界面
    const existingModal = document.getElementById('visualizationModal');
    if (existingModal) {
      existingModal.remove();
    }

    // 获取实验数据
    console.log('准备调用processExperimentData()');
    const data = this.processExperimentData();
    console.log('processExperimentData()返回的数据:', data);
    
    // 创建模态框
    const modal = document.createElement('div');
    modal.id = 'visualizationModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 10000;
      overflow-y: auto;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 20px;
    `;

    // 创建内容容器
    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      border-radius: 15px;
      padding: 30px;
      max-width: 1200px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      position: relative;
      display: flex;
      flex-direction: column;
    `;

    // 创建关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6L18 18" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    closeBtn.style.cssText = `
      position: absolute;
      top: 20px;
      right: 25px;
      background: #ff4757;
      border: none;
      cursor: pointer;
      color: white;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(255, 71, 87, 0.3);
      font-size: 0;
    `;
    closeBtn.onmouseenter = () => {
      closeBtn.style.transform = 'scale(1.1)';
      closeBtn.style.boxShadow = '0 6px 16px rgba(255, 71, 87, 0.4)';
      closeBtn.style.background = '#ff3742';
    };
    closeBtn.onmouseleave = () => {
      closeBtn.style.transform = 'scale(1)';
      closeBtn.style.boxShadow = '0 4px 12px rgba(255, 71, 87, 0.3)';
      closeBtn.style.background = '#ff4757';
    };
    closeBtn.onclick = () => modal.remove();

    // 标题
    const title = document.createElement('h1');
    title.textContent = '单摆实验数据分析';
    title.style.cssText = `
      text-align: center;
      color: #333;
      margin-bottom: 20px;
      font-size: 2rem;
      font-weight: bold;
    `;

    // 创建标签页容器
    const tabContainer = document.createElement('div');
    tabContainer.style.cssText = `
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-bottom: 30px;
    `;

    // 创建标签页按钮
    const tab1 = document.createElement('button');
    tab1.textContent = '周期与摆长关系';
    const tab2 = document.createElement('button');
    tab2.textContent = '重力加速度与摆长关系';
    const tab3 = document.createElement('button');
    tab3.textContent = '周期与摆角关系';

    const tabStyle = `
      padding: 12px 30px;
      border: none;
      border-radius: 25px;
      cursor: pointer;
      font-size: 1.1rem;
      transition: all 0.3s;
      white-space: nowrap;
      font-weight: 500;
      background: #f0f0f0;
      color: #666;
    `;

    [tab1, tab2, tab3].forEach(tab => {
      tab.style.cssText = tabStyle;
    });

    const setActiveTab = (activeTab) => {
      [tab1, tab2, tab3].forEach(tab => {
        if (tab === activeTab) {
          tab.style.background = '#4caf50';
          tab.style.color = 'white';
          tab.style.boxShadow = '0 2px 8px rgba(76, 175, 80, 0.3)';
        } else {
          tab.style.background = '#f0f0f0';
          tab.style.color = '#666';
          tab.style.boxShadow = 'none';
        }
      });
    };

    // 添加标签页到容器
    tabContainer.appendChild(tab1);
    tabContainer.appendChild(tab2);
    tabContainer.appendChild(tab3);

    // 创建内容容器
    const contentWrapper = document.createElement('div');
    contentWrapper.style.cssText = `
      flex: 1;
      overflow-y: auto;
    `;

    // 按顺序添加元素
    content.appendChild(closeBtn);
    content.appendChild(title);
    content.appendChild(tabContainer);
    content.appendChild(contentWrapper);

    // 创建三个内容面板
    const content1 = document.createElement('div');
    content1.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 30px;
      margin-top: 20px;
    `;

    // T vs L 图表和问题
    const leftColumn1 = document.createElement('div');
    leftColumn1.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 20px;
    `;

    // T vs L 图表容器
    const chart1Container = document.createElement('div');
    chart1Container.style.cssText = `
      border: 2px solid #e0e0e0;
      border-radius: 15px;
      padding: 30px;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      margin: 20px 0;
    `;

    const chart1Title = document.createElement('h3');
    chart1Title.textContent = 'T vs L 散点图与曲线拟合';
    chart1Title.style.cssText = `
      text-align: center;
      margin-bottom: 20px;
      color: #2c3e50;
      font-size: 1.4rem;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(44, 62, 80, 0.1);
    `;

    const chart1Canvas = document.createElement('canvas');
    chart1Canvas.id = 'chart1';
    chart1Canvas.width = 600;
    chart1Canvas.height = 400;
    chart1Canvas.style.cssText = `
      width: 100%;
      max-width: 600px;
      height: auto;
      aspect-ratio: 3/2;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: white;
      margin: 0 auto;
      display: block;
    `;
    // 隐藏占位图
    chart1Canvas.style.display = 'none';

    chart1Container.appendChild(chart1Title);
    chart1Container.appendChild(chart1Canvas);
    // 使用真实数据生成图表，隐藏示例图
    const imgTL = document.createElement('img');
    imgTL.src = '可视化分析/T-L曲线拟合.png';
    imgTL.alt = 'T-L曲线拟合';
    imgTL.style.cssText = 'display:none;max-width:600px;width:100%;margin:12px auto;border-radius:8px;border:1px solid #ddd;background:#fff;';
    chart1Container.appendChild(imgTL);
    
    // 显示真实数据生成的图表
    chart1Canvas.style.display = 'block';

    // 问题1 - 美化后的样式
    const question1Container = document.createElement('div');
    question1Container.style.cssText = `
      border: 2px solid #ff6b6b;
      border-radius: 15px;
      padding: 25px;
      background: linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%);
      box-shadow: 0 4px 15px rgba(255, 107, 107, 0.15);
      margin: 15px 0;
      position: relative;
      overflow: hidden;
    `;

    // 添加装饰性边框
    const question1Border = document.createElement('div');
    question1Border.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #ff6b6b, #ff8a80, #ff6b6b);
    `;
    question1Container.appendChild(question1Border);

    const question1 = document.createElement('p');
    question1.textContent = '为什么是曲线不是直线？能否找到一种方法，让数据变成线性关系？';
    question1.style.cssText = `
      font-weight: 700;
      color: #d32f2f;
      margin-bottom: 20px;
      font-size: 1.2rem;
      line-height: 1.5;
      text-align: center;
      text-shadow: 0 1px 2px rgba(211, 50, 47, 0.1);
    `;

    const answer1 = document.createElement('textarea');
    answer1.placeholder = '请在这里输入你的思考...';
    answer1.style.cssText = `
      width: calc(100% - 20px);
      min-height: 100px;
      padding: 15px;
      border: 2px solid #ffcdd2;
      border-radius: 10px;
      resize: vertical;
      font-family: 'Microsoft YaHei', Arial, sans-serif;
      font-size: 1rem;
      line-height: 1.6;
      background: #ffffff;
      color: #333;
      transition: all 0.3s ease;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
    `;

    // 添加输入框焦点效果
    answer1.addEventListener('focus', () => {
      answer1.style.borderColor = '#ff6b6b';
      answer1.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05), 0 0 0 3px rgba(255, 107, 107, 0.1)';
    });

    answer1.addEventListener('blur', () => {
      answer1.style.borderColor = '#ffcdd2';
      answer1.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05)';
    });

    question1Container.appendChild(question1);
    question1Container.appendChild(answer1);

    leftColumn1.appendChild(chart1Container);
    leftColumn1.appendChild(question1Container);

    // T vs √L 图表和问题
    const rightColumn1 = document.createElement('div');
    rightColumn1.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 20px;
    `;

    // 理论说明 - 美化后的样式
    const theoryContainer1 = document.createElement('div');
    theoryContainer1.style.cssText = `
      border: 2px solid #4caf50;
      border-radius: 15px;
      padding: 25px;
      background: linear-gradient(135deg, #f1f8e9 0%, #e8f5e8 100%);
      box-shadow: 0 4px 15px rgba(76, 175, 80, 0.15);
      margin: 15px 0;
      position: relative;
      overflow: hidden;
    `;

    // 添加装饰性边框
    const theory1Border = document.createElement('div');
    theory1Border.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #4caf50, #66bb6a, #4caf50);
    `;
    theoryContainer1.appendChild(theory1Border);

    const theoryText1 = document.createElement('p');
    theoryText1.innerHTML = '<strong>单摆周期公式：</strong>T = 2π√(L/g)<br><br>对L开根号后：T = (2π/√g)·√L，呈线性关系';
    theoryText1.style.cssText = `
      color: #2e7d32;
      font-size: 1.2rem;
      line-height: 1.6;
      text-align: center;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(46, 125, 50, 0.1);
    `;

    theoryContainer1.appendChild(theoryText1);

    // T vs √L 图表容器
    const chart2Container = document.createElement('div');
    chart2Container.style.cssText = `
      border: 2px solid #e0e0e0;
      border-radius: 15px;
      padding: 30px;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      margin: 20px 0;
    `;

    const chart2Title = document.createElement('h3');
    chart2Title.textContent = 'T vs √L 散点图与线性拟合';
    chart2Title.style.cssText = `
      text-align: center;
      margin-bottom: 20px;
      color: #2c3e50;
      font-size: 1.4rem;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(44, 62, 80, 0.1);
    `;

    const chart2Canvas = document.createElement('canvas');
    chart2Canvas.id = 'chart2';
    chart2Canvas.width = 600;
    chart2Canvas.height = 400;
    chart2Canvas.style.cssText = `
      width: 100%;
      max-width: 600px;
      height: auto;
      aspect-ratio: 3/2;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: white;
      margin: 0 auto;
      display: block;
    `;
    // 隐藏占位图
    chart2Canvas.style.display = 'none';

    chart2Container.appendChild(chart2Title);
    chart2Container.appendChild(chart2Canvas);
    // 使用真实数据生成图表，隐藏示例图
    const imgSqrt = document.createElement('img');
    imgSqrt.src = '可视化分析/T-根号L直线拟合.png';
    imgSqrt.alt = 'T-根号L直线拟合';
    imgSqrt.style.cssText = 'display:none;max-width:600px;width:100%;margin:12px auto;border-radius:8px;border:1px solid #ddd;background:#fff;';
    chart2Container.appendChild(imgSqrt);
    
    // 显示真实数据生成的图表
    chart2Canvas.style.display = 'block';

    // 问题2 - 美化后的样式
    const question2Container = document.createElement('div');
    question2Container.style.cssText = `
      border: 2px solid #ff6b6b;
      border-radius: 15px;
      padding: 25px;
      background: linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%);
      box-shadow: 0 4px 15px rgba(255, 107, 107, 0.15);
      margin: 15px 0;
      position: relative;
      overflow: hidden;
    `;

    // 添加装饰性边框
    const question2Border = document.createElement('div');
    question2Border.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #ff6b6b, #ff8a80, #ff6b6b);
    `;
    question2Container.appendChild(question2Border);

    const question2 = document.createElement('p');
    question2.textContent = '为什么选择√L？是否有其他方法得到线性？';
    question2.style.cssText = `
      font-weight: 700;
      color: #d32f2f;
      margin-bottom: 20px;
      font-size: 1.2rem;
      line-height: 1.5;
      text-align: center;
      text-shadow: 0 1px 2px rgba(211, 50, 47, 0.1);
    `;

    const answer2 = document.createElement('textarea');
    answer2.placeholder = '请在这里输入你的思考...';
    answer2.style.cssText = `
      width: calc(100% - 20px);
      min-height: 100px;
      padding: 15px;
      border: 2px solid #ffcdd2;
      border-radius: 10px;
      resize: vertical;
      font-family: 'Microsoft YaHei', Arial, sans-serif;
      font-size: 1rem;
      line-height: 1.6;
      background: #ffffff;
      color: #333;
      transition: all 0.3s ease;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
    `;

    // 添加输入框焦点效果
    answer2.addEventListener('focus', () => {
      answer2.style.borderColor = '#ff6b6b';
      answer2.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05), 0 0 0 3px rgba(255, 107, 107, 0.1)';
    });

    answer2.addEventListener('blur', () => {
      answer2.style.borderColor = '#ffcdd2';
      answer2.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05)';
    });

    question2Container.appendChild(question2);
    question2Container.appendChild(answer2);

    rightColumn1.appendChild(theoryContainer1);
    rightColumn1.appendChild(chart2Container);
    rightColumn1.appendChild(question2Container);

    // 将所有内容垂直排列，而不是左右分列
    content1.appendChild(leftColumn1);
    content1.appendChild(rightColumn1);

    const content2 = document.createElement('div');
    content2.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 30px;
      margin-top: 20px;
      display: none;
    `;

    // g vs L 图
    const leftColumn2 = document.createElement('div');
    leftColumn2.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 20px;
    `;

    // 理论说明 - 美化后的样式
    const theoryContainer2 = document.createElement('div');
    theoryContainer2.style.cssText = `
      border: 2px solid #4caf50;
      border-radius: 15px;
      padding: 25px;
      background: linear-gradient(135deg, #f1f8e9 0%, #e8f5e8 100%);
      box-shadow: 0 4px 15px rgba(76, 175, 80, 0.15);
      margin: 15px 0;
      position: relative;
      overflow: hidden;
    `;

    // 添加装饰性边框
    const theory2Border = document.createElement('div');
    theory2Border.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #4caf50, #66bb6a, #4caf50);
    `;
    theoryContainer2.appendChild(theory2Border);

    const theoryText2 = document.createElement('p');
    theoryText2.innerHTML = '<strong>重力加速度计算公式：</strong>g = 4π²L/T²<br><br>当地标准重力加速度：9.873 m/s²';
    theoryText2.style.cssText = `
      color: #2e7d32;
      font-size: 1.2rem;
      line-height: 1.6;
      text-align: center;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(46, 125, 50, 0.1);
    `;

    theoryContainer2.appendChild(theoryText2);

    // g vs L 图表容器
    const chart3Container = document.createElement('div');
    chart3Container.style.cssText = `
      border: 2px solid #e0e0e0;
      border-radius: 15px;
      padding: 30px;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      margin: 20px 0;
    `;

    const chart3Title = document.createElement('h3');
    chart3Title.textContent = 'g vs L 散点图与曲线拟合';
    chart3Title.style.cssText = `
      text-align: center;
      margin-bottom: 20px;
      color: #2c3e50;
      font-size: 1.4rem;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(44, 62, 80, 0.1);
    `;

    const chart3Canvas = document.createElement('canvas');
    chart3Canvas.id = 'chart3';
    chart3Canvas.width = 600;
    chart3Canvas.height = 400;
    chart3Canvas.style.cssText = `
      width: 100%;
      max-width: 600px;
      height: auto;
      aspect-ratio: 3/2;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: white;
      margin: 0 auto;
      display: block;
    `;
    // 隐藏占位图
    chart3Canvas.style.display = 'none';

    chart3Container.appendChild(chart3Title);
    chart3Container.appendChild(chart3Canvas);
    // 使用真实数据生成图表，隐藏示例图
    const imgGL = document.createElement('img');
    imgGL.src = '可视化分析/g与L的关系.png';
    imgGL.alt = 'g与L的关系';
    imgGL.style.cssText = 'display:none;max-width:600px;width:100%;margin:12px auto;border-radius:8px;border:1px solid #ddd;background:#fff;';
    chart3Container.appendChild(imgGL);
    
    // 显示真实数据生成的图表
    chart3Canvas.style.display = 'block';

    leftColumn2.appendChild(theoryContainer2);
    leftColumn2.appendChild(chart3Container);

    // 问题和解释 - 竖向排列，每行一个框
    const rightColumn2 = document.createElement('div');
    rightColumn2.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 25px;
      width: 100%;
    `;

    // 误差解释 - 美化后的样式，独占一行
    const errorExplanation = document.createElement('div');
    errorExplanation.style.cssText = `
      border: 2px solid #ff9800;
      border-radius: 15px;
      padding: 25px;
      background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
      box-shadow: 0 4px 15px rgba(255, 152, 0, 0.15);
      margin: 0;
      position: relative;
      overflow: hidden;
      width: 100%;
    `;

    // 添加装饰性边框
    const errorBorder = document.createElement('div');
    errorBorder.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #ff9800, #ffb74d, #ff9800);
    `;
    errorExplanation.appendChild(errorBorder);

    const errorText = document.createElement('p');
    errorText.innerHTML = '短摆长下摆速较快，光束覆盖区域的时间差会放大误差。会导致周期有微弱变大会导致重力加速度偏小';
    errorText.style.cssText = `
      color: #e65100;
      font-size: 1.2rem;
      line-height: 1.6;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(230, 81, 0, 0.1);
    `;

    errorExplanation.appendChild(errorText);

    // 问题4 - 美化后的样式，独占一行
    const question4Container = document.createElement('div');
    question4Container.style.cssText = `
      border: 2px solid #ff6b6b;
      border-radius: 15px;
      padding: 25px;
      background: linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%);
      box-shadow: 0 4px 15px rgba(255, 107, 107, 0.15);
      margin: 0;
      position: relative;
      overflow: hidden;
      width: 100%;
    `;

    // 添加装饰性边框
    const question4Border = document.createElement('div');
    question4Border.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #ff6b6b, #ff8a80, #ff6b6b);
    `;
    question4Container.appendChild(question4Border);

    const question4 = document.createElement('p');
    question4.textContent = '已知当地的g为9.873，为什么g在小摆长和大摆长时偏小，中摆长时稳定？';
    question4.style.cssText = `
      font-weight: 700;
      color: #d32f2f;
      margin-bottom: 20px;
      font-size: 1.2rem;
      line-height: 1.5;
      text-align: center;
      text-shadow: 0 1px 2px rgba(211, 50, 47, 0.1);
    `;

    const answer4 = document.createElement('textarea');
    answer4.placeholder = '请在这里输入你的思考...';
    answer4.style.cssText = `
      width: calc(100% - 20px);
      min-height: 100px;
      padding: 15px;
      border: 2px solid #ffcdd2;
      border-radius: 10px;
      resize: vertical;
      font-family: 'Microsoft YaHei', Arial, sans-serif;
      font-size: 1rem;
      line-height: 1.6;
      background: #ffffff;
      color: #333;
      transition: all 0.3s ease;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
    `;

    // 添加输入框焦点效果
    answer4.addEventListener('focus', () => {
      answer4.style.borderColor = '#ff6b6b';
      answer4.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05), 0 0 0 3px rgba(255, 107, 107, 0.1)';
    });

    answer4.addEventListener('blur', () => {
      answer4.style.borderColor = '#ffcdd2';
      answer4.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05)';
    });

    question4Container.appendChild(question4);
    question4Container.appendChild(answer4);

    // 问题5 - 美化后的样式，独占一行
    const question5Container = document.createElement('div');
    question5Container.style.cssText = `
      border: 2px solid #ff6b6b;
      border-radius: 15px;
      padding: 25px;
      background: linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%);
      box-shadow: 0 4px 15px rgba(255, 107, 107, 0.15);
      margin: 0;
      position: relative;
      overflow: hidden;
      width: 100%;
    `;

    // 添加装饰性边框
    const question5Border = document.createElement('div');
    question5Border.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #ff6b6b, #ff8a80, #ff6b6b);
    `;
    question5Container.appendChild(question5Border);

    const question5 = document.createElement('p');
    question5.textContent = '长摆长下阻力更明显，同时摆绳并非完全刚性，在实验过程中会出现微小伸缩，并在长摆长下更明显？';
    question5.style.cssText = `
      font-weight: 700;
      color: #d32f2f;
      margin-bottom: 20px;
      font-size: 1.2rem;
      line-height: 1.5;
      text-align: center;
      text-shadow: 0 1px 2px rgba(211, 50, 47, 0.1);
    `;

    const answer5 = document.createElement('textarea');
    answer5.placeholder = '请在这里输入你的思考...';
    answer5.style.cssText = `
      width: calc(100% - 20px);
      min-height: 100px;
      padding: 15px;
      border: 2px solid #ffcdd2;
      border-radius: 10px;
      resize: vertical;
      font-family: 'Microsoft YaHei', Arial, sans-serif;
      font-size: 1rem;
      line-height: 1.6;
      background: #ffffff;
      color: #333;
      transition: all 0.3s ease;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
    `;

    // 添加输入框焦点效果
    answer5.addEventListener('focus', () => {
      answer5.style.borderColor = '#ff6b6b';
      answer5.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05), 0 0 0 3px rgba(255, 107, 107, 0.1)';
    });

    answer5.addEventListener('blur', () => {
      answer5.style.borderColor = '#ffcdd2';
      answer5.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05)';
    });

    question5Container.appendChild(question5);
    question5Container.appendChild(answer5);

    rightColumn2.appendChild(errorExplanation);
    rightColumn2.appendChild(question4Container);
    rightColumn2.appendChild(question5Container);

    // 将所有内容垂直排列，而不是左右分列
    content2.appendChild(leftColumn2);
    content2.appendChild(rightColumn2);

    const content3 = document.createElement('div');
    content3.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 30px;
      margin-top: 20px;
      display: none;
    `;

    // 小摆角分析
    const leftColumn3 = document.createElement('div');
    leftColumn3.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 20px;
    `;

    // 小摆角图表容器
    const chart4Container = document.createElement('div');
    chart4Container.style.cssText = `
      border: 2px solid #e0e0e0;
      border-radius: 15px;
      padding: 30px;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      margin: 20px 0;
    `;

    const chart4Title = document.createElement('h3');
    chart4Title.textContent = '小摆角下的周期变化 (1-10°)';
    chart4Title.style.cssText = `
      text-align: center;
      margin-bottom: 20px;
      color: #2c3e50;
      font-size: 1.4rem;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(44, 62, 80, 0.1);
    `;

    const chart4Canvas = document.createElement('canvas');
    chart4Canvas.id = 'chart4';
    chart4Canvas.width = 600;
    chart4Canvas.height = 400;
    chart4Canvas.style.cssText = `
      width: 100%;
      max-width: 600px;
      height: auto;
      aspect-ratio: 3/2;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: white;
      margin: 0 auto;
      display: block;
    `;
    // 隐藏占位图
    chart4Canvas.style.display = 'none';

    chart4Container.appendChild(chart4Title);
    chart4Container.appendChild(chart4Canvas);
    // 使用真实数据生成图表，隐藏示例图
    const imgTheta = document.createElement('img');
    imgTheta.src = '可视化分析/摆角与周期关系.png';
    imgTheta.alt = '摆角与周期关系';
    imgTheta.style.cssText = 'display:none;max-width:600px;width:100%;margin:12px auto;border-radius:8px;border:1px solid #ddd;background:#fff;';
    chart4Container.appendChild(imgTheta);
    
    // 显示真实数据生成的图表
    chart4Canvas.style.display = 'block';

    // 问题7 - 美化后的样式
    const question7Container = document.createElement('div');
    question7Container.style.cssText = `
      border: 2px solid #ff6b6b;
      border-radius: 15px;
      padding: 25px;
      background: linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%);
      box-shadow: 0 4px 15px rgba(255, 107, 107, 0.15);
      margin: 15px 0;
      position: relative;
      overflow: hidden;
    `;

    // 添加装饰性边框
    const question7Border = document.createElement('div');
    question7Border.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #ff6b6b, #ff8a80, #ff6b6b);
    `;
    question7Container.appendChild(question7Border);

    const question7 = document.createElement('p');
    question7.textContent = '为什么得到的图像周期基本不变？';
    question7.style.cssText = `
      font-weight: 700;
      color: #d32f2f;
      margin-bottom: 20px;
      font-size: 1.2rem;
      line-height: 1.5;
      text-align: center;
      text-shadow: 0 1px 2px rgba(211, 50, 47, 0.1);
    `;

    const answer7 = document.createElement('textarea');
    answer7.placeholder = '请在这里输入你的思考...';
    answer7.style.cssText = `
      width: calc(100% - 20px);
      min-height: 100px;
      padding: 15px;
      border: 2px solid #ffcdd2;
      border-radius: 10px;
      resize: vertical;
      font-family: 'Microsoft YaHei', Arial, sans-serif;
      font-size: 1rem;
      line-height: 1.6;
      background: #ffffff;
      color: #333;
      transition: all 0.3s ease;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
    `;

    // 添加输入框焦点效果
    answer7.addEventListener('focus', () => {
      answer7.style.borderColor = '#ff6b6b';
      answer7.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05), 0 0 0 3px rgba(255, 107, 107, 0.1)';
    });

    answer7.addEventListener('blur', () => {
      answer7.style.borderColor = '#ffcdd2';
      answer7.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.05)';
    });

    question7Container.appendChild(question7);
    question7Container.appendChild(answer7);

    leftColumn3.appendChild(chart4Container);
    leftColumn3.appendChild(question7Container);

    // 大摆角分析
    const rightColumn3 = document.createElement('div');
    rightColumn3.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 20px;
    `;

    // 理论说明 - 美化后的样式
    const theoryContainer3 = document.createElement('div');
    theoryContainer3.style.cssText = `
      border: 2px solid #ff9800;
      border-radius: 15px;
      padding: 25px;
      background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
      box-shadow: 0 4px 15px rgba(255, 152, 0, 0.15);
      margin: 15px 0;
      position: relative;
      overflow: hidden;
    `;

    // 添加装饰性边框
    const theory3Border = document.createElement('div');
    theory3Border.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #ff9800, #ffb74d, #ff9800);
    `;
    theoryContainer3.appendChild(theory3Border);

    const theoryText3 = document.createElement('p');
    theoryText3.innerHTML = '大摆角下sinθ≠θ<br>单摆不再做简谐运动而是非线性运动，周期也需要进行角度修正。';
    theoryText3.style.cssText = `
      color: #e65100;
      font-size: 1.2rem;
      line-height: 1.6;
      text-align: center;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(230, 81, 0, 0.1);
    `;

    theoryContainer3.appendChild(theoryText3);

    // 只添加理论说明，不添加图表和问题
    rightColumn3.appendChild(theoryContainer3);

    // 将所有内容垂直排列，而不是左右分列
    content3.appendChild(leftColumn3);
    content3.appendChild(rightColumn3);

    // 将内容面板添加到contentWrapper
    contentWrapper.appendChild(content1);
    contentWrapper.appendChild(content2);
    contentWrapper.appendChild(content3);

    // 标签页切换逻辑
    tab1.onclick = () => {
      setActiveTab(tab1);
      content1.style.display = 'flex';
      content2.style.display = 'none';
      content3.style.display = 'none';
    };

    tab2.onclick = () => {
      setActiveTab(tab2);
      content1.style.display = 'none';
      content2.style.display = 'flex';
      content3.style.display = 'none';
    };

    tab3.onclick = () => {
      setActiveTab(tab3);
      content1.style.display = 'none';
      content2.style.display = 'none';
      content3.style.display = 'flex';
    };

    // 设置默认激活的标签页
    setActiveTab(tab1);
    content1.style.display = 'flex';
    content2.style.display = 'none';
    content3.style.display = 'none';

    modal.appendChild(content);
    document.body.appendChild(modal);

    // 绘制图表
    this.drawCharts(data);
  },

  /**
   * 绘制图表
   */
  drawCharts(data) {
    console.log('drawCharts被调用，数据:', data);
    console.log('window.experimentGroups:', window.experimentGroups);
    
    if (!data || data.length === 0) {
      console.log('没有数据，显示提示信息');
      // 如果没有数据，显示提示信息
      const chart1 = document.getElementById('chart1');
      const chart2 = document.getElementById('chart2');
      const chart3 = document.getElementById('chart3');
      const chart4 = document.getElementById('chart4');
      
      if (chart1) {
        const ctx1 = chart1.getContext('2d');
        ctx1.fillStyle = '#f0f0f0';
        ctx1.fillRect(0, 0, chart1.width, chart1.height);
        ctx1.fillStyle = '#666';
        ctx1.font = '16px Arial';
        ctx1.textAlign = 'center';
        ctx1.fillText('暂无实验数据', chart1.width/2, chart1.height/2);
      }
      
      if (chart2) {
        const ctx2 = chart2.getContext('2d');
        ctx2.fillStyle = '#f0f0f0';
        ctx2.fillRect(0, 0, chart2.width, chart2.height);
        ctx2.fillStyle = '#666';
        ctx2.font = '16px Arial';
        ctx2.textAlign = 'center';
        ctx2.fillText('暂无实验数据', chart2.width/2, chart2.height/2);
      }
      
      if (chart3) {
        const ctx3 = chart3.getContext('2d');
        ctx3.fillStyle = '#f0f0f0';
        ctx3.fillRect(0, 0, chart3.width, chart3.height);
        ctx3.fillStyle = '#666';
        ctx3.font = '16px Arial';
        ctx3.textAlign = 'center';
        ctx3.fillText('暂无实验数据', chart3.width/2, chart3.height/2);
      }
      
      if (chart4) {
        const ctx4 = chart4.getContext('2d');
        ctx4.fillStyle = '#f0f0f0';
        ctx4.fillRect(0, 0, chart4.width, chart4.height);
        ctx4.fillStyle = '#666';
        ctx4.font = '16px Arial';
        ctx4.textAlign = 'center';
        ctx4.fillText('暂无小摆角数据', chart4.width/2, chart4.height/2);
      }
      return;
    }

    console.log('开始绘制图表，数据点数量:', data.length);
    console.log('数据示例:', data[0]);

    // 延迟绘制图表，确保DOM元素已准备好
    setTimeout(() => {
      // 绘制第一个图表：T vs L
      this.drawTvsLChart(data);
      
      // 绘制第二个图表：T vs √L
      this.drawTvsSqrtLChart(data);

      // 绘制第三个图表：g vs L
      this.drawGvsLChart(data);

      // 绘制第四个图表：T vs θ
      this.drawTvsSmallThetaChart(data);
    }, 100);
  },

  /**
   * 绘制 T vs L 图表
   */
  drawTvsLChart(data, canvasArg) {
    const canvas = canvasArg || document.getElementById('chart1');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 添加调试信息
    console.log('drawTvsLChart被调用，数据:', data);
    console.log('数据长度:', data.length);
    
    if (!data || data.length === 0) {
      console.log('没有数据，显示提示');
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('暂无实验数据', width/2, height/2);
      return;
    }
    
    // 设置边距
    const margin = 60;
    const plotWidth = width - 2 * margin;
    const plotHeight = height - 2 * margin;
    
    // 找出数据范围
    const lengths = data.map(d => d.length);
    const periods = data.map(d => d.period);
    const minLength = Math.min(...lengths);
    const maxLength = Math.max(...lengths);
    const minPeriod = Math.min(...periods);
    const maxPeriod = Math.max(...periods);
    
    console.log('数据范围:', { minLength, maxLength, minPeriod, maxPeriod });
    
    // 设置合理的显示范围，确保从0开始或包含0
    let displayMinLength, displayMaxLength, displayMinPeriod, displayMaxPeriod;
    
    // 摆长范围：从0开始或从最小摆长开始，确保有足够范围
    if (minLength <= 0) {
      displayMinLength = 0;
    } else {
      displayMinLength = Math.max(0, minLength - (maxLength - minLength) * 0.1);
    }
    displayMaxLength = maxLength + (maxLength - minLength) * 0.1;
    
    // 周期范围：从0开始或从最小周期开始
    if (minPeriod <= 0) {
      displayMinPeriod = 0;
    } else {
      displayMinPeriod = Math.max(0, minPeriod - (maxPeriod - minPeriod) * 0.1);
    }
    displayMaxPeriod = maxPeriod + (maxPeriod - minPeriod) * 0.1;
    
    const displayLengthRange = displayMaxLength - displayMinLength;
    const displayPeriodRange = displayMaxPeriod - displayMinPeriod;
    
    // 绘制背景网格
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    
    // 垂直网格线
    for (let i = 0; i <= 10; i++) {
      const x = margin + (i / 10) * plotWidth;
      ctx.beginPath();
      ctx.moveTo(x, margin);
      ctx.lineTo(x, height - margin);
      ctx.stroke();
    }
    
    // 水平网格线
    for (let i = 0; i <= 10; i++) {
      const y = margin + (i / 10) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(width - margin, y);
      ctx.stroke();
    }
    
    // 坐标轴
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();
    
    // 绘制坐标轴刻度
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // X轴刻度
    const xTicks = 6;
    for (let i = 0; i <= xTicks; i++) {
      const length = displayMinLength + (displayMaxLength - displayMinLength) * i / xTicks;
      const x = margin + (length - displayMinLength) / displayLengthRange * plotWidth;
      const y = height - margin;
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 5);
      ctx.stroke();
      
      // 绘制刻度标签
      const label = length.toFixed(1);
      ctx.fillText(label, x, y + 20);
    }
    
    // Y轴刻度
    const yTicks = 6;
    for (let i = 0; i <= yTicks; i++) {
      const period = displayMaxPeriod - (displayMaxPeriod - displayMinPeriod) * i / yTicks;
      const x = margin;
      const y = margin + (period - displayMinPeriod) / displayPeriodRange * plotHeight;
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y);
      ctx.stroke();
      
      // 绘制刻度标签
      ctx.textAlign = 'right';
      const label = period.toFixed(2);
      ctx.fillText(label, x - 10, y + 4);
    }
    
    // 绘制散点
    ctx.fillStyle = '#ff6b6b';
    ctx.strokeStyle = '#d32f2f';
    ctx.lineWidth = 1;
    data.forEach(d => {
      const x = margin + (d.length - displayMinLength) / displayLengthRange * plotWidth;
      const y = height - margin - (d.period - displayMinPeriod) / displayPeriodRange * plotHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });
    
    // 绘制理论曲线
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const length = displayMinLength + displayLengthRange * i / steps;
      const period = 2 * Math.PI * Math.sqrt(length / 100 / 9.8);
      const x = margin + (length - displayMinLength) / displayLengthRange * plotWidth;
      const y = height - margin - (period - displayMinPeriod) / displayPeriodRange * plotHeight;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // 添加图例
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    
    // 散点图例
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(margin + 10, margin + 10, 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#d32f2f';
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('实验数据', margin + 20, margin + 15);
    
    // 理论曲线图例
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(margin + 10, margin + 30);
    ctx.lineTo(margin + 30, margin + 30);
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('理论曲线 T = 2π√(L/g)', margin + 35, margin + 35);
    
    // 坐标轴标签
    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('摆长 L (cm)', width / 2, height - 15);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('周期 T (s)', 0, 0);
    ctx.restore();
  },

  /**
   * 绘制 T vs √L 图表
   */
  drawTvsSqrtLChart(data, canvasArg) {
    const canvas = canvasArg || document.getElementById('chart2');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 添加调试信息
    console.log('drawTvsSqrtLChart被调用，数据:', data);
    console.log('数据长度:', data.length);
    
    if (!data || data.length === 0) {
      console.log('没有数据，显示提示');
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('暂无实验数据', width/2, height/2);
      return;
    }
    
    // 设置边距
    const margin = 60;
    const plotWidth = width - 2 * margin;
    const plotHeight = height - 2 * margin;
    
    // 找出数据范围
    const sqrtLengths = data.map(d => d.sqrtLength);
    const periods = data.map(d => d.period);
    const minSqrtLength = Math.min(...sqrtLengths);
    const maxSqrtLength = Math.max(...sqrtLengths);
    const minPeriod = Math.min(...periods);
    const maxPeriod = Math.max(...periods);
    
    console.log('T vs √L 数据范围:', { minSqrtLength, maxSqrtLength, minPeriod, maxPeriod });
    
    // 设置合理的显示范围，确保从0开始
    let displayMinSqrtLength, displayMaxSqrtLength, displayMinPeriod, displayMaxPeriod;
    
    // √L范围：从0开始或从最小√L开始
    if (minSqrtLength <= 0) {
      displayMinSqrtLength = 0;
    } else {
      displayMinSqrtLength = Math.max(0, minSqrtLength - (maxSqrtLength - minSqrtLength) * 0.1);
    }
    displayMaxSqrtLength = maxSqrtLength + (maxSqrtLength - minSqrtLength) * 0.1;
    
    // 周期范围：从0开始或从最小周期开始
    if (minPeriod <= 0) {
      displayMinPeriod = 0;
    } else {
      displayMinPeriod = Math.max(0, minPeriod - (maxPeriod - minPeriod) * 0.1);
    }
    displayMaxPeriod = maxPeriod + (maxPeriod - minPeriod) * 0.1;
    
    const displaySqrtLengthRange = displayMaxSqrtLength - displayMinSqrtLength;
    const displayPeriodRange = displayMaxPeriod - displayMinPeriod;
    
    // 绘制背景网格
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    
    // 垂直网格线
    for (let i = 0; i <= 10; i++) {
      const x = margin + (i / 10) * plotWidth;
      ctx.beginPath();
      ctx.moveTo(x, margin);
      ctx.lineTo(x, height - margin);
      ctx.stroke();
    }
    
    // 水平网格线
    for (let i = 0; i <= 10; i++) {
      const y = margin + (i / 10) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(width - margin, y);
      ctx.stroke();
    }
    
    // 坐标轴
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();
    
    // 绘制坐标轴刻度
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // X轴刻度
    const xTicks = 6;
    for (let i = 0; i <= xTicks; i++) {
      const sqrtLength = displayMinSqrtLength + (displayMaxSqrtLength - displayMinSqrtLength) * i / xTicks;
      const x = margin + (sqrtLength - displayMinSqrtLength) / displaySqrtLengthRange * plotWidth;
      const y = height - margin;
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 5);
      ctx.stroke();
      
      // 绘制刻度标签
      ctx.fillText(sqrtLength.toFixed(1), x, y + 20);
    }
    
    // Y轴刻度
    const yTicks = 6;
    for (let i = 0; i <= yTicks; i++) {
      const period = displayMaxPeriod - (displayMaxPeriod - displayMinPeriod) * i / yTicks;
      const x = margin;
      const y = margin + (period - displayMinPeriod) / displayPeriodRange * plotHeight;
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y);
      ctx.stroke();
      
      // 绘制刻度标签
      ctx.textAlign = 'right';
      ctx.fillText(period.toFixed(2), x - 10, y + 4);
    }
    
    // 绘制散点
    ctx.fillStyle = '#ff6b6b';
    ctx.strokeStyle = '#d32f2f';
    ctx.lineWidth = 1;
    data.forEach(d => {
      const x = margin + (d.sqrtLength - displayMinSqrtLength) / displaySqrtLengthRange * plotWidth;
      const y = height - margin - (d.period - displayMinPeriod) / displayPeriodRange * plotHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });
    
    // 绘制线性拟合线
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const steps = 100;
    for (let i = 0; i <= steps; i++) {
      const sqrtLength = displayMinSqrtLength + displaySqrtLengthRange * i / steps;
      const period = 2 * Math.PI / Math.sqrt(9.8) * sqrtLength / 10;
      const x = margin + (sqrtLength - displayMinSqrtLength) / displaySqrtLengthRange * plotWidth;
      const y = height - margin - (period - displayMinPeriod) / displayPeriodRange * plotHeight;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // 添加图例
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    
    // 散点图例
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(margin + 10, margin + 10, 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#d32f2f';
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('实验数据', margin + 20, margin + 15);
    
    // 线性拟合图例
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(margin + 10, margin + 30);
    ctx.lineTo(margin + 30, margin + 30);
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('线性拟合 T = (2π/√g)·√L', margin + 35, margin + 35);
    
    // 坐标轴标签
    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('√L (cm^0.5)', width / 2, height - 15);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('周期 T (s)', 0, 0);
    ctx.restore();
  },

  /**
   * 绘制 g vs L 图表
   */
  drawGvsLChart(data, canvasArg) {
    const canvas = canvasArg || document.getElementById('chart3');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 设置边距
    const margin = 60;
    const plotWidth = width - 2 * margin;
    const plotHeight = height - 2 * margin;
    
    // 计算重力加速度数据
    const gData = data.map(d => ({
      length: d.length,
      g: d.gravity || 4 * Math.PI * Math.PI * d.length / 100 / (d.period * d.period)
    }));
    
    // 找出数据范围
    const lengths = gData.map(d => d.length);
    const gValues = gData.map(d => d.g);
    const minLength = Math.min(...lengths);
    const maxLength = Math.max(...lengths);
    const minG = Math.min(...gValues);
    const maxG = Math.max(...gValues);
    
    console.log('g vs L 原始数据范围:', { minLength, maxLength, minG, maxG });
    
    // 设置合理的显示范围
    let displayMinLength, displayMaxLength, displayMinG, displayMaxG;
    
    // 摆长范围：从0开始或从最小摆长开始
    if (minLength <= 0) {
      displayMinLength = 0;
    } else {
      displayMinLength = Math.max(0, minLength - (maxLength - minLength) * 0.1);
    }
    displayMaxLength = maxLength + (maxLength - minLength) * 0.1;
    
    // 重力加速度范围：设置合理的显示范围，确保有足够的差异
    const gRange = maxG - minG;
    if (gRange < 0.1) {
      // 如果g值差异很小，设置一个合理的显示范围
      const centerG = (minG + maxG) / 2;
      displayMinG = centerG - 0.05; // 上下各扩展0.05
      displayMaxG = centerG + 0.05;
    } else {
      // 正常情况下的范围设置
      displayMinG = minG - gRange * 0.1;
      displayMaxG = maxG + gRange * 0.1;
    }
    
    console.log('g vs L 显示范围:', { displayMinLength, displayMaxLength, displayMinG, displayMaxG });
    
    const displayLengthRange = displayMaxLength - displayMinLength;
    const displayGRange = displayMaxG - displayMinG;
    
    // 绘制背景网格
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    
    // 垂直网格线
    for (let i = 0; i <= 10; i++) {
      const x = margin + (i / 10) * plotWidth;
      ctx.beginPath();
      ctx.moveTo(x, margin);
      ctx.lineTo(x, height - margin);
      ctx.stroke();
    }
    
    // 水平网格线
    for (let i = 0; i <= 10; i++) {
      const y = margin + (i / 10) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(width - margin, y);
      ctx.stroke();
    }
    
    // 坐标轴
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();
    
    // 绘制坐标轴刻度
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // X轴刻度
    const xTicks = 6;
    for (let i = 0; i <= xTicks; i++) {
      const length = displayMinLength + (displayMaxLength - displayMinLength) * i / xTicks;
      const x = margin + (length - displayMinLength) / displayLengthRange * plotWidth;
      const y = height - margin;
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 5);
      ctx.stroke();
      
      // 绘制刻度标签
      ctx.fillText(length.toFixed(0), x, y + 20);
    }
    
    // Y轴刻度
    const yTicks = 6;
    for (let i = 0; i <= yTicks; i++) {
      const g = displayMinG + (displayMaxG - displayMinG) * i / yTicks;
      const x = margin;
      const y = height - margin - (g - displayMinG) / displayGRange * plotHeight;
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y);
      ctx.stroke();
      
      // 绘制刻度标签
      ctx.textAlign = 'right';
      const label = g.toFixed(2); // 保留2位小数，显示更精确
      ctx.fillText(label, x - 10, y + 4);
    }
    
    // 绘制散点
    ctx.fillStyle = '#ff6b6b';
    ctx.strokeStyle = '#d32f2f';
    ctx.lineWidth = 1;
    gData.forEach(d => {
      const x = margin + (d.length - displayMinLength) / displayLengthRange * plotWidth;
      const y = height - margin - (d.g - displayMinG) / displayGRange * plotHeight;
      
      console.log(`绘制散点: L=${d.length}, g=${d.g}, x=${x}, y=${y}`);
      
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });
    
    // 绘制理论水平线（标准重力加速度）
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const standardG = 9.79;
    const standardY = height - margin - (standardG - displayMinG) / displayGRange * plotHeight;
    ctx.moveTo(margin, standardY);
    ctx.lineTo(width - margin, standardY);
    ctx.stroke();
    

    
    // 添加图例
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    
    // 散点图例
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(margin + 10, margin + 10, 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#d32f2f';
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('实验数据', margin + 20, margin + 15);
    
    // 标准重力加速度图例
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(margin + 10, margin + 30);
    ctx.lineTo(margin + 30, margin + 30);
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('标准重力加速度 g = 9.79 m/s²', margin + 35, margin + 35);
    

    
    // 坐标轴标签
    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('摆长 L (cm)', width / 2, height - 15);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('重力加速度 g (m/s²)', 0, 0);
    ctx.restore();
  },

  /**
   * 绘制 g vs √L 图表
   */
  drawGvsSqrtLChart(data) {
    const canvas = document.getElementById('chart3b');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 设置边距
    const margin = 50;
    const plotWidth = width - 2 * margin;
    const plotHeight = height - 2 * margin;
    
    // 计算重力加速度和√L数据
    const gSqrtLData = data.map(d => ({
      sqrtLength: Math.sqrt(d.length),
      g: 4 * Math.PI * Math.PI * d.length / 100 / (d.period * d.period)
    }));
    
    // 找出数据范围
    const sqrtLengths = gSqrtLData.map(d => d.sqrtLength);
    const gValues = gSqrtLData.map(d => d.g);
    const minSqrtLength = Math.min(...sqrtLengths);
    const maxSqrtLength = Math.max(...sqrtLengths);
    const minG = Math.min(...gValues);
    const maxG = Math.max(...gValues);
    
    // 设置合理的显示范围
    let displayMinSqrtLength, displayMaxSqrtLength, displayMinG, displayMaxG;
    
    // √L范围：从0开始或从最小√L开始
    if (minSqrtLength <= 0) {
      displayMinSqrtLength = 0;
    } else {
      displayMinSqrtLength = Math.max(0, minSqrtLength - (maxSqrtLength - minSqrtLength) * 0.1);
    }
    displayMaxSqrtLength = maxSqrtLength + (maxSqrtLength - minSqrtLength) * 0.1;
    
    // 重力加速度范围
    if (minG <= 0) {
      displayMinG = 0;
    } else {
      displayMinG = Math.max(0, minG - (maxG - minG) * 0.1);
    }
    displayMaxG = maxG + (maxG - minG) * 0.1;
    
    const displaySqrtLengthRange = displayMaxSqrtLength - displayMinSqrtLength;
    const displayGRange = displayMaxG - displayMinG;
    
    // 坐标轴
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();
    
    // 绘制坐标轴刻度
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // X轴刻度（√L）
    const xTicks = 5;
    for (let i = 0; i <= xTicks; i++) {
      const sqrtLength = displayMinSqrtLength + (displayMaxSqrtLength - displayMinSqrtLength) * i / xTicks;
      const x = margin + (sqrtLength - displayMinSqrtLength) / displaySqrtLengthRange * plotWidth;
      const y = height - margin;
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 5);
      ctx.stroke();
      
      // 绘制刻度标签
      const label = sqrtLength.toFixed(1);
      ctx.fillText(label, x, y + 20);
    }
    
    // Y轴刻度（g）
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const g = displayMaxG - (displayMaxG - displayMinG) * i / yTicks;
      const x = margin;
      const y = margin + (g - displayMinG) / displayGRange * plotHeight;
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y);
      ctx.stroke();
      
      // 绘制刻度标签
      ctx.textAlign = 'right';
      const label = g.toFixed(1);
      ctx.fillText(label, x - 10, y + 4);
    }
    
    // 绘制散点
    ctx.fillStyle = '#ff6b6b';
    gSqrtLData.forEach(d => {
      const x = margin + (d.sqrtLength - displayMinSqrtLength) / displaySqrtLengthRange * plotWidth;
      const y = height - margin - (d.g - displayMinG) / displayGRange * plotHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    // 绘制理论直线：g = 4π²L/T²，其中T = 2π√(L/g)
    // 代入得：g = 4π²L/(4π²L/g) = g，所以理论上是水平线
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const standardG = 9.873;
    const standardY = height - margin - (standardG - displayMinG) / displayGRange * plotHeight;
    ctx.moveTo(margin, standardY);
    ctx.lineTo(width - margin, standardY);
    ctx.stroke();
    
    // 标签
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('√L (cm^0.5)', width / 2, height - 10);
    
    ctx.save();
    ctx.translate(10, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('重力加速度 g (m/s²)', 0, 0);
    ctx.restore();
  },

  /**
   * 绘制小摆角下的 T vs θ 图表
   */
  drawTvsSmallThetaChart(data, canvasArg) {
    const canvas = canvasArg || document.getElementById('chart4');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 设置边距
    const margin = 60;
    const plotWidth = width - 2 * margin;
    const plotHeight = height - 2 * margin;
    
    // 筛选小摆角数据（1-10°）
    const smallAngleData = data.filter(d => d.initialAngle >= 1 && d.initialAngle <= 10);
    
    if (smallAngleData.length === 0) {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('暂无小摆角数据', width/2, height/2);
      return;
    }
    
    // 找出数据范围
    const angles = smallAngleData.map(d => d.initialAngle);
    const periods = smallAngleData.map(d => d.period);
    const minAngle = Math.min(...angles);
    const maxAngle = Math.max(...angles);
    const minPeriod = Math.min(...periods);
    const maxPeriod = Math.max(...periods);
    
    // 设置合理的显示范围，确保从0开始
    let displayMinAngle, displayMaxAngle, displayMinPeriod, displayMaxPeriod;
    
    // 角度范围：从0开始到最大角度
    displayMinAngle = 0;
    displayMaxAngle = Math.max(10, maxAngle + (maxAngle - minAngle) * 0.1);
    
    // 周期范围：从0开始或从最小周期开始
    if (minPeriod <= 0) {
      displayMinPeriod = 0;
    } else {
      displayMinPeriod = Math.max(0, minPeriod - (maxPeriod - minPeriod) * 0.1);
    }
    displayMaxPeriod = maxPeriod + (maxPeriod - minPeriod) * 0.1;
    
    const displayAngleRange = displayMaxAngle - displayMinAngle;
    const displayPeriodRange = displayMaxPeriod - displayMinPeriod;
    
    // 绘制背景网格
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    
    // 垂直网格线
    for (let i = 0; i <= 10; i++) {
      const x = margin + (i / 10) * plotWidth;
      ctx.beginPath();
      ctx.moveTo(x, margin);
      ctx.lineTo(x, height - margin);
      ctx.stroke();
    }
    
    // 水平网格线
    for (let i = 0; i <= 10; i++) {
      const y = margin + (i / 10) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(width - margin, y);
      ctx.stroke();
    }
    
    // 坐标轴
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();
    
    // 绘制坐标轴刻度
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // X轴刻度（角度）
    const xTicks = 6;
    for (let i = 0; i <= xTicks; i++) {
      const angle = displayMinAngle + (displayMaxAngle - displayMinAngle) * i / xTicks;
      const x = margin + (angle - displayMinAngle) / displayAngleRange * plotWidth;
      const y = height - margin;
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 5);
      ctx.stroke();
      
      // 绘制刻度标签
      const label = angle.toFixed(1);
      ctx.fillText(label, x, y + 20);
    }
    
    // Y轴刻度（周期）
    const yTicks = 6;
    for (let i = 0; i <= yTicks; i++) {
      const period = displayMaxPeriod - (displayMaxPeriod - displayMinPeriod) * i / yTicks;
      const x = margin;
      const y = margin + (period - displayMinPeriod) / displayPeriodRange * plotHeight;
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y);
      ctx.stroke();
      
      // 绘制刻度标签
      ctx.textAlign = 'right';
      const label = period.toFixed(2);
      ctx.fillText(label, x - 10, y + 4);
    }
    
    // 绘制散点
    ctx.fillStyle = '#ff6b6b';
    ctx.strokeStyle = '#d32f2f';
    ctx.lineWidth = 1;
    smallAngleData.forEach(d => {
      const x = margin + (d.initialAngle - displayMinAngle) / displayAngleRange * plotWidth;
      const y = height - margin - (d.period - displayMinPeriod) / displayPeriodRange * plotHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });
    
    // 绘制理论水平线（小摆角下周期基本不变）
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const avgPeriod = periods.reduce((a, b) => a + b) / periods.length;
    const avgY = height - margin - (avgPeriod - displayMinPeriod) / displayPeriodRange * plotHeight;
    ctx.moveTo(margin, avgY);
    ctx.lineTo(width - margin, avgY);
    ctx.stroke();
    
    // 添加图例
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    
    // 散点图例
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(margin + 10, margin + 10, 4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#d32f2f';
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('实验数据', margin + 20, margin + 15);
    
    // 理论水平线图例
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(margin + 10, margin + 30);
    ctx.lineTo(margin + 30, margin + 30);
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.fillText('平均周期 T = ' + avgPeriod.toFixed(3) + ' s', margin + 35, margin + 35);
    
    // 坐标轴标签
    ctx.fillStyle = '#333';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('摆角 θ (°)', width / 2, height - 15);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('周期 T (s)', 0, 0);
    ctx.restore();
  },

  /**
   * 绘制 T vs θ 图表
   */
  drawTvsLargeThetaChart(data) {
    const canvas = document.getElementById('chart5');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 设置边距
    const margin = 50;
    const plotWidth = width - 2 * margin;
    const plotHeight = height - 2 * margin;
    
    // 筛选大摆角数据（30-90°）
    const largeAngleData = data.filter(d => d.initialAngle >= 30 && d.initialAngle <= 90);
    
    if (largeAngleData.length === 0) {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#666';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('暂无大摆角数据', width/2, height/2);
      return;
    }
    
    // 计算理论周期T0
    const calculateT0 = (length) => 2 * Math.PI * Math.sqrt(length / 100 / 9.8);
    
    // 处理数据，计算T/T0
    const processedData = largeAngleData.map(d => ({
      angle: d.initialAngle,
      tRatio: d.period / calculateT0(d.length)
    }));
    
    // 找出数据范围
    const angles = processedData.map(d => d.angle);
    const tRatios = processedData.map(d => d.tRatio);
    const minAngle = Math.min(...angles);
    const maxAngle = Math.max(...angles);
    const minRatio = Math.min(...tRatios);
    const maxRatio = Math.max(...tRatios);
    
    // 处理数据范围为零的情况
    const angleRange = maxAngle - minAngle;
    const ratioRange = maxRatio - minRatio;
    
    // 如果角度范围为零，设置一个小的范围来显示点
    const effectiveAngleRange = angleRange === 0 ? 10 : angleRange;
    const effectiveRatioRange = ratioRange === 0 ? 0.2 : ratioRange;
    
    // 坐标轴
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(margin, height - margin);
    ctx.lineTo(width - margin, height - margin);
    ctx.stroke();
    
    // 绘制散点
    ctx.fillStyle = '#ff6b6b';
    processedData.forEach(d => {
      const x = margin + (d.angle - minAngle) / effectiveAngleRange * plotWidth;
      const y = height - margin - (d.tRatio - minRatio) / effectiveRatioRange * plotHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    // 绘制参考线 T/T0 = 1（只有当角度范围不为零时才绘制）
    if (angleRange > 0) {
      ctx.strokeStyle = '#4caf50';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const refY = height - margin - (1 - minRatio) / ratioRange * plotHeight;
      ctx.moveTo(margin, refY);
      ctx.lineTo(width - margin, refY);
      ctx.stroke();
    }
    
    // 标签
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('摆角 θ (°)', width / 2, height - 10);
    
    ctx.save();
    ctx.translate(10, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('T/T₀', 0, 0);
    ctx.restore();
  },

  /**
   * 处理实验数据，返回用于导出/报告的数据结构
   * 依赖全局 experimentGroups
   */
  processExperimentData() {
    console.log('processExperimentData被调用');
    console.log('window.experimentGroups:', window.experimentGroups);
    
    if (!window.experimentGroups || !window.experimentGroups.length) {
      console.log('没有实验数据');
      return [];
    }
    
    const processedData = [];
    window.experimentGroups.forEach((exp, index) => {
      console.log(`处理实验${index + 1}:`, exp);
      if (exp.periods && exp.periods.length > 0) {
        // 过滤掉duration为0的周期数据
        const validPeriods = exp.periods.filter(p => p.duration > 0);
        
        if (validPeriods.length > 0) {
          const avgPeriod = validPeriods.reduce((sum, p) => sum + p.duration, 0) / validPeriods.length;
          const theoreticalPeriod = 2 * Math.PI * Math.sqrt(exp.length / 100 / 9.8);
          const sqrtLength = Math.sqrt(exp.length);
          const linearFit = 2 * Math.PI / Math.sqrt(9.8) * sqrtLength / 10;
          const processedItem = {
            length: exp.length,
            period: avgPeriod,
            theoreticalPeriod,
            sqrtLength,
            linearFit,
            initialAngle: exp.initialAngle || 0, // 添加初始角度字段
            gravity: exp.gravity || null // 添加重力加速度字段
          };
          console.log(`处理后的数据项${index + 1}:`, processedItem);
          processedData.push(processedItem);
        } else {
          console.log(`实验${index + 1}没有有效的周期数据（所有周期duration都为0）`);
        }
      } else {
        console.log(`实验${index + 1}没有周期数据`);
      }
    });
    
    console.log('最终处理的数据:', processedData);
    return processedData;
  }
};

// 添加模块导出调试信息
console.log('ExportModule模块已加载'); 
main.js
// main.js
// 主入口，负责初始化各模块
console.log('main.js开始加载 - 立即执行');

// 所有 import 语句必须在文件顶部
import { Pendulum } from './pendulum.js';
import { Camera } from './camera.js';
import { ChartModule } from './chart.js';
import { ExportModule } from './export.js';
import { Utils } from './utils.js';
import { pendulumWebSocket, AngleTimeRecorder } from './websocket-client.js';
import { AIAssistant } from './ai-assistant.js';
import { VoiceAssistant } from './voice-assistant.js';

console.log('main.js模块导入完成');
console.log('ExportModule导入状态:', typeof ExportModule);

window.PendulumApp = {
  Pendulum,
  Camera,
  Chart: ChartModule,
  Export: ExportModule,
  Utils,
  WebSocket: pendulumWebSocket,
  AngleTimeRecorder: AngleTimeRecorder,
  AIAssistant: AIAssistant,
  VoiceAssistant: VoiceAssistant,
  // 添加调试信息
  debugModules() {
    console.log('Pendulum模块:', this.Pendulum);
    console.log('Camera模块:', this.Camera);
    console.log('Chart模块:', this.Chart);
    console.log('Export模块:', this.Export);
    console.log('Utils模块:', this.Utils);
    console.log('WebSocket模块:', this.WebSocket);
    console.log('AngleTimeRecorder模块:', this.AngleTimeRecorder);
  },
  init() {
    console.log('PendulumApp.init()开始');
    try {
      this.debugModules();
    this.Pendulum.init();
      console.log('Pendulum.init()完成');
    this.Camera.init();
      console.log('Camera.init()完成');
    this.Chart.init();
      console.log('Chart.init()完成');
      console.log('准备调用Export.init()');
    this.Export.init();
      console.log('Export.init()完成');
    this.AngleTimeRecorder.init();
      console.log('AngleTimeRecorder.init()完成');
    this.AIAssistant.init();
      console.log('AIAssistant.init()完成');
    this.VoiceAssistant.init();
      console.log('VoiceAssistant.init()完成');
      console.log('PendulumApp.init()完成');
    } catch (error) {
      console.error('PendulumApp.init()执行过程中出错:', error);
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded事件触发');


  // 延迟更长时间确保DOM完全加载
  setTimeout(() => {
    try {
      console.log('准备调用PendulumApp.init()');

      // 检查关键元素是否存在
      const canvas = document.getElementById('pendulumCanvas');
      if (!canvas) {
        console.error('Canvas元素未找到，延迟重试...');
        setTimeout(() => {
          PendulumApp.init();
        }, 500);
        return;
      }

      PendulumApp.init();
      console.log('PendulumApp.init()调用完成');

    } catch (error) {
      console.error('PendulumApp.init()调用失败:', error);
    }
  }, 200);

  // 设置WebSocket连接状态指示器
  const syncStatus2 = document.getElementById('syncStatus2');
  pendulumWebSocket.onConnect(() => {
    if (syncStatus2) {
      syncStatus2.innerHTML = 'WebSocket已连接';
      syncStatus2.className = 'status-value running';
    }
    console.log('WebSocket连接已建立');
    
    // 连接成功后立即请求数据
    pendulumWebSocket.requestState();
    pendulumWebSocket.requestAngleHistory();
    pendulumWebSocket.requestPositionHistory();
    pendulumWebSocket.requestLogs();
    pendulumWebSocket.requestSerialLogs();
  });
  
  pendulumWebSocket.onDisconnect(() => {
    if (syncStatus2) {
      syncStatus2.innerHTML = 'WebSocket已断开';
      syncStatus2.className = 'status-value waiting';
    }
    console.log('WebSocket连接已断开');
  });
  
  pendulumWebSocket.onError(() => {
    if (syncStatus2) {
      syncStatus2.innerHTML = 'WebSocket错误';
      syncStatus2.className = 'status-value error';
    }
  });
  
  // 监听摆状态更新
  pendulumWebSocket.onPendulumState((state) => {
    // 将WebSocket数据传递给pendulum模块进行同步
    if (PendulumApp.Pendulum && PendulumApp.Pendulum.syncPendulumAnimation) {
      PendulumApp.Pendulum.syncPendulumAnimation(state);
    }

    // 角度记录器状态更新
    if (PendulumApp.AngleTimeRecorder) {
      PendulumApp.AngleTimeRecorder.handlePendulumState(state);
    }

    // 检查实验开始和结束
    const runStatus = document.getElementById('runStatus');
    if (runStatus) {
      if (state.isRunning) {
        runStatus.className = 'run-status running';
        runStatus.querySelector('.status-text').textContent = '运行中';
      } else {
        runStatus.className = 'run-status not-running';
        runStatus.querySelector('.status-text').textContent = '未运行';
      }
    }
    
    // 更新FPS和延迟显示
    const fpsDisplay = document.getElementById('fpsDisplay');
    const latencyDisplay = document.getElementById('latencyDisplay');
    
    if (fpsDisplay) {
      // 优先使用后端发送的FPS数据，并对显示做平滑处理，避免跳动
      const rawFps = state.fps || PendulumApp.Pendulum.currentFps || 0;
      // 初始化平滑器
      if (!window._fpsSmooth) window._fpsSmooth = { value: 0, lastUpdate: 0 };
      const alpha = 0.4; // 平滑系数（0-1），越小越平滑
      const current = Math.max(0, Math.min(60, rawFps));
      window._fpsSmooth.value = window._fpsSmooth.value === 0 ? current : (alpha * current + (1 - alpha) * window._fpsSmooth.value);
      const nowTs = Date.now();
      // 限制刷新频率，避免UI频繁抖动
      if (nowTs - window._fpsSmooth.lastUpdate >= 400) {
        const roundedFps = Math.max(0, Math.min(60, Math.round(window._fpsSmooth.value)));
        fpsDisplay.textContent = String(roundedFps);
        window._fpsSmooth.lastShown = roundedFps;
        window._fpsSmooth.lastUpdate = nowTs;
      }
      // 使用最后一次展示的值，避免变量未定义
      const displayFps = (window._fpsSmooth.lastShown !== undefined)
        ? window._fpsSmooth.lastShown
        : Math.max(0, Math.min(60, Math.round(window._fpsSmooth.value)));
      
      fpsDisplay.className = 'status-value';
      if (displayFps >= 25) {
        fpsDisplay.classList.add('running');
      } else if (displayFps >= 15) {
        fpsDisplay.classList.add('waiting');
      } else {
        fpsDisplay.classList.add('error');
      }
    }
    
    if (latencyDisplay) {
      const now = Date.now();
      // 确保时间戳是毫秒单位，并且计算正确的延迟
      const timestamp = state.timestamp || now;
      
      // 如果时间戳异常大，可能是错误的，设为0
      let latency = 0;
      if (timestamp && timestamp < 1e12) { // 如果时间戳合理
        latency = Math.abs(now - timestamp);
      }
      
      // 如果延迟异常大（超过10秒）或者是NaN，可能是时间戳错误，显示0
      if (latency > 10000 || isNaN(latency)) {
        latencyDisplay.textContent = '0ms';
      } else {
        latencyDisplay.textContent = `${Math.round(latency)}ms`;
      }
      
      latencyDisplay.className = 'status-value';
      if (latency <= 50) {
        latencyDisplay.classList.add('running');
      } else if (latency <= 150) {
        latencyDisplay.classList.add('waiting');
      } else {
        latencyDisplay.classList.add('error');
      }
    }
  });

  // 移除可能导致冲突的定时器
  // WebSocket连接后会自动接收数据，不需要主动轮询
  // setInterval(() => {
  //   if (pendulumWebSocket.connected) {
  //     pendulumWebSocket.requestState();
  //           }
  // }, 16);  // 每16ms请求一次状态更新，确保实时同步
  
  // 保留日志更新定时器，降低频率
  setInterval(() => {
    if (pendulumWebSocket.connected) {
      pendulumWebSocket.requestLogs();
      pendulumWebSocket.requestSerialLogs();
    }
  }, 2000);  // 每2秒请求一次日志更新


}); 
pendulum.js
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
   * 从后端获取摆长数据
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
          
          console.log('✅ 收到摆长数据:', data.length, 'cm');
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
   * 从后端获取角度数据
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
          console.log('收到角度数据:', data.angle);
          
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
        // 不再从摄像头同步摆长数据，摆长只通过串口信号更新
        
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
utils.js
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
voice-assistant.js
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

websocket-client.js
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
index.html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>精密单摆重力加速度测量实验平台</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <!-- 顶部导航栏 -->
    <nav class="top-nav">
        <div class="nav-title">单摆数字孪生系统</div>
    </nav>

    <div class="container">
        <!-- 左侧动画/仿真区 -->
        <section class="animation-section">
            <div class="animation-header">
                <h1 class="animation-title">单摆动画</h1>
                <div class="animation-status">
                    <div id="runStatus" class="run-status not-running">
                        <span class="status-dot"></span>
                        <span class="status-text">未运行</span>
                    </div>
                </div>
            </div>
            <div class="canvas-container">
                <div class="timer-display">实验时间: <span id="timer">0.00</span> 秒</div>
                <div class="visual-scale-info"></div>
                <canvas id="pendulumCanvas" width="1400" height="1000"></canvas>
            </div>
            
            <!-- 实时数据信息板块 -->
            <div class="pendulum-data-panel">
                <div class="data-panel-header">
                    <h3>实时数据</h3>
                </div>
                <div class="data-panel-content">
                    <div class="data-item">
                        <span class="data-label">摆长:</span>
                        <span id="pendulumLengthDisplay" class="data-value">30.0 cm</span>
                    </div>
                    <div class="data-item">
                        <span class="data-label">摆角:</span>
                        <span id="pendulumAngleDisplay" class="data-value">+0.0°</span>
                    </div>
                    <div class="data-item">
                        <span class="data-label">周期数:</span>
                        <span id="periodCountDisplay" class="data-value">0</span>
                    </div>
                </div>
            </div>
            <div class="quick-instructions">
                <div class="instructions-title">快捷操作说明</div>
                <div class="instructions-list">
                    <div class="instruction-item">左键: 设定摆心</div>
                    <div class="instruction-item">右键: 设定坐标轴零点</div>
                    <div class="instruction-item">z: 设置角度零点</div>
                    <div class="instruction-item">r: 清除数据</div>
                    <div class="instruction-item">c: 校准HSV识别</div>
                    <div class="instruction-item">d: 删除参考点和参考角度</div>
                    <div class="instruction-item">l: 启动/终止串口通信</div>
                    <div class="instruction-item">x: 导出数据为json</div>
                </div>
            </div>
        </section>
        <!-- 中间控制面板 -->
        <section class="controls-section">
            <div class="camera-container">
                <h3>摄像头画面</h3>
                <div id="cameraWrapper">
                    <img id="cameraFeed" src="http://127.0.0.1:5000/video_feed" draggable="false" />
                    <div id="roiDiv"></div>
                </div>
                <div id="syncStatus">等待摄像头数据...</div>
            </div>


            <!-- 同步状态框已移除 -->
        </section>
        <!-- 右侧图表和日志区 -->
        <section class="charts-section">
            <!-- 实验与运动控制 - 移动到右栏最上方 -->
            <div class="control-group">
                <h2>实验与运动控制</h2>
                
                <!-- 顶部实验控制按钮 -->
                <div class="modern-btn-group two-column">
                    <button id="startBtn" class="modern-btn control-primary">
                        开始实验
                    </button>
                    <button id="resetBtn" class="modern-btn control-primary">
                        结束实验
                    </button>
                </div>
                
                <!-- 电磁铁控制区域 -->
                <div class="control-section electromagnet-section">
                    <div class="control-section-title">电磁铁控制</div>
                    <div class="modern-btn-group grid-2x2">
                        <button id="d1Btn" class="modern-btn control-electromagnet">电磁铁开启</button>
                        <button id="d0Btn" class="modern-btn control-electromagnet">电磁铁关闭</button>
                        <button id="btnUpU" class="modern-btn control-electromagnet">左移电磁铁</button>
                        <button id="btnDownU" class="modern-btn control-electromagnet">右移电磁铁</button>
                    </div>
                </div>
                
                <!-- 摆线推杆控制区域 -->
                <div class="control-section pendulum-section">
                    <div class="control-section-title">摆线推杆控制</div>
                    <div class="modern-btn-group grid-2x2">
                        <button id="btnUpM" class="modern-btn control-pendulum">收摆线</button>
                        <button id="btnDownM" class="modern-btn control-pendulum">放摆线</button>
                        <button id="btnUpN" class="modern-btn control-pendulum">升推杆</button>
                        <button id="btnDownN" class="modern-btn control-pendulum">降推杆</button>
                    </div>
                </div>
                
                <!-- 数据获取区域 -->
                <div class="modern-btn-group two-column">
                    <button id="getPendulumAngleBtn" class="modern-btn control-data">
                        获取摆角数据
                    </button>
                    <button id="getPendulumLengthBtn" class="modern-btn control-data">
                        获取摆长数据
                    </button>
                </div>
                
                <!-- 底部控制区域 -->
                <div class="modern-btn-group three-column">
                    <div class="control-input-wrapper">
                        <input id="inputN" type="number" placeholder="1" class="modern-input control-input">
                    </div>
                    <button id="btnSendN" class="modern-btn control-action">设置计数次数</button>
                    <button id="btnClear" class="modern-btn control-clear">清除</button>
                </div>

            </div>



            <div class="chart-container data-flow">
                <div class="chart-title">角度-时间曲线</div>
                <div class="chart-canvas"><canvas id="angleChart"></canvas></div>
            </div>
            <div class="chart-container data-flow">
                <div class="chart-title">小球XY位置轨迹</div>
                <div class="chart-canvas"><canvas id="xyChart"></canvas></div>
                <div style="margin-top: 10px;">
                    <label style="font-size: 0.9rem; color: #94a3b8;">显示时长(秒): <span id="xyDurationValue">0.5</span></label>
                    <input type="range" id="xyDuration" min="0.1" max="2.0" value="0.5" step="0.1" style="width: 100%; margin-top: 5px;">
                </div>
            </div>
            <div class="logs-section">
                <div class="log-container">
                    <div class="log-title">串口数据日志</div>
                    <div id="serialLog" class="log-content"></div>
                </div>
                <div class="log-container">
                    <div class="log-title">后端日志</div>
                    <div id="backendLog" class="log-content"></div>
                </div>
            </div>
        </section>
    </div>
    <div id="keyToast"></div>
    <script>
      // 移除表情符号函数
      function removeEmojis(text) {
        if (!text || typeof text !== 'string') return text || '';
        try {
          return text.replace(/[\p{Emoji_Presentation}\p{Emoji}\u200D]+/gu, '');
        } catch (error) {
          // 如果正则表达式不支持，返回原文本
          return text;
        }
      }
      
      // 简单的全局错误处理器，忽略第三方扩展错误
      window.addEventListener('error', function(event) {
        if (event.filename && event.filename.includes('content_scripts.umd.min.js')) {
          console.warn('忽略第三方扩展错误:', event.message);
          event.preventDefault();
          event.stopPropagation();
          return true;
        }
      });
      
      // 捕获未处理的Promise拒绝
      window.addEventListener('unhandledrejection', function(event) {
        if (event.reason && event.reason.stack && event.reason.stack.includes('content_scripts.umd.min.js')) {
          console.warn('忽略第三方扩展Promise错误:', event.reason);
          event.preventDefault();
          event.stopPropagation();
          return true;
        }
      });
      
      document.addEventListener('DOMContentLoaded', removeEmojis);
    </script>
    <script src="js/chart.min.js"></script>
    <script type="module" src="js/websocket-client.js"></script>
    <script type="module" src="js/ai-assistant.js"></script>
    <script type="module" src="js/voice-assistant.js"></script>
    <script type="module" src="js/main.js"></script>
</body>
</html> 