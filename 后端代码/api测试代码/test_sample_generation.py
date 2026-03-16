#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试样本数据生成和相图绘制功能
"""

import os
import sys
sys.path.append('D:/Desktop/重构web (2)/重构web (8)API可DIY版/重构web (1)/旧后端代码/api测试代码')

from 调用API验证机械能守恒示例 import PendulumEnergyAnalyzer

def test_sample_generation():
    """测试样本数据生成"""
    print("=== 测试样本数据生成 ===")

    # 创建分析器
    analyzer = PendulumEnergyAnalyzer()

    # 生成少量样本数据用于测试
    print("生成5组样本数据...")
    analyzer.generate_sample_energy_data(num_groups=5, duration_per_group=10, interval=0.05)

    # 创建输出文件夹
    os.makedirs('output', exist_ok=True)

    # 生成单独相图
    print("生成单独相图...")
    analyzer.plot_individual_phase_portraits('output')

    # 生成报告
    print("生成分析报告...")
    analyzer.generate_sample_report('output/test_report.md')

    print("测试完成！")
    print("请检查 output/ 文件夹中的相图文件")

if __name__ == "__main__":
    test_sample_generation()