import cv2
import time


def rotate_frame_90_clockwise(frame):
    return cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)


def main():
    cap = cv2.VideoCapture(0)  # 摄像头索引为1

    # 设置分辨率和帧率
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    cap.set(cv2.CAP_PROP_FPS, 20)  # 降低FPS到20，减少CPU占用

    if not cap.isOpened():
        print("无法打开摄像头")
        return

    prev_time = time.time()
    frame_count = 0
    fps = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("无法读取帧")
            break

        # 旋转画面
        frame = rotate_frame_90_clockwise(frame)

        # 缩放到原始大小的1/2
        frame = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)

        # 帧率统计
        frame_count += 1
        current_time = time.time()
        if current_time - prev_time >= 1.0:
            fps = frame_count / (current_time - prev_time)
            prev_time = current_time
            frame_count = 0

        # 显示帧率
        cv2.putText(
            frame,
            f"FPS: {fps:.2f}",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 255, 0),
            2,
        )

        # 显示图像
        cv2.imshow("Camera 1 - Rotated + Scaled", frame)

        # 按q退出
        if cv2.waitKey(1) & 0xFF in {ord("q"), ord("Q")}:
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()


# 添加清华镜像（最新地址）
