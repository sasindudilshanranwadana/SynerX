import cv2
import numpy as np

class HeatMapGenerator:
    """Handles heat map generation"""
    
    def __init__(self, resolution_wh):
        self.W, self.H = resolution_wh
        self.heat_raw = np.zeros((self.H, self.W), dtype=np.float32)
        self.KERNEL = cv2.getGaussianKernel(25, 7)
        self.KERNEL = (self.KERNEL @ self.KERNEL.T).astype(np.float32)
        self.kH, self.kW = self.KERNEL.shape
    
    def accumulate(self, detections):
        """Accumulate detection data for heat map"""
        for (x1, y1, x2, y2), conf in zip(detections.xyxy, detections.confidence):
            cx, cy = int((x1 + x2) / 2), int((y1 + y2) / 2)
            
            x0, x1p = max(0, cx - self.kW // 2), min(self.W, cx + self.kW // 2 + 1)
            y0, y1p = max(0, cy - self.kH // 2), min(self.H, cy + self.kH // 2 + 1)
            
            kx0, ky0 = x0 - (cx - self.kW // 2), y0 - (cy - self.kH // 2)
            kx1, ky1 = kx0 + (x1p - x0), ky0 + (y1p - y0)

            self.heat_raw[y0:y1p, x0:x1p] += self.KERNEL[ky0:ky1, kx0:kx1] * conf
    
    def save_heat_maps(self, first_frame=None):
        """Save heat map images"""
        heat_norm = cv2.normalize(self.heat_raw, None, 0, 255, cv2.NORM_MINMAX)
        heat_color = cv2.applyColorMap(heat_norm.astype(np.uint8), cv2.COLORMAP_JET)
        cv2.imwrite("./asset/heatmap.png", heat_color)
        
        if first_frame is not None and first_frame.size:
            overlay = cv2.addWeighted(first_frame, 0.55, heat_color, 0.45, 0)
            cv2.imwrite("./asset/heatmap_overlay.png", overlay)
        
        print("[INFO] Heat-map images saved ➜ asset/heatmap*.png")
