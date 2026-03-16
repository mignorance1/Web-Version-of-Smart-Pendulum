from typing import Optional, Tuple
from .Exporter import PendulumState
import math
import cv2
import numpy as np
from loguru import logger


HSV_LOWER = [40, 70, 70]
HSV_UPPER = [80, 255, 255]


class Detector:
    """识别器基类."""

    pass


class Detector_HSV(Detector):
    """识别器类,使用HSV法."""

    """识别器类,使用HSV法."""

    def __init__(self, lower: list = None, upper: list = None):
        if lower is None:
            lower = HSV_LOWER
        if upper is None:
            upper = HSV_UPPER
        _lower = np.array(lower)
        _upper = np.array(upper)
        PendulumState.setHsv(_lower, _upper)
        self.physicalLength: float = 120.0

    def setPhysicalLength(self, Length: float) -> None:
        self.physicalLength = Length

    def calibrate(self, hsv_frame, roi) -> None:
        try:
            x, y, w, h = roi
            hsv_height, hsv_width = hsv_frame.shape[:2]
            
            print(f"🔍 HSV校准调试信息:")
            print(f"  原始ROI: ({x}, {y}, {w}, {h})")
            print(f"  HSV图像尺寸: {hsv_width}x{hsv_height}")
            logger.info(f"🔍 HSV校准调试信息:")
            logger.info(f"  原始ROI: ({x}, {y}, {w}, {h})")
            logger.info(f"  HSV图像尺寸: {hsv_width}x{hsv_height}")
            
            # 边界检查和调整
            original_x, original_y, original_w, original_h = x, y, w, h
            x = max(0, min(x, hsv_width - 1))
            y = max(0, min(y, hsv_height - 1))
            w = max(1, min(w, hsv_width - x))
            h = max(1, min(h, hsv_height - y))
            
            print(f"  边界调整: 原始({original_x}, {original_y}, {original_w}, {original_h}) -> 调整后({x}, {y}, {w}, {h})")
            logger.info(f"  调整后ROI: ({x}, {y}, {w}, {h})")
            
            roi_hsv = hsv_frame[y : y + h, x : x + w]
            logger.info(f"  ROI区域大小: {roi_hsv.shape}")
            
            if roi_hsv.size == 0:
                logger.warning("❌ ROI区域为空，无法进行HSV校准")
                return
                
            mean_hsv = cv2.mean(roi_hsv)[:3]
            std_hsv = np.std(roi_hsv.reshape(-1, 3), axis=0)
            
            print(f"  ROI区域平均HSV: {mean_hsv}")
            print(f"  ROI区域HSV标准差: {std_hsv}")
            logger.info(f"  ROI区域平均HSV: {mean_hsv}")
            logger.info(f"  ROI区域HSV标准差: {std_hsv}")

            h_tol = max(5, std_hsv[0] * 2)
            s_tol = max(30, std_hsv[1] * 2)
            v_tol = max(30, std_hsv[2] * 2)

            tol = np.array([h_tol, s_tol, v_tol])
            logger.info(f"  计算的容差: {tol}")

            new_lower = np.clip(
                np.array(mean_hsv) - tol, [0, 0, 0], [179, 255, 255]
            ).astype(int)
            new_upper = np.clip(
                np.array(mean_hsv) + tol, [0, 0, 0], [179, 255, 255]
            ).astype(int)

            logger.info(f"  初始HSV阈值: 下限={new_lower.tolist()}, 上限={new_upper.tolist()}")

            if np.any(new_upper - new_lower < [5, 10, 10]):
                logger.warning("⚠️ 计算出的HSV阈值范围太小，使用默认容差")
                tol = np.array([10, 50, 50])
                new_lower = np.clip(
                    np.array(mean_hsv) - tol, [0, 0, 0], [179, 255, 255]
                ).astype(int)
                new_upper = np.clip(
                    np.array(mean_hsv) + tol, [0, 0, 0], [179, 255, 255]
                ).astype(int)
                logger.info(f"  使用默认容差后的HSV阈值: 下限={new_lower.tolist()}, 上限={new_upper.tolist()}")

            PendulumState.setHsv(new_lower, new_upper)

            logger.info(f"✅ HSV校准成功: ROI=({x},{y},{w},{h})")
            print(f"  最终HSV阈值: 下限={PendulumState.hsv_lower.tolist()}, 上限={PendulumState.hsv_upper.tolist()}")
            logger.info(f"  最终HSV阈值: 下限={PendulumState.hsv_lower.tolist()}, 上限={PendulumState.hsv_upper.tolist()}")
        except Exception as e:
            logger.error(f"❌ HSV校准失败: {str(e)}")
            PendulumState.setHsv(np.array(HSV_LOWER), np.array(HSV_UPPER))

    def getHsvMask(
        self, frame
    ):
        self.hsv_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        lower = np.array(PendulumState.hsv_lower)
        upper = np.array(PendulumState.hsv_upper)
        self.mask_frame = cv2.inRange(self.hsv_frame, lower, upper)
        return self.mask_frame, self.hsv_frame

    def getBallCenter(
        self, mask_frame = None
    ) -> Tuple[Optional[Tuple[int, int]], Optional[np.ndarray]]:
        if mask_frame is None:
            mask_frame = self.mask_frame
        contours, _ = cv2.findContours(
            mask_frame, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        if contours:
            c = max(contours, key=cv2.contourArea)
            M = cv2.moments(c)
            if M["m00"] != 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
                return (cx, cy), c
        return None, None


class Analyzer:
    def __init__(self, alpha: float = 0.8):
        self.PIVOT_POINT: Optional[Tuple[int, int]] = None
        self.ORIGIN_POINT: Optional[Tuple[int, int]] = None
        self.REFERENCE_ANGLE: Optional[float] = None
        self.REFERENCE_VECTOR: Optional[Tuple[float, float]] = None  # 参考摆线方向向量
        self.alpha = alpha
        self._prev_angle: Optional[float] = None
        # 自动摆轴识别相关参数
        self.auto_pivot_enabled: bool = True
        self.pivot_detection_history: list = []
        self.pivot_confidence_threshold: float = 0.7
        self.max_pivot_distance: int = 300  # 最大摆轴距离

    def updateMouse(self, event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            self.PIVOT_POINT = (x, y)
            self.REFERENCE_ANGLE = None
            self.REFERENCE_VECTOR = None
            logger.info(f"已设置摆轴固定点: {self.PIVOT_POINT},清除参考角度和参考向量")
            PendulumState.update(
                pivot_x=float(x), pivot_y=float(y), reference_angle=0.0
            )
        elif event == cv2.EVENT_RBUTTONDOWN:
            self.ORIGIN_POINT = (x, y)
            logger.info(f"已设置坐标原点: {self.ORIGIN_POINT}")

    def getAngleAndLine(
        self, frame: np.ndarray, ball_center: Tuple[int, int]
    ) -> Optional[Tuple[float, Tuple[int, int, int, int], Tuple[int, int]]]:
        if not ball_center:
            return None, None, None

        angle_rel = None
        line = None

        # 优先使用手动设置的摆轴
        if self.PIVOT_POINT and self.PIVOT_POINT[0] is not None:
            # 使用已知的摆轴点计算角度
            dx = ball_center[0] - self.PIVOT_POINT[0]
            dy = ball_center[1] - self.PIVOT_POINT[1]

            # 如果没有参考角度，设置当前角度为参考
            if self.REFERENCE_ANGLE is None:
                self.REFERENCE_ANGLE = math.degrees(math.atan2(dx, dy))

            # 计算相对角度
            current_angle = math.degrees(math.atan2(dx, dy))
            angle_rel = current_angle - self.REFERENCE_ANGLE

            line = (*self.PIVOT_POINT, *ball_center)
        else:
            # 使用自动检测的摆轴或霍夫变换
            if self.auto_pivot_enabled and hasattr(self, 'auto_detected_pivot'):
                # 使用自动检测的摆轴
                auto_pivot = self.auto_detected_pivot
                dx = ball_center[0] - auto_pivot[0]
                dy = ball_center[1] - auto_pivot[1]

                if self.REFERENCE_ANGLE is None:
                    self.REFERENCE_ANGLE = math.degrees(math.atan2(dx, dy))

                current_angle = math.degrees(math.atan2(dx, dy))
                angle_rel = current_angle - self.REFERENCE_ANGLE
                line = (*auto_pivot, *ball_center)
            else:
                # 使用霍夫变换检测摆线
                edges = cv2.Canny(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), 50, 150)
                angle_raw, line = self._getHoughAngle(edges, ball_center)
                if angle_raw is not None:
                    if self.REFERENCE_ANGLE is None:
                        self.REFERENCE_ANGLE = angle_raw
                    angle_rel = angle_raw - self.REFERENCE_ANGLE
                else:
                    return None, None, None

        if angle_rel is not None:
            # 角度平滑处理
            if self._prev_angle is not None:
                angle_rel = self.alpha * self._prev_angle + (1 - self.alpha) * angle_rel
            self._prev_angle = angle_rel

            # 计算相对原点的位置
            x0 = ball_center[0] - (self.ORIGIN_POINT[0] if self.ORIGIN_POINT else 0)
            y0 = ball_center[1] - (self.ORIGIN_POINT[1] if self.ORIGIN_POINT else 0)

            return angle_rel, line, (x0, y0)

        return None, None, None

    def _calculateAngleBetweenVectors(self, vec1: Tuple[float, float], vec2: Tuple[float, float]) -> float:
        """计算两个向量之间的夹角（以度为单位）
        
        Args:
            vec1: 第一个向量 (dx1, dy1)
            vec2: 第二个向量 (dx2, dy2)
            
        Returns:
            夹角（度），正值表示逆时针旋转，负值表示顺时针旋转
        """
        # 计算向量的点积
        dot_product = vec1[0] * vec2[0] + vec1[1] * vec2[1]
        
        # 计算向量的模长
        mag1 = math.sqrt(vec1[0] * vec1[0] + vec1[1] * vec1[1])
        mag2 = math.sqrt(vec2[0] * vec2[0] + vec2[1] * vec2[1])
        
        # 避免除零错误
        if mag1 == 0 or mag2 == 0:
            return 0.0
        
        # 计算夹角的余弦值
        cos_angle = dot_product / (mag1 * mag2)
        
        # 限制余弦值在[-1, 1]范围内，避免数值误差
        cos_angle = max(-1.0, min(1.0, cos_angle))
        
        # 计算夹角（弧度）
        angle_rad = math.acos(cos_angle)
        
        # 计算叉积的符号来确定旋转方向
        cross_product = vec1[0] * vec2[1] - vec1[1] * vec2[0]
        
        # 转换为度，并根据叉积符号确定方向
        angle_deg = math.degrees(angle_rad)
        if cross_product < 0:
            angle_deg = -angle_deg
            
        return angle_deg

    def _getHoughAngle(
        self, edges: np.ndarray, ball_center: Tuple[int, int]
    ) -> Tuple[Optional[float], Optional[Tuple[int, int, int, int]]]:
        x, y = ball_center
        search_h = 200
        region = edges[max(0, y - search_h) : y, max(0, x - 50) : x + 50]
        if region.size == 0:
            return None, None
        lines = cv2.HoughLinesP(
            region, 1, np.pi / 180, threshold=30, minLineLength=30, maxLineGap=10
        )
        best_line = None
        best_dist = float("inf")
        best_angle = None
        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]
                # 映射到全图坐标
                gx1, gy1 = x1 + x - 50, y1 + y - search_h
                gx2, gy2 = x2 + x - 50, y2 + y - search_h
                # 取距离球心最近的线段
                dist = min(np.hypot(gx1 - x, gy1 - y), np.hypot(gx2 - x, gy2 - y))
                if dist < best_dist:
                    best_dist = dist
                    best_line = (gx1, gy1, gx2, gy2)
                    dx = gx2 - gx1
                    dy = gy2 - gy1
                    # 注意这里使用dx, dy计算相对竖直的角度
                    best_angle = math.degrees(math.atan2(dx, dy))
        return best_angle, best_line

    def autoDetectPivot(self, frame: np.ndarray, ball_center: Tuple[int, int]) -> Optional[Tuple[int, int]]:
        """自动检测摆轴位置
        
        Args:
            frame: 输入图像
            ball_center: 小球中心位置
            
        Returns:
            检测到的摆轴位置，如果检测失败返回None
        """
        if not ball_center:
            return None
            
        x, y = ball_center
        height, width = frame.shape[:2]
        
        # 转换为灰度图
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # 边缘检测
        edges = cv2.Canny(gray, 50, 150)
        
        # 在小球上方区域检测直线
        search_height = min(400, y)  # 搜索高度
        search_width = min(200, width // 2)  # 搜索宽度
        
        # 定义搜索区域（小球上方）
        y_start = max(0, y - search_height)
        y_end = y
        x_start = max(0, x - search_width)
        x_end = min(width, x + search_width)
        
        search_region = edges[y_start:y_end, x_start:x_end]
        
        if search_region.size == 0:
            return None
            
        # 霍夫变换检测直线
        lines = cv2.HoughLinesP(
            search_region, 
            rho=1, 
            theta=np.pi/180, 
            threshold=20, 
            minLineLength=50, 
            maxLineGap=20
        )
        
        if lines is None:
            return None
            
        # 分析检测到的直线，寻找最可能的摆轴
        best_pivot = None
        best_score = 0
        
        for line in lines:
            x1, y1, x2, y2 = line[0]
            
            # 转换到全局坐标
            gx1, gy1 = x1 + x_start, y1 + y_start
            gx2, gy2 = x2 + x_start, y2 + y_start
            
            # 计算直线参数
            if gx2 - gx1 == 0:  # 垂直线
                continue
                
            # 计算直线斜率
            slope = (gy2 - gy1) / (gx2 - gx1)
            
            # 计算直线与小球的距离
            # 使用点到直线的距离公式
            A = slope
            B = -1
            C = gy1 - slope * gx1
            
            distance = abs(A * x + B * y + C) / math.sqrt(A * A + B * B)
            
            # 计算摆轴候选位置（直线延长线与图像上边界的交点）
            pivot_y = 0
            if abs(slope) < 0.1:  # 接近水平线
                pivot_x = x
            else:
                pivot_x = gx1 + (pivot_y - gy1) / slope
                
            # 检查摆轴是否在合理范围内
            if pivot_x < 0 or pivot_x >= width:
                continue
                
            # 计算评分（距离越小，角度越垂直，评分越高）
            angle_score = abs(slope)  # 越垂直越好
            distance_score = max(0, 1 - distance / 50)  # 距离越近越好
            length_score = min(1, math.hypot(gx2 - gx1, gy2 - gy1) / 100)  # 长度越长越好
            
            total_score = angle_score * 0.4 + distance_score * 0.4 + length_score * 0.2
            
            if total_score > best_score:
                best_score = total_score
                best_pivot = (int(pivot_x), int(pivot_y))
        
        # 如果找到合适的摆轴，且还没有设置过自动摆轴，则设置一次
        if best_pivot and best_score > self.pivot_confidence_threshold and not hasattr(self, 'auto_detected_pivot'):
            # 使用历史记录的平均位置作为最终摆轴
            self.pivot_detection_history.append({
                'pivot': best_pivot,
                'score': best_score,
                'ball_center': ball_center
            })
            
            # 保持历史记录在合理范围内
            if len(self.pivot_detection_history) > 10:
                self.pivot_detection_history.pop(0)
                
            # 使用历史记录的平均位置作为最终摆轴
            if len(self.pivot_detection_history) >= 3:
                avg_x = sum(item['pivot'][0] for item in self.pivot_detection_history) / len(self.pivot_detection_history)
                avg_y = sum(item['pivot'][1] for item in self.pivot_detection_history) / len(self.pivot_detection_history)
                final_pivot = (int(avg_x), int(avg_y))
                
                # 设置自动检测的摆轴（只设置一次）
                self.auto_detected_pivot = final_pivot
                logger.info(f"自动检测并设置摆轴: {final_pivot}, 置信度: {best_score:.3f}")
                return final_pivot
                
        return None

    def setReferenceAngle(self, ball_center: Tuple[int, int]) -> None:
        if not ball_center:
            return
            
        # 确定摆轴位置（优先使用手动设置的，否则使用自动检测的）
        pivot_point = None
        if self.PIVOT_POINT:
            pivot_point = self.PIVOT_POINT
        elif hasattr(self, 'auto_detected_pivot'):
            pivot_point = self.auto_detected_pivot
            
        if not pivot_point:
            logger.warning("没有可用的摆轴，无法设置参考角度")
            return
            
        # 计算参考摆线方向向量
        dx = ball_center[0] - pivot_point[0]
        dy = ball_center[1] - pivot_point[1]
        self.REFERENCE_VECTOR = (dx, dy)
        
        # 计算参考角度（相对于垂直向下的角度）
        self.REFERENCE_ANGLE = math.degrees(math.atan2(dx, dy))
        
        logger.info(f"参考摆线向量设为: {self.REFERENCE_VECTOR} (摆轴: {pivot_point})")
        logger.info(f"参考角度设为: {self.REFERENCE_ANGLE:.2f}°")

    def setReferenceAngleFromKey(self, frame: np.ndarray, ball_center: Tuple[int, int]) -> None:
        """按z键设置参考角度（零点）

        Args:
            frame: 输入图像
            ball_center: 小球中心位置
        """
        if not ball_center:
            logger.warning("没有小球位置，无法设置参考角度")
            return

        # 优先使用手动设置的摆轴
        if self.PIVOT_POINT and self.PIVOT_POINT[0] is not None:
            dx = ball_center[0] - self.PIVOT_POINT[0]
            dy = ball_center[1] - self.PIVOT_POINT[1]
            self.REFERENCE_ANGLE = math.degrees(math.atan2(dx, dy))
            logger.info(f"参考角度设为: {self.REFERENCE_ANGLE:.2f}° (摆轴: {self.PIVOT_POINT})")
        # 如果没有摆轴，尝试使用霍夫变换
        else:
            edges = cv2.Canny(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), 50, 150)
            angle_raw, line = self._getHoughAngle(edges, ball_center)
            if angle_raw is not None:
                self.REFERENCE_ANGLE = angle_raw
                logger.info(f"参考角度设为: {self.REFERENCE_ANGLE:.2f}° (霍夫检测)")
            else:
                logger.warning("无法检测摆线，无法设置参考角度")

    def cleanRef(self) -> None:
        self.PIVOT_POINT = None
        self.ORIGIN_POINT = None
        self.REFERENCE_ANGLE = None
        self.REFERENCE_VECTOR = None
        self._prev_angle = None
        # 清除自动检测的摆轴
        if hasattr(self, 'auto_detected_pivot'):
            delattr(self, 'auto_detected_pivot')
        self.pivot_detection_history.clear()
        logger.info("已删除摆轴固定点、参考角度、参考向量和自动检测摆轴")

    def refPrint(self) -> None:
        logger.info(self.PIVOT_POINT)
        logger.info(self.ORIGIN_POINT)
        logger.info(self.REFERENCE_ANGLE)

    def enableAutoPivotDetection(self, enabled: bool = True) -> None:
        """启用或禁用自动摆轴检测
        
        Args:
            enabled: 是否启用自动摆轴检测
        """
        self.auto_pivot_enabled = enabled
        if enabled:
            logger.info("自动摆轴检测已启用")
        else:
            logger.info("自动摆轴检测已禁用")

    def clearPivotHistory(self) -> None:
        """清除摆轴检测历史记录"""
        self.pivot_detection_history.clear()
        logger.info("摆轴检测历史记录已清除")
