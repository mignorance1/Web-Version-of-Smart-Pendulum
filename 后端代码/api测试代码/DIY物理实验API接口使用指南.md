# DIY物理实验API接口使用指南

本文档详细介绍了如何使用摄像头识别系统进行DIY物理实验的数据获取。系统提供了多种数据获取方式，支持角度、周期、摆长、时间等物理量的实时采集。



[TOC]

## 一、系统架构

系统基于Flask后端 + OpenCV视觉识别 + WebSocket实时通信，提供两套API接口：

1. **简单函数接口** (`camera_api.py`) - 像单片机库函数一样简单易用
2. **高级实时接口** (`pendulum_interface_realtime.py`) - 提供更多控制和配置选项

## 二、快速开始

### 1. 启动后端服务

```bash
# 进入项目目录
cd 旧后端代码

# 启动主服务（包含HTTP服务器和WebSocket服务器）
python -m 旧后端代码
```

服务启动后：
- HTTP服务器：`http://localhost:5000`
- WebSocket服务器：`ws://localhost:5001`
- 视频流：`http://localhost:5000/video_feed`

### 2. 选择API接口

#### 方式一：简单函数接口（推荐新手使用）

```python
from camera_api import init_camera_api, get_pendulum_angle, get_pendulum_length, close_camera_api

# 初始化
if init_camera_api(host="localhost", port=5000):
    # 开始获取数据
    angle = get_pendulum_angle()
    length = get_pendulum_length()

# 关闭
close_camera_api()
```

#### 方式二：高级实时接口（推荐进阶使用）

```python
from pendulum_interface_realtime import realtime_start

# 启动接口
pendulum = realtime_start(host="localhost", port=5000, show_camera=True)

# 获取数据
data = pendulum.get_current_data()

# 关闭
pendulum.close()
```

## 三、数据获取函数详解

### 1、角度数据

#### 单摆角度（计算角度）
```python
# 简单接口
angle = get_pendulum_angle()  # 返回float，单位：度

# 高级接口
angle = pendulum.last_angle  # 实时更新的角度值
data = pendulum.get_pendulum_angle()  # 从服务器获取
```

#### 摄像头识别角度（原始角度）
```python
# 简单接口
camera_angle = get_camera_angle()  # 返回float，单位：度

# 高级接口
camera_angle = pendulum.last_camera_angle  # 实时更新的摄像头角度
data = pendulum.get_camera_angle()  # 从服务器获取
```

#### 角度历史数据
```python
# 高级接口
history_data = pendulum.get_angle_history()  # 返回dict
# 格式：{"history": [{"time": timestamp, "angle": angle}, ...]}

# 获取原始历史列表
raw_history = pendulum.get_current_data()['angle_history_raw']
```

### 2、周期数据

#### 当前周期
```python
# 简单接口
period = get_pendulum_period()  # 返回float，单位：秒

# 高级接口
period = pendulum.data.period  # 当前周期值
data = pendulum.get_pendulum_state()  # 从服务器获取完整状态
period = data.get('period', 0.0)
```

### 3、摆长数据

#### 摆长设置
```python
# 简单接口
length = get_pendulum_length()  # 返回float，单位：厘米

# 高级接口
length = pendulum.data.length  # 当前摆长
data = pendulum.get_pendulum_length()  # 从服务器获取
```

### 4、时间数据

#### 系统时间
```python
# 高级接口
import time
current_time = time.time()  # 当前系统时间戳
start_time = pendulum.stats['start_time']  # 程序启动时间
elapsed_time = current_time - start_time  # 程序运行时间
```

#### 数据更新时间
```python
# 高级接口
last_update = pendulum.data.last_realtime_update  # 最后数据更新时间
update_interval = pendulum.cache_timeout  # 更新间隔（秒）
```

### 5、摄像头画面

#### 显示摄像头画面
```python
# 简单接口 - 在初始化时显示
if init_camera_api(host="localhost", port=5000, show_camera=True):
    # 摄像头窗口已显示
    angle = get_pendulum_angle()

# 高级接口
pendulum.start_camera_display()      # 启动摄像头显示
pendulum.toggle_camera_display()     # 切换显示状态
pendulum.camera_display_running = False  # 停止显示
```

#### 获取视频流
```python
import cv2

# 从后端获取视频流
video_url = "http://localhost:5000/video_feed"
cap = cv2.VideoCapture(video_url)

# 或者直接打开摄像头
cap = cv2.VideoCapture(0)  # 默认摄像头
```

### 6、位置数据

#### 摆球位置
```python
# 高级接口
data = pendulum.get_pendulum_state()
ball_x = data.get('ball_x', 0)    # 摆球X坐标
ball_y = data.get('ball_y', 0)    # 摆球Y坐标
pivot_x = data.get('pivot_x', 0)  # 支点X坐标
pivot_y = data.get('pivot_y', 0)  # 支点Y坐标
```

#### 位置历史
```python
# 高级接口
position_history = pendulum.get_position_history()
# 格式：{"history": [{"time": timestamp, "x": x, "y": y}, ...]}
```

## 四、DIY物理实验示例

### 示例1：测量重力加速度

```python
from camera_api import *
import time
import math

# 初始化
if not init_camera_api():
    print("初始化失败")
    exit()

print("开始测量重力加速度...")
print("请调整摆长，每5秒记录一次数据")

# 记录多组数据
measurements = []
for i in range(10):
    # 获取数据
    length = get_pendulum_length() / 100  # 转换为米
    period = get_pendulum_period()

    if period > 0:
        # 计算重力加速度 g = 4π²L/T²
        g = 4 * math.pi**2 * length / (period**2)
        measurements.append({
            'length': length,
            'period': period,
            'gravity': g,
            'time': time.time()
        })

        print(f"第{i+1}次: 摆长={length:.2f}m, 周期={period:.3f}s, g={g:.2f}m/s²")

    time.sleep(5)

# 计算平均值
avg_g = sum(m['gravity'] for m in measurements) / len(measurements)
print(f"\n平均重力加速度: {avg_g:.2f} m/s²")

close_camera_api()
```

### 示例2：角度-周期关系研究

```python
from pendulum_interface_realtime import realtime_start
import time
import json

# 启动接口
pendulum = realtime_start(host="localhost", port=5000, show_camera=False)

print("研究角度与周期关系...")
print("请让单摆以不同角度摆动")

# 数据记录
angle_period_data = []

try:
    for i in range(50):
        # 获取当前数据
        current_data = pendulum.get_current_data()
        angle = abs(current_data['angle'])
        period = current_data['period']

        # 只记录有效的数据
        if period > 0 and angle > 0:
            angle_period_data.append({
                'angle': angle,
                'period': period,
                'timestamp': time.time()
            })

            print(f"角度: {angle:.2f}°, 周期: {period:.3f}s")

        time.sleep(1)

except KeyboardInterrupt:
    print("测量停止")

# 保存数据
with open('angle_period_data.json', 'w') as f:
    json.dump(angle_period_data, f, indent=2)

pendulum.close()
print(f"数据已保存，共记录{len(angle_period_data)}组数据")
```

### 示例3：实时数据监控

```python
from camera_api import *
import time

# 初始化并显示摄像头
if init_camera_api(show_camera=True):
    print("实时监控开始...")

    try:
        while True:
            # 获取所有数据
            angle = get_pendulum_angle()
            camera_angle = get_camera_angle()
            length = get_pendulum_length()
            period = get_pendulum_period()

            # 格式化输出
            print(f"\r单摆角度: {angle:+6.2f}° | 摄像头角度: {camera_angle:+6.2f}° | "
                  f"摆长: {length:5.1f}cm | 周期: {period:.3f}s", end="")

            time.sleep(0.1)  # 高频率更新

    except KeyboardInterrupt:
        print("\n监控停止")

    close_camera_api()
```

### 示例4：自定义数据采集器

```python
from pendulum_interface_realtime import RealtimePendulumInterface
import time
import csv

class DataCollector:
    def __init__(self, host="localhost", port=5000):
        self.interface = RealtimePendulumInterface(host, port)
        self.recording = False
        self.data_buffer = []

    def start(self):
        """启动数据采集"""
        if self.interface.check_backend_status():
            print("数据采集器启动成功")
            return True
        return False

    def record_data(self, duration_seconds):
        """记录指定时间的数据"""
        self.recording = True
        self.data_buffer = []

        print(f"开始记录数据，持续{duration_seconds}秒...")

        start_time = time.time()
        while time.time() - start_time < duration_seconds and self.recording:
            data = self.interface.get_current_data()
            self.data_buffer.append({
                'timestamp': time.time(),
                'angle': data['angle'],
                'camera_angle': data['camera_angle'],
                'length': data['length'],
                'period': data['period'],
                'ball_x': data['ball_x'],
                'ball_y': data['ball_y']
            })
            time.sleep(0.05)  # 20Hz采样率

        print(f"记录完成，共{len(self.data_buffer)}个数据点")
        return self.data_buffer

    def save_to_csv(self, filename):
        """保存数据到CSV文件"""
        if not self.data_buffer:
            print("没有数据可保存")
            return False

        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=self.data_buffer[0].keys())
            writer.writeheader()
            writer.writerows(self.data_buffer)

        print(f"数据已保存到 {filename}")
        return True

    def stop(self):
        """停止数据采集"""
        self.recording = False
        self.interface.close()

# 使用示例
collector = DataCollector()
if collector.start():
    # 记录30秒数据
    data = collector.record_data(30)

    # 保存到文件
    collector.save_to_csv('pendulum_data.csv')

    collector.stop()
```

## 注意事项

1. **单位说明**：
   - 角度：度（°）
   - 摆长：厘米（cm）
   - 周期：秒（s）
   - 时间：Unix时间戳（秒）

2. **数据更新频率**：
   - 简单接口：约10-20Hz
   - 高级接口：可达20Hz（50ms间隔）

3. **错误处理**：
   - 所有函数都可能返回None，建议检查返回值
   - 网络超时设置为200ms，避免程序卡死

4. **摄像头冲突**：
   - 系统优先使用后端视频流（`/video_feed`）
   - 避免直接打开摄像头造成资源冲突

5. **性能优化**：
   - 高频数据采集时建议使用高级接口
   - 可以调整`cache_timeout`参数控制更新频率

## 五、扩展功能

### 1. 自定义数据端点

```python
# 高级接口支持自定义端点
pendulum.data_endpoints['custom_endpoint'] = '/custom_url'
data = pendulum.get_data_from_endpoint('custom_endpoint')
```

### 2. WebSocket实时数据

```python
import websocket
import json

def on_message(ws, message):
    data = json.loads(message)
    if data['type'] == 'pendulum_state':
        print(f"实时角度: {data['data']['angle']}°")

ws = websocket.WebSocketApp("ws://localhost:5001", on_message=on_message)
ws.run_forever()
```

### 3. 数据导出格式

系统支持多种数据导出格式：
- JSON：结构化数据，便于程序处理
- CSV：表格数据，便于Excel分析
- 实时流：连续数据，便于实时监控

## 六、故障排除

1. **连接失败**：
   - 检查后端服务是否启动
   - 确认端口号是否正确
   - 检查防火墙设置

2. **数据异常**：
   - 检查摄像头是否正常工作
   - 确认HSV颜色阈值是否正确
   - 检查单摆球是否在视野内

3. **性能问题**：
   - 降低数据更新频率
   - 关闭不必要的摄像头显示
   - 检查网络延迟

通过以上API接口，您可以轻松构建各种DIY物理实验，实现数据的自动化采集和分析。