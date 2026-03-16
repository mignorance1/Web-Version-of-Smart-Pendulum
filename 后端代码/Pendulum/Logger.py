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
