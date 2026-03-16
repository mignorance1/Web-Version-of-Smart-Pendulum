#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
快速摄像头角度测试
"""

from camera_api import init_camera_api, get_camera_angle, close_camera_api
import time

# 初始化
init_camera_api()

# 获取10次角度数据
print("开始获取摄像头角度数据...")
for i in range(10):
    angle = get_camera_angle()
    if angle is not None:
        print(f"第{i+1}次: {angle:+7.2f}°")
    else:
        print(f"第{i+1}次: 获取失败")
    time.sleep(0.5)

# 关闭
close_camera_api()
print("测试完成")