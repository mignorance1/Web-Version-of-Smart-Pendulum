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