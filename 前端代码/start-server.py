#!/usr/bin/env python3
"""
简单的HTTP服务器，用于测试前端页面
"""

import http.server
import socketserver
import os
import sys

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    """自定义请求处理器，添加CORS支持"""
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

def main():
    # 获取当前目录
    port = 8000
    
    # 切换到脚本所在目录
    if hasattr(sys, '_MEIPASS'):
        # 如果是打包后的exe
        application_path = sys._MEIPASS
    else:
        # 如果是脚本运行
        application_path = os.path.dirname(os.path.abspath(__file__))
    
    os.chdir(application_path)
    
    # 创建服务器
    with socketserver.TCPServer(("", port), CORSRequestHandler) as httpd:
        print(f"服务器启动在端口 {port}")
        print(f"请访问: http://localhost:{port}")
        print(f"可用的测试页面:")
        print(f"  - http://localhost:{port}/test-file-loading.html")
        print(f"  - http://localhost:{port}/test-all.html")
        print(f"  - http://localhost:{port}/index.html")
        print(f"按 Ctrl+C 停止服务器")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n服务器已停止")

if __name__ == "__main__":
    main()