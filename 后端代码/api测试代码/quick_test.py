#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
快速测试程序是否能正常运行
"""

import sys
import os

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    print("正在测试程序导入...")
    from 调用API验证机械能守恒示例 import PendulumEnergyAnalyzer
    print("✓ 导入成功")

    print("正在创建分析器...")
    analyzer = PendulumEnergyAnalyzer()
    print("✓ 分析器创建成功")

    print("正在生成样本数据...")
    analyzer.generate_sample_energy_data(num_groups=1, duration_per_group=5, interval=0.1)
    print("✓ 样本数据生成成功")

    print("程序准备就绪！")

except Exception as e:
    print(f"✗ 错误：{e}")
    import traceback
    traceback.print_exc()