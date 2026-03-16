#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
摄像头角度API接口 - 简单易用的函数封装
就像单片机库函数一样，直接调用即可
"""

from pendulum_interface_realtime import RealtimePendulumInterface
import time


# 全局接口实例
_camera_api = None


def init_camera_api(host="localhost", port=5000, show_camera=False):
    """
    初始化摄像头API接口

    Args:
        host: 后端服务器地址，默认"localhost"
        port: 后端服务器端口，默认5000
        show_camera: 是否显示摄像头窗口，默认False

    Returns:
        bool: 初始化是否成功
    """
    global _camera_api

    try:
        _camera_api = RealtimePendulumInterface(host=host, port=port)
        _camera_api.show_camera_window = show_camera

        # 检查后端状态
        if _camera_api.check_backend_status():
            print("摄像头API初始化成功")

            # 启动数据监控
            _camera_api.use_backend_only = True
            import threading
            monitor_thread = threading.Thread(target=_camera_api.data_monitor, daemon=True)
            monitor_thread.start()

            # 如果需要显示摄像头
            if show_camera:
                _camera_api.start_camera_display()

            return True
        else:
            print("后端服务不可用")
            _camera_api = None
            return False

    except Exception as e:
        print(f"初始化失败: {e}")
        _camera_api = None
        return False


def get_camera_angle():
    """
    获取摄像头角度

    Returns:
        float: 摄像头角度（度），失败返回None
    """
    if _camera_api is None:
        print("API未初始化，请先调用 init_camera_api()")
        return None

    return _camera_api.last_camera_angle


def get_pendulum_angle():
    """
    获取单摆角度

    Returns:
        float: 单摆角度（度），失败返回None
    """
    if _camera_api is None:
        print("API未初始化，请先调用 init_camera_api()")
        return None

    return _camera_api.last_angle


def get_pendulum_length():
    """
    获取摆长

    Returns:
        float: 摆长（cm），失败返回None
    """
    if _camera_api is None:
        print("API未初始化，请先调用 init_camera_api()")
        return None

    return _camera_api.data.length


def get_pendulum_period():
    """
    获取单摆周期

    Returns:
        float: 周期（秒），失败返回None
    """
    if _camera_api is None:
        print("API未初始化，请先调用 init_camera_api()")
        return None

    return _camera_api.data.period


def get_all_data():
    """
    获取所有数据

    Returns:
        dict: 包含所有数据的字典
    """
    if _camera_api is None:
        print("API未初始化，请先调用 init_camera_api()")
        return None

    return _camera_api.get_current_data()


def show_camera(show=True):
    """
    显示或隐藏摄像头窗口

    Args:
        show: True显示，False隐藏
    """
    if _camera_api is None:
        print("API未初始化，请先调用 init_camera_api()")
        return

    if show and not _camera_api.show_camera_window:
        _camera_api.show_camera_window = True
        _camera_api.start_camera_display()
    elif not show and _camera_api.show_camera_window:
        _camera_api.show_camera_window = False
        _camera_api.camera_display_running = False


def close_camera_api():
    """
    关闭摄像头API接口
    """
    global _camera_api

    if _camera_api is not None:
        _camera_api.close()
        _camera_api = None
        print("摄像头API已关闭")


# 便捷函数
def quick_start():
    """
    快速启动 - 使用默认参数初始化
    """
    return init_camera_api(show_camera=False)


# 示例使用
if __name__ == "__main__":
    print("=== 摄像头API接口测试 ===\n")

    # 1. 初始化
    print("1. 初始化API...")
    if quick_start():
        print("初始化成功\n")

        # 2. 获取数据
        print("2. 获取数据...")
        for i in range(10):
            angle = get_camera_angle()
            pendulum_angle = get_pendulum_angle()
            length = get_pendulum_length()

            print(f"[{i+1:2d}] 摄像头: {angle:+6.2f}° | 单摆: {pendulum_angle:+6.2f}° | 摆长: {length:.1f}cm")
            time.sleep(0.5)

        # 3. 获取所有数据
        print("\n3. 获取所有数据...")
        all_data = get_all_data()
        if all_data:
            print(f"   后端状态: {'可用' if all_data['backend_available'] else '不可用'}")
            print(f"   最后更新时间: {all_data['last_update_time']}")

        # 4. 关闭
        print("\n4. 关闭API...")
        close_camera_api()

    else:
        print("初始化失败")