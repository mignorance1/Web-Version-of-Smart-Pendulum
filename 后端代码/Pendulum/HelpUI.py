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
