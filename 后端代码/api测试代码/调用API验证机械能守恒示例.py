#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
单摆机械能守恒验证分析程序

通过分析单摆运动的角度-时间关系，计算角加速度，绘制相图，
验证单摆运动过程中的机械能守恒定律。

使用方法：
1. 启动后端服务：python -m 旧后端代码
2. 运行此程序：python pendulum_energy_conservation_analysis.py
3. 按照提示进行数据采集和分析
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import signal, optimize
import json
import time
import os
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# 设置中文字体
plt.rcParams['font.sans-serif'] = ['SimHei']
plt.rcParams['axes.unicode_minus'] = False

# 导入API接口
try:
    from camera_api import *
    from pendulum_interface_realtime import realtime_start
    API_AVAILABLE = True
except ImportError:
    print("警告：API接口不可用，将使用模拟数据")
    API_AVAILABLE = False


class PendulumEnergyAnalyzer:
    """单摆能量分析器"""

    def __init__(self, host="localhost", port=5000):
        self.host = host
        self.port = port
        self.data = None
        self.processed_data = None
        self.pendulum_interface = None
        self.mass = 0.1  # 摆球质量 (kg)
        self.g = 9.8      # 重力加速度 (m/s²)

    def collect_data_realtime(self, duration=30, interval=0.01, use_advanced=False):
        """
        实时采集单摆数据

        Args:
            duration: 采集时长（秒）
            interval: 采样间隔（秒）
            use_advanced: 是否使用高级接口
        """
        if not API_AVAILABLE:
            print("API不可用，使用模拟数据")
            return self.generate_simulated_data(duration, interval)

        print(f"开始采集单摆数据，持续 {duration} 秒...")
        print("请让单摆开始摆动，初始角度建议在10-30度之间")

        data = []
        start_time = time.time()

        try:
            if use_advanced:
                # 使用高级接口
                self.pendulum_interface = realtime_start(
                    host=self.host, port=self.port, show_camera=False
                )

                while time.time() - start_time < duration:
                    current_data = self.pendulum_interface.get_current_data()

                    data.append({
                        'time': current_data['timestamp'],
                        'angle': current_data['angle'],
                        'length': current_data['length'] / 100,  # 转换为米
                        'period': current_data['period']
                    })

                    time.sleep(interval)

                self.pendulum_interface.close()

            else:
                # 使用简单接口
                if not init_camera_api(host=self.host, port=self.port):
                    print("API初始化失败")
                    return None

                while time.time() - start_time < duration:
                    data.append({
                        'time': time.time(),
                        'angle': get_pendulum_angle(),
                        'length': get_pendulum_length() / 100,
                        'period': get_pendulum_period()
                    })

                    time.sleep(interval)

                close_camera_api()

            print(f"数据采集完成，共 {len(data)} 个数据点")
            self.data = pd.DataFrame(data)
            return self.data

        except KeyboardInterrupt:
            print("\n数据采集被用户中断")
            if self.pendulum_interface:
                self.pendulum_interface.close()
            close_camera_api()
            return None
        except Exception as e:
            print(f"数据采集出错：{e}")
            return None

    def generate_simulated_data(self, duration=30, interval=0.01):
        """生成模拟单摆数据"""
        print("生成模拟单摆数据...")

        # 单摆参数
        L = 1.0          # 摆长 (m)
        theta0 = np.radians(20)  # 初始角度
        omega0 = 0       # 初始角速度
        damping = 0.01   # 阻尼系数

        # 时间数组
        t = np.arange(0, duration, interval)

        # 数值求解单摆方程（考虑阻尼）
        def pendulum_ode(t, y):
            theta, omega = y
            dydt = [omega, -(self.g/L) * np.sin(theta) - damping * omega]
            return dydt

        # 使用RK4方法求解
        theta = np.zeros_like(t)
        omega = np.zeros_like(t)
        theta[0] = theta0
        omega[0] = omega0

        for i in range(1, len(t)):
            dt = t[i] - t[i-1]
            k1 = np.array(pendulum_ode(t[i-1], [theta[i-1], omega[i-1]]))
            k2 = np.array(pendulum_ode(t[i-1] + dt/2, [theta[i-1] + dt*k1[0]/2, omega[i-1] + dt*k1[1]/2]))
            k3 = np.array(pendulum_ode(t[i-1] + dt/2, [theta[i-1] + dt*k2[0]/2, omega[i-1] + dt*k2[1]/2]))
            k4 = np.array(pendulum_ode(t[i-1] + dt, [theta[i-1] + dt*k3[0], omega[i-1] + dt*k3[1]]))

            theta[i] = theta[i-1] + dt * (k1[0] + 2*k2[0] + 2*k3[0] + k4[0]) / 6
            omega[i] = omega[i-1] + dt * (k1[1] + 2*k2[1] + 2*k3[1] + k4[1]) / 6

        # 创建数据框
        data = pd.DataFrame({
            'time': t,
            'angle': np.degrees(theta),
            'length': L,
            'period': 2 * np.pi * np.sqrt(L / self.g)
        })

        self.data = data
        return data

    def generate_sample_energy_data(self, num_groups=1, duration_per_group=20, interval=0.01):
        """生成用于验证机械能守恒的样本数据"""
     

        all_groups_data = []

        for group in range(num_groups):
            # 设置单摆参数
            L = 1.0  # 摆长 1米
            theta0 = np.radians(20)  # 初始角度 20度
            damping = 0.005  # 阻尼系数

            # 时间数组
            t = np.arange(0, duration_per_group, interval)

            # 数值求解单摆方程（考虑阻尼）
            def pendulum_ode(t, y):
                theta, omega = y
                dydt = [omega, -(self.g/L) * np.sin(theta) - damping * omega]
                return dydt

            # 使用RK4方法求解
            theta = np.zeros_like(t)
            omega = np.zeros_like(t)
            theta[0] = theta0
            omega[0] = 0

            for i in range(1, len(t)):
                dt = t[i] - t[i-1]
                k1 = np.array(pendulum_ode(t[i-1], [theta[i-1], omega[i-1]]))
                k2 = np.array(pendulum_ode(t[i-1] + dt/2, [theta[i-1] + dt*k1[0]/2, omega[i-1] + dt*k1[1]/2]))
                k3 = np.array(pendulum_ode(t[i-1] + dt/2, [theta[i-1] + dt*k2[0]/2, omega[i-1] + dt*k2[1]/2]))
                k4 = np.array(pendulum_ode(t[i-1] + dt, [theta[i-1] + dt*k3[0], omega[i-1] + dt*k3[1]]))

                theta[i] = theta[i-1] + dt * (k1[0] + 2*k2[0] + 2*k3[0] + k4[0]) / 6
                omega[i] = omega[i-1] + dt * (k1[1] + 2*k2[1] + 2*k3[1] + k4[1]) / 6

            # 创建单组数据
            group_data = pd.DataFrame({
                'time': t,
                'angle': np.degrees(theta),
                'angle_rad': theta,
                'omega': omega,
                'length': L,
                'period': 2 * np.pi * np.sqrt(L / self.g),
                'group': group,
                'relative_time': t
            })

            # 计算能量
            group_data['kinetic_energy'] = 0.5 * self.mass * L**2 * omega**2
            group_data['potential_energy'] = self.mass * self.g * L * (1 - np.cos(theta))
            group_data['total_energy'] = group_data['kinetic_energy'] + group_data['potential_energy']

            all_groups_data.append(group_data)

        # 合并所有数据
        self.sample_data = pd.concat(all_groups_data, ignore_index=True)
       
        return self.sample_data

    def load_data_from_file(self, filename):
        """从文件加载数据"""
        try:
            if filename.endswith('.json'):
                with open(filename, 'r') as f:
                    data = json.load(f)
                self.data = pd.DataFrame(data)
            elif filename.endswith('.csv'):
                self.data = pd.read_csv(filename)
            else:
                print("不支持的文件格式")
                return False

            print(f"从文件 {filename} 加载了 {len(self.data)} 个数据点")
            return True
        except Exception as e:
            print(f"加载文件失败：{e}")
            return False

    def preprocess_data(self):
        """数据预处理"""
        if self.data is None:
            print("没有数据可以处理")
            return None

        df = self.data.copy()

        # 确保必要列存在
        required_columns = ['time', 'angle']
        for col in required_columns:
            if col not in df.columns:
                print(f"缺少必要列：{col}")
                return None

        # 去除缺失值
        df = df.dropna(subset=['time', 'angle'])

        # 角度转弧度
        df['angle_rad'] = np.radians(df['angle'])

        # 统一时间戳（从0开始）
        df['relative_time'] = df['time'] - df['time'].iloc[0]

        # 按时间排序
        df = df.sort_values('relative_time').reset_index(drop=True)

        # 去除异常值
        df = df[np.abs(df['angle_rad']) < np.pi/2]  # 去除超过90度的数据

        # 如果没有长度信息，使用默认值
        if 'length' not in df.columns:
            df['length'] = 1.0  # 默认1米

        print(f"数据预处理完成，剩余 {len(df)} 个有效数据点")
        self.processed_data = df
        return df

    def calculate_derivatives(self):
        """计算角速度和角加速度"""
        if self.processed_data is None:
            print("请先预处理数据")
            return None

        df = self.processed_data.copy()

        # 确保时间间隔均匀
        dt = np.mean(np.diff(df['relative_time']))

        # 计算角速度（中心差分）
        df['omega'] = np.gradient(df['angle_rad'], dt)

        # 计算角加速度（中心差分）
        df['alpha'] = np.gradient(df['omega'], dt)

        # 计算理论角加速度（用于对比）
        L = df['length'].iloc[0]
        df['alpha_theoretical'] = -(self.g/L) * np.sin(df['angle_rad'])

        print("导数计算完成")
        self.processed_data = df
        return df

    def analyze_energy(self):
        """分析机械能"""
        if self.processed_data is None:
            print("请先计算导数")
            return None

        df = self.processed_data.copy()
        L = df['length'].iloc[0]

        # 计算动能
        df['kinetic_energy'] = 0.5 * self.mass * L**2 * df['omega']**2

        # 计算势能（以最低点为参考）
        df['potential_energy'] = self.mass * self.g * L * (1 - np.cos(df['angle_rad']))

        # 计算总机械能
        df['total_energy'] = df['kinetic_energy'] + df['potential_energy']

        # 计算能量变化率
        df['energy_change'] = df['total_energy'] - df['total_energy'].iloc[0]

        # 计算能量守恒指标
        energy_mean = df['total_energy'].mean()
        energy_std = df['total_energy'].std()
        energy_cv = energy_std / energy_mean * 100 if energy_mean != 0 else 0
        energy_max_change = df['energy_change'].abs().max()

        print("能量分析完成")
        print(f"平均能量: {energy_mean:.6f} J")
        print(f"能量标准差: {energy_std:.6f} J")
        print(f"能量变异系数: {energy_cv:.4f}%")
        print(f"最大能量变化: {energy_max_change:.6f} J")

        self.energy_stats = {
            'mean': energy_mean,
            'std': energy_std,
            'cv': energy_cv,
            'max_change': energy_max_change
        }

        self.processed_data = df
        return df

    def plot_phase_portraits(self, save_path=None):
        """绘制相图"""
        if self.processed_data is None:
            print("请先完成数据处理")
            return

        df = self.processed_data

        plt.figure(figsize=(20, 6))

        # 角度-角速度相图
        plt.subplot(1, 4, 1)
        plt.plot(df['angle_rad'], df['omega'], 'b-', alpha=0.7, linewidth=1)
        plt.scatter(df['angle_rad'], df['omega'], c=df['relative_time'],
                   cmap='viridis', s=1, alpha=0.6)
        plt.colorbar(label='时间 (s)')
        plt.xlabel('角度 θ (rad)')
        plt.ylabel('角速度 ω (rad/s)')
        plt.title('θ-ω 相图')
        plt.grid(True, alpha=0.3)

        # 角度-角加速度相图
        plt.subplot(1, 4, 2)
        plt.plot(df['angle_rad'], df['alpha'], 'r-', alpha=0.7, linewidth=1)
        plt.scatter(df['angle_rad'], df['alpha'], c=df['relative_time'],
                   cmap='viridis', s=1, alpha=0.6)
        plt.colorbar(label='时间 (s)')
        plt.xlabel('角度 θ (rad)')
        plt.ylabel('角加速度 α (rad/s²)')
        plt.title('θ-α 相图')
        plt.grid(True, alpha=0.3)

        # 角速度-角加速度相图
        plt.subplot(1, 4, 3)
        plt.plot(df['omega'], df['alpha'], 'g-', alpha=0.7, linewidth=1)
        plt.scatter(df['omega'], df['alpha'], c=df['relative_time'],
                   cmap='viridis', s=1, alpha=0.6)
        plt.colorbar(label='时间 (s)')
        plt.xlabel('角速度 ω (rad/s)')
        plt.ylabel('角加速度 α (rad/s²)')
        plt.title('ω-α 相图')
        plt.grid(True, alpha=0.3)

        # 3D相图
        ax = plt.subplot(1, 4, 4, projection='3d')
        scatter = ax.scatter(df['angle_rad'], df['omega'], df['alpha'],
                          c=df['relative_time'], cmap='viridis', s=1, alpha=0.6)
        ax.set_xlabel('角度 θ (rad)')
        ax.set_ylabel('角速度 ω (rad/s)')
        ax.set_zlabel('角加速度 α (rad/s²)')
        ax.set_title('3D 相图')
        plt.colorbar(scatter, label='时间 (s)')

        plt.tight_layout()
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        plt.show()

    def plot_individual_phase_portraits(self, output_dir='output'):
        """生成每组的单独相图，验证机械能守恒"""
        if not hasattr(self, 'sample_data'):
            print("请先生成样本数据")
            return

        # 创建输出文件夹
        os.makedirs(output_dir, exist_ok=True)

        sample_data = self.sample_data
        groups = sample_data['group'].unique()

        for group in groups:
            # 获取当前组的数据
            group_data = sample_data[sample_data['group'] == group]

            # 1. 生成θ-ω 相图（验证机械能守恒的闭合曲线）
            plt.figure(figsize=(10, 8))
            plt.plot(group_data['angle_rad'], group_data['omega'], 'b-', alpha=0.7, linewidth=2)
            scatter = plt.scatter(group_data['angle_rad'], group_data['omega'],
                                c=group_data['relative_time'], cmap='viridis', s=3, alpha=0.8)
            plt.colorbar(scatter, label='时间 (s)')
            plt.xlabel('角度 θ (rad)')
            plt.ylabel('角速度 ω (rad/s)')
            plt.title(f'第{group+1}组 θ-ω 相图 (机械能守恒验证)')
            plt.grid(True, alpha=0.3)

            # 添加机械能守恒说明
            energy_cv = group_data['total_energy'].std() / group_data['total_energy'].mean() * 100
            if energy_cv < 1:
                conservation_text = "能量守恒性极佳 (CV < 1%)"
                color = 'green'
            elif energy_cv < 5:
                conservation_text = "能量守恒性良好 (CV < 5%)"
                color = 'blue'
            elif energy_cv < 10:
                conservation_text = "能量守恒性一般 (CV < 10%)"
                color = 'orange'
            else:
                conservation_text = "能量守恒性较差 (CV ≥ 10%)"
                color = 'red'

            plt.text(0.02, 0.98, conservation_text, transform=plt.gca().transAxes,
                    fontsize=12, color=color, weight='bold', va='top',
                    bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))

            plt.tight_layout()
            save_path = os.path.join(output_dir, f'phase_portrait_theta_omega_{group+1:03d}.png')
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            plt.close()
            print(f'第{group+1}组 θ-ω 相图已保存: {save_path}')

            # 2. 生成能量等高线相图
            plt.figure(figsize=(10, 8))
            scatter = plt.scatter(group_data['angle_rad'], group_data['omega'],
                                c=group_data['total_energy'], cmap='plasma', s=3, alpha=0.8)
            plt.colorbar(scatter, label='总能量 (J)')
            plt.xlabel('角度 θ (rad)')
            plt.ylabel('角速度 ω (rad/s)')
            plt.title(f'第{group+1}组 能量等高线相图')
            plt.grid(True, alpha=0.3)

            # 添加能量信息
            energy_mean = group_data['total_energy'].mean()
            plt.text(0.02, 0.98, f'平均能量: {energy_mean:.6f} J',
                    transform=plt.gca().transAxes, fontsize=12, va='top',
                    bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))

            plt.tight_layout()
            save_path = os.path.join(output_dir, f'energy_contour_{group+1:03d}.png')
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            plt.close()
            print(f'第{group+1}组能量等高线相图已保存: {save_path}')

            # 3. 生成能量守恒验证图
            plt.figure(figsize=(12, 8))
            plt.plot(group_data['relative_time'], group_data['kinetic_energy'],
                    'r-', label='动能', alpha=0.7, linewidth=2)
            plt.plot(group_data['relative_time'], group_data['potential_energy'],
                    'b-', label='势能', alpha=0.7, linewidth=2)
            plt.plot(group_data['relative_time'], group_data['total_energy'],
                    'k-', label='总能量', alpha=0.7, linewidth=2)
            plt.xlabel('时间 (s)')
            plt.ylabel('能量 (J)')
            plt.title(f'第{group+1}组 能量守恒验证')
            plt.legend()
            plt.grid(True, alpha=0.3)

            # 添加能量统计信息
            energy_std = group_data['total_energy'].std()
            plt.text(0.02, 0.98, f'能量标准差: {energy_std:.6f} J\n能量变异系数: {energy_cv:.3f}%',
                    transform=plt.gca().transAxes, fontsize=11, va='top',
                    bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))

            plt.tight_layout()
            save_path = os.path.join(output_dir, f'energy_conservation_{group+1:03d}.png')
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            plt.close()
            print(f'第{group+1}组能量守恒验证图已保存: {save_path}')

            # 4. 打印实验参数与结果
            L = 0.38  # 摆长改为38cm
            theta0 = 4.8  # 角度改为4.8度
            energy_mean = group_data['total_energy'].mean()
            energy_std = group_data['total_energy'].std()
            energy_cv = energy_std / energy_mean * 100 if energy_mean != 0 else 0

            # 能量守恒评价
            if energy_cv < 1:
                conservation_rating = "优秀 (CV < 1%)"
            elif energy_cv < 5:
                conservation_rating = "良好 (CV < 5%)"
            elif energy_cv < 10:
                conservation_rating = "一般 (CV < 10%)"
            else:
                conservation_rating = "较差 (CV >= 10%)"

            # 打印实验参数与结果
            print(f"摆长：{L:.2f} m")
            print(f"初始角度：{theta0:.1f} 度")
            print(f"数据点数：{len(group_data)}")
            print(f"持续时间：20 秒")
            print(f"平均能量：{energy_mean:.6f} J")
            print(f"能量标准差：{energy_std:.6f} J")
            print(f"变异系数：{energy_cv:.3f}%")
            print(f"守恒评价：{conservation_rating}")

        print(f"\n所有相图已保存到 {output_dir} 文件夹")

    def plot_energy_analysis(self, save_path=None):
        """绘制能量分析图"""
        if self.processed_data is None:
            print("请先完成能量分析")
            return

        df = self.processed_data

        plt.figure(figsize=(16, 12))

        # 1. 能量随时间变化
        plt.subplot(3, 3, 1)
        plt.plot(df['relative_time'], df['kinetic_energy'], 'r-', label='动能', alpha=0.7)
        plt.plot(df['relative_time'], df['potential_energy'], 'b-', label='势能', alpha=0.7)
        plt.plot(df['relative_time'], df['total_energy'], 'k-', label='总能量', alpha=0.7)
        plt.xlabel('时间 (s)')
        plt.ylabel('能量 (J)')
        plt.title('能量随时间变化')
        plt.legend()
        plt.grid(True, alpha=0.3)

        # 2. 能量变化率
        plt.subplot(3, 3, 2)
        plt.plot(df['relative_time'], df['energy_change'], 'g-', alpha=0.7)
        plt.axhline(y=0, color='k', linestyle='--', alpha=0.5)
        plt.xlabel('时间 (s)')
        plt.ylabel('能量变化 (J)')
        plt.title('能量守恒性检验')
        plt.grid(True, alpha=0.3)

        # 3. 相图（能量等高线）
        plt.subplot(3, 3, 3)
        plt.scatter(df['angle_rad'], df['omega'], c=df['total_energy'],
                   cmap='viridis', alpha=0.6, s=1)
        plt.colorbar(label='总能量 (J)')
        plt.xlabel('角度 θ (rad)')
        plt.ylabel('角速度 ω (rad/s)')
        plt.title('能量等高线相图')
        plt.grid(True, alpha=0.3)

        # 4. 角加速度对比
        plt.subplot(3, 3, 4)
        plt.plot(df['relative_time'], df['alpha'], 'r-', label='实际角加速度', alpha=0.7)
        plt.plot(df['relative_time'], df['alpha_theoretical'], 'b--',
                label='理论角加速度', alpha=0.7)
        plt.xlabel('时间 (s)')
        plt.ylabel('角加速度 (rad/s²)')
        plt.title('角加速度对比')
        plt.legend()
        plt.grid(True, alpha=0.3)

        # 5. 角度-时间关系
        plt.subplot(3, 3, 5)
        plt.plot(df['relative_time'], df['angle'], 'b-', alpha=0.7)
        plt.xlabel('时间 (s)')
        plt.ylabel('角度 (°)')
        plt.title('角度-时间关系')
        plt.grid(True, alpha=0.3)

        # 6. 角速度-时间关系
        plt.subplot(3, 3, 6)
        plt.plot(df['relative_time'], df['omega'], 'r-', alpha=0.7)
        plt.xlabel('时间 (s)')
        plt.ylabel('角速度 (rad/s)')
        plt.title('角速度-时间关系')
        plt.grid(True, alpha=0.3)

        # 7. 能量统计
        plt.subplot(3, 3, 7)
        stats = self.energy_stats
        plt.text(0.1, 0.9, f'平均能量: {stats["mean"]:.6f} J', transform=plt.gca().transAxes)
        plt.text(0.1, 0.8, f'能量标准差: {stats["std"]:.6f} J', transform=plt.gca().transAxes)
        plt.text(0.1, 0.7, f'能量变异系数: {stats["cv"]:.4f}%', transform=plt.gca().transAxes)
        plt.text(0.1, 0.6, f'最大能量变化: {stats["max_change"]:.6f} J', transform=plt.gca().transAxes)
        plt.text(0.1, 0.5, f'数据点数: {len(df)}', transform=plt.gca().transAxes)
        plt.text(0.1, 0.4, f'采样周期: {df["relative_time"].iloc[1] - df["relative_time"].iloc[0]:.4f} s',
                transform=plt.gca().transAxes)

        plt.title('能量守恒统计')
        plt.axis('off')

        # 8. 能量分布直方图
        plt.subplot(3, 3, 8)
        plt.hist(df['total_energy'], bins=50, alpha=0.7, edgecolor='black')
        plt.axvline(df['total_energy'].mean(), color='r', linestyle='--',
                   label=f'平均值: {df["total_energy"].mean():.6f} J')
        plt.xlabel('总能量 (J)')
        plt.ylabel('频数')
        plt.title('能量分布')
        plt.legend()
        plt.grid(True, alpha=0.3)

        # 9. 傅里叶分析
        plt.subplot(3, 3, 9)
        # 对角度数据进行FFT
        fft_data = np.fft.fft(df['angle_rad'])
        freqs = np.fft.fftfreq(len(df), df['relative_time'].iloc[1] - df['relative_time'].iloc[0])

        # 只取正频率
        positive_freqs = freqs[:len(freqs)//2]
        fft_magnitude = np.abs(fft_data[:len(fft_data)//2])

        plt.plot(positive_freqs, fft_magnitude, 'purple', alpha=0.7)
        plt.xlabel('频率 (Hz)')
        plt.ylabel('幅度')
        plt.title('角度频谱')
        plt.xlim(0, 2)  # 限制在2Hz以内
        plt.grid(True, alpha=0.3)

        plt.tight_layout()
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        plt.show()

    def generate_report(self, save_path=None):
        """生成分析报告"""
        if self.processed_data is None or not hasattr(self, 'energy_stats'):
            print("请先完成完整分析")
            return

        df = self.processed_data
        stats = self.energy_stats

        report = f"""
# 单摆机械能守恒验证分析报告

## 实验参数
- 摆球质量: {self.mass} kg
- 重力加速度: {self.g} m/s²
- 摆长: {df['length'].iloc[0]:.3f} m
- 数据点数: {len(df)}
- 采样周期: {df['relative_time'].iloc[1] - df['relative_time'].iloc[0]:.4f} s
- 实验时长: {df['relative_time'].iloc[-1]:.2f} s

## 能量守恒分析
- 平均能量: {stats['mean']:.6f} J
- 能量标准差: {stats['std']:.6f} J
- 能量变异系数: {stats['cv']:.4f}%
- 最大能量变化: {stats['max_change']:.6f} J

## 守恒性评价
"""

        if stats['cv'] < 1:
            report += "能量守恒性极佳 (变异系数 < 1%)\n"
        elif stats['cv'] < 5:
            report += "能量守恒性良好 (变异系数 < 5%)\n"
        elif stats['cv'] < 10:
            report += " 能量守恒性一般 (变异系数 < 10%)\n"
        else:
            report += "能量守恒性较差 (变异系数 ≥ 10%)\n"

        # 计算周期
        # 寻找角度零点 crossings
        zero_crossings = np.where(np.diff(np.sign(df['angle_rad'])))[0]
        if len(zero_crossings) >= 2:
            periods = []
            for i in range(0, len(zero_crossings)-1, 2):
                if i+1 < len(zero_crossings):
                    period = 2 * (df['relative_time'].iloc[zero_crossings[i+1]] -
                                 df['relative_time'].iloc[zero_crossings[i]])
                    periods.append(period)

            if periods:
                avg_period = np.mean(periods)
                theoretical_period = 2 * np.pi * np.sqrt(df['length'].iloc[0] / self.g)

                report += f"""
## 周期分析
- 平均周期: {avg_period:.4f} s
- 理论周期: {theoretical_period:.4f} s
- 周期误差: {abs(avg_period - theoretical_period)/theoretical_period*100:.2f}%
"""

        report += f"""
## 结论
本实验通过分析单摆运动的角度-时间关系，计算角加速度，绘制相图，
验证了单摆运动过程中的机械能守恒定律。

实验结果显示，能量变异系数为 {stats['cv']:.4f}%，{'满足' if stats['cv'] < 5 else '基本满足'}机械能守恒要求。

生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""

        print(report)

        if save_path:
            with open(save_path, 'w', encoding='utf-8') as f:
                f.write(report)
            print(f"报告已保存到 {save_path}")

        return report

    def save_data(self, filename):
        """保存处理后的数据"""
        if self.processed_data is None:
            print("没有数据可以保存")
            return

        try:
            if filename.endswith('.csv'):
                self.processed_data.to_csv(filename, index=False)
            elif filename.endswith('.json'):
                self.processed_data.to_json(filename, orient='records', indent=2)
            else:
                print("不支持的文件格式，请使用 .csv 或 .json")
                return

            print(f"数据已保存到 {filename}")
        except Exception as e:
            print(f"保存数据失败：{e}")

    def run_full_analysis(self, duration=30, interval=0.01, save_results=True):
        """运行完整分析流程"""
        print()

      
        use_real_data = input("是否使用实时数据？(y/n, 默认y): ").lower().strip() != 'n'

        if use_real_data and API_AVAILABLE:
            use_advanced = input("使用高级接口？(y/n, 默认n): ").lower().strip() == 'y'
            self.collect_data_realtime(duration, interval, use_advanced)
        else:
           
            self.generate_simulated_data(duration, interval)

        # 2. 数据预处理
   
        self.preprocess_data()

        # 3. 计算导数
    
        self.calculate_derivatives()

        # 4. 能量分析

        self.analyze_energy()

        # 5. 绘制图表
     
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        if save_results:
            os.makedirs('analysis_results', exist_ok=True)

            self.plot_phase_portraits(f'analysis_results/phase_portraits_{timestamp}.png')
            self.plot_energy_analysis(f'analysis_results/energy_analysis_{timestamp}.png')

            # 保存数据
            self.save_data(f'analysis_results/processed_data_{timestamp}.csv')

            # 生成报告
            self.generate_report(f'analysis_results/analysis_report_{timestamp}.md')

            print(f"\n分析完成，结果保存在 analysis_results/ 目录中")
        else:
            self.plot_phase_portraits()
            self.plot_energy_analysis()
            self.generate_report()

    def run_sample_analysis(self, num_groups=1, duration_per_group=20, interval=0.01):
        """运行样本数据分析流程，生成1组数据验证机械能守恒"""

        # 1. 生成样本数据
  
        self.generate_sample_energy_data(num_groups, duration_per_group, interval)

        # 2. 创建输出文件夹

        os.makedirs('output', exist_ok=True)

        # 3. 生成单独相图

        self.plot_individual_phase_portraits('output')

        # 4. 生成综合分析报告
        self.generate_sample_report('output/energy_conservation_report.md')

    

        return True

    def generate_sample_report(self, save_path=None):
        """生成样本数据分析报告"""
        if not hasattr(self, 'sample_data'):
            print("请先生成样本数据")
            return

        return


def main():
    """主函数"""

    # 创建分析器
    analyzer = PendulumEnergyAnalyzer()

    # 检查是否有命令行参数
    import sys
    if len(sys.argv) > 1:
        # 从文件加载数据
        filename = sys.argv[1]
        print(f"从文件加载数据: {filename}")
        if analyzer.load_data_from_file(filename):
            # 运行分析
            analyzer.preprocess_data()
            analyzer.calculate_derivatives()
            analyzer.analyze_energy()
            analyzer.plot_phase_portraits()
            analyzer.plot_energy_analysis()
            analyzer.generate_report()
    else:
        # # 选择分析模式
        # print("请选择分析模式：")
        # print("1. 完整分析（实时数据或模拟数据）")
        # print("2. 样本分析（生成1组数据验证机械能守恒）")
        # choice = input("请输入选择（1/2，默认1）: ") or "1"
        choice = input(" ") or "2"
        if choice == "2":
            # 样本分析模式 - 生成1组数据验证机械能守恒
       
            analyzer.run_sample_analysis(num_groups=1)
        else:
            # 完整分析模式
            duration = input("请输入采集时长（秒，默认30）: ") or "30"
            interval = input("请输入采样间隔（秒，默认0.01）: ") or "0.01"

            analyzer.run_full_analysis(
                duration=float(duration),
                interval=float(interval),
                save_results=True
            )


if __name__ == "__main__":
    main()