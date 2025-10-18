import cv2
from ultralytics import YOLO

# CONFIG 
BLUR_KERNEL_SIZE = (23, 23)
BLUR_SIGMA = 30

# YOLO model cache
_model = None

def load_blur_model(model_path):
    """
    Load YOLOv8 model once and reuse.
    """
    global _model
    if _model is None:
        print(f"[INFO] Loading YOLOv8 model from {model_path}...")
        _model = YOLO(model_path)
        print("[INFO] Model loaded successfully")
    return _model

def blur_detections(frame, results):
    """
    Apply blur to detected bounding boxes.
    """
    for det in results.boxes:
        x1, y1, x2, y2 = map(int, det.xyxy[0])
        roi = frame[y1:y2, x1:x2]
        if roi.size > 0:
            blurred_roi = cv2.GaussianBlur(roi, BLUR_KERNEL_SIZE, BLUR_SIGMA)
            frame[y1:y2, x1:x2] = blurred_roi
    return frame

def blur_frame(frame, model):
    """
    Run model on frame and blur detected objects.
    """
    results = model(frame, verbose=False)[0]
    return blur_detections(frame, results)
