#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试单摆机械能守恒验证程序
"""

import sys
import os

# 添加当前目录到路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from 调用API验证机械能守恒示例 import PendulumEnergyAnalyzer

    # 创建分析器
    analyzer = PendulumEnergyAnalyzer()

    # 运行样本分析
    print("开始生成单摆数据验证机械能守恒...")
    success = analyzer.run_sample_analysis(num_groups=1)

    if success:
        print("程序执行完成！")

        # 检查输出文件
        output_dir = "output"
        if os.path.exists(output_dir):
            files = os.listdir(output_dir)
            print(f"生成的文件：")
            for file in files:
                print(f"  - {file}")
        else:
            print("输出目录不存在")
    else:
        print("程序执行失败")

except Exception as e:
    print(f"程序运行出错：{e}")
    import traceback
    traceback.print_exc()