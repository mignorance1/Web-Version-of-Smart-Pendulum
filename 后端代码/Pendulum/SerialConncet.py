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


    @classmethod
    def auto_select_CH340(cls):
        """
        自动选择并匹配所有USB-SERIAL CH340设备。
        :return: 返回所有匹配的 CH340 设备信息的列表
        """
        if not cls._ports:
            cls.listPorts()
        # 获取所有串口设备
        for port in cls._ports:

            # 过滤出CH340设备
            if "CH340" in port.description or "CH340" in port.hwid:
                logger.info(f"找到 CH340 设备: {port.device}")
                cls._selected_port = port.device
                logger.info("找到第一个CH340")
                return
        logger.warning(f"串口设置未发生改变: {cls._selected_port}")






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

