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
        "angle": 0.0,           # 单片机角度
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
