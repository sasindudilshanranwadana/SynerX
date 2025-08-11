import numpy as np
import os

class Config:
    """Configuration class to centralize all settings"""
    # Get the backend root directory (parent of config directory)
    BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # File Paths (relative to backend root)
    VIDEO_PATH = os.path.join(BACKEND_ROOT, 'asset', 'videoplayback.mp4')  # Input video file path
    OUTPUT_VIDEO_PATH = os.path.join(BACKEND_ROOT, 'asset', 'TrackingWithStopResult.mp4')  # Output processed video path
    OUTPUT_CSV_PATH = os.path.join(BACKEND_ROOT, 'data', 'tracking_results.csv')  # CSV file for tracking results
    COUNT_CSV_PATH = os.path.join(BACKEND_ROOT, 'data', 'vehicle_count.csv')  # CSV file for vehicle counts
    MODEL_PATH = os.path.join(BACKEND_ROOT, 'models', 'yolo12s.pt')  # YOLO model weights file path
    
    # Detection Zones
    SOURCE_POLYGON = np.array([(422, 10), (594, 16), (801, 665), (535, 649)])  # Detection area polygon coordinates
    STOP_ZONE_POLYGON = np.array([(507, 199), (681, 209), (751, 555), (484, 541)])  # Stop zone polygon coordinates
    
    # Thresholds
    TARGET_WIDTH, TARGET_HEIGHT = 50, 130  # Target dimensions for perspective transformation
    DETECTION_CONFIDENCE = 0.3  # Minimum confidence threshold for object detection (Range: 0.1-0.9, Recommended: 0.3-0.5 for balance)
    NMS_THRESHOLD = 0.3  # Non-Maximum Suppression threshold to remove duplicate detections (Range: 0.1-0.7, Recommended: 0.4-0.5 for best results)
    VELOCITY_THRESHOLD = 0.6  # Threshold to determine if vehicle is stationary in pixels/frame (Range: 0.1-2.0, Recommended: 0.5-1.0 based on video resolution)
    FRAME_BUFFER = 10  # Number of frames to buffer for velocity calculation (Range: 5-30, Recommended: 10-15 for stable tracking)
    DETECTION_OVERLAP_THRESHOLD = 0.5  # IoU threshold for merging overlapping detections (Range: 0.3-0.8, Recommended: 0.5-0.6 for optimal merging)
    CLASS_CONFIDENCE_THRESHOLD = 0.7  # Confidence threshold for stable class assignment (Range: 0.5-0.9, Recommended: 0.6-0.8 for reliable classification)
    CLASS_HISTORY_FRAMES = 10  # Number of frames to track for class consistency (Range: 3-20, Recommended: 5-15 frames)
    
    # Video Settings
    TARGET_FPS = 25  # Target frames per second for output video (Range: 15-60, Recommended: 25-30 for real-time processing)
    FPS_UPDATE_INTERVAL = 30  # Interval (in frames) to update FPS display (Range: 10-100, Recommended: 30-60 frames)
    
    # Visual Settings
    ANNOTATION_THICKNESS = 1  # Thickness of bounding box lines (Range: 1-5, Recommended: 2-3 for visibility)
    TEXT_SCALE = 0.4  # Scale factor for text labels (Range: 0.3-1.0, Recommended: 0.5-0.7 for readability)
    TEXT_THICKNESS = 1  # Thickness of text labels (Range: 1-3, Recommended: 1-2)
    TRACE_LENGTH_SECONDS = 2  # Length of tracking traces in seconds (Range: 1-10, Recommended: 2-5 seconds)
    STOP_ZONE_COLOR = (0, 255, 255)  # Color for stop zone outline (BGR format)
    STOP_ZONE_LINE_THICKNESS = 2  # Thickness of stop zone outline (Range: 1-5, Recommended: 2-3 for visibility)
    ANCHOR_Y_OFFSET = 0  # Vertical offset for anchor points in pixels (Range: -20 to 20, Recommended: 0-10)
    SHOW_ANCHOR_POINTS = True  # Whether to display anchor points on vehicles
    ANCHOR_POINT_COLOR = (255, 0, 255)  # Color for anchor points (BGR format)
    ANCHOR_POINT_RADIUS = 5  # Radius of anchor point circles (Range: 2-10, Recommended: 3-7 pixels)
    ANCHOR_POINT_THICKNESS = -1  # Thickness of anchor point circles (-1 for filled, 1-3 for outline)
    
    # Vehicle Classes
    CLASS_NAMES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}  # YOLO class ID to vehicle type mapping
    
    # Display Settings (for local mode)
    ENABLE_DISPLAY = True  # Whether to show live video window in local mode
    MAX_DISPLAY_WIDTH = 1280  # Maximum width for display window (resize if larger)
    DISPLAY_FRAME_SKIP = 1  # Skip every N frames for better performance (1 = no skip, 2 = skip every other frame)
    DISPLAY_WAIT_KEY_DELAY = 1  # Delay in milliseconds for cv2.waitKey() (1 = responsive, 0 = fastest)
    

