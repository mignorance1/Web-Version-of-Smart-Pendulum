from camera_api import init_camera_api, show_camera, close_camera_api


# 核心代码：调用API获取摄像头画面
def get_camera_display():
    # 初始化摄像头API并显示画面
    if init_camera_api(show_camera=True):
        try:
            # 保持程序运行以显示摄像头
            input("按 Enter 键关闭摄像头...")
        finally:
            # 关闭摄像头API
            close_camera_api()


if __name__ == "__main__":
    get_camera_display()