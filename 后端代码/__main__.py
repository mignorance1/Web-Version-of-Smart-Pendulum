import os
import time
from Pendulum import HelpUI, App_Pendulum, Serial_PortManager, Serial_Daemon
from Pendulum.WebSocketServer import start_server

# 可视化分析图片配置
# 1: 使用静态图片（可视化分析文件夹中的图片）
# 0: 使用实验数据动态生成的图片
USE_STATIC_CHARTS = 1

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
        Serial_PortManager.auto_select_CH340()
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
