import numpy as np
import os
import cv2

class Config:
    """Configuration class to centralize all settings"""
    # Get the backend root directory (parent of config directory)
    BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # File Paths (relative to backend root)
    VIDEO_PATH = os.path.join(BACKEND_ROOT, 'asset', 'videoplayback.mp4')  # Input video file path
    OUTPUT_VIDEO_PATH = os.path.join(BACKEND_ROOT, 'asset', 'TrackingWithStopResult.mp4')  # Output processed video path
    MODEL_PATH = os.path.join(BACKEND_ROOT, 'models', 'yolo12s.pt')  # YOLO model weights file path
    LICENSE_PLATE_MODEL_PATH = os.path.join(BACKEND_ROOT, 'models', 'best.pt')  # License plate detection model path
    
    # Detection Zones
    SOURCE_POLYGON = np.array([(422, 10), (594, 16), (801, 665), (535, 649)])  # Detection area polygon coordinates
    STOP_ZONE_POLYGON = np.array([(507, 199), (681, 209), (751, 555), (484, 541)])  # Stop zone polygon coordinates
    
    # Thresholds - Optimized for Performance
    TARGET_WIDTH, TARGET_HEIGHT = 50, 130  # Target dimensions for perspective transformation
    DETECTION_CONFIDENCE = 0.25  # Minimum confidence threshold for object detection (Original: 0.25 for better detection)
    NMS_THRESHOLD = 0.3  # Non-Maximum Suppression threshold to remove duplicate detections (Original: 0.3 for better detection)
    VELOCITY_THRESHOLD = 0.6  # Threshold to determine if vehicle is stationary in pixels/frame (Range: 0.1-2.0, Recommended: 0.5-1.0 based on video resolution)
    FRAME_BUFFER = 5  # Number of frames to buffer for velocity calculation (Optimized: 5 for faster processing)
    DETECTION_OVERLAP_THRESHOLD = 0.5  # IoU threshold for merging overlapping detections (Range: 0.3-0.8, Recommended: 0.5-0.6 for optimal merging)
    CLASS_CONFIDENCE_THRESHOLD = 0.5  # Confidence threshold for stable class assignment (Original: 0.5 for better detection)
    CLASS_HISTORY_FRAMES = 10  # Number of frames to track for class consistency (Range: 3-20, Recommended: 5-15 frames)
    
    # Video Settings - Balanced for Quality and Performance
    TARGET_FPS = 30  # Target 30 FPS for smooth playback
    FPS_UPDATE_INTERVAL = 30  # Interval (in frames) to update FPS display (Range: 10-100, Recommended: 30-60 frames)
    PROCESSING_FRAME_SKIP = 2  # Skip every N frames during processing (2 = process every 2nd frame for better performance)
    STREAMING_FRAME_SKIP = 3  # Skip frames for streaming to reduce bandwidth and improve quality
    
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
    
    # Display Settings (for API mode)
    # Auto-detect environment: enable display locally, disable in production
    import os
    import platform
    
    # Check if we're in a headless environment
    is_headless = (
        os.getenv('RUNPOD_POD_ID') is not None or  # RunPod
        os.getenv('COLAB_GPU') is not None or     # Google Colab
        os.getenv('DISPLAY') is None and platform.system() == 'Linux'  # Linux without display
    )
    
    ENABLE_DISPLAY = (
        os.getenv('ENABLE_DISPLAY', 'auto').lower() == 'true' or
        (os.getenv('ENABLE_DISPLAY', 'auto').lower() == 'auto' and not is_headless)
    )
    MAX_DISPLAY_WIDTH = 1280  # Maximum width for display window (resize if larger)
    DISPLAY_FRAME_SKIP = 1  # Skip every N frames for better performance (1 = no skip, 2 = skip every other frame)
    DISPLAY_WAIT_KEY_DELAY = 1  # Delay in milliseconds for cv2.waitKey() (1 = responsive, 0 = fastest)
    
    # Location Coordinates for Weather Data
    # Camera location coordinates for weather data collection
    LOCATION_LAT = -37.740585  # Latitude (Melbourne, Australia)
    LOCATION_LON = 144.731637  # Longitude (Melbourne, Australia)
    
    # WebSocket Streaming Configuration - Smooth Playback (30 FPS)
    # Performance settings for smooth real-time video streaming
    STREAMING_FRAME_SKIP = 2  # Send every 2nd frame for smoother playback (30 FPS)
    STREAMING_JPEG_QUALITY = 85  # Balanced quality for smooth streaming
    STREAMING_MAX_FRAME_SIZE = (960, 540)  # 540p for smoother streaming
    STREAMING_QUEUE_SIZE = 4  # Smaller buffer for more responsive streaming
    STREAMING_WORKERS = 4  # Balanced workers for smooth performance
    STREAMING_TARGET_FPS = 30  # Target 30 FPS for smooth playback
    
    # Conditional interpolation based on environment
    try:
        import cv2
        STREAMING_INTERPOLATION = cv2.INTER_LINEAR  # Better quality interpolation
    except ImportError:
        STREAMING_INTERPOLATION = None  # Will use alternative method
    
    # Performance Optimization Settings
    ENABLE_FP16_PRECISION = True  # Enable half-precision for faster inference
    ENABLE_MODEL_WARMUP = True  # Enable model warmup for first inference
    MEMORY_CLEAR_INTERVAL = 100  # Clear GPU memory every N frames
    # ANNOTATION_SKIP_FRAMES = 3  # Disabled for consistent label display
    ENABLE_BATCH_PROCESSING = False  # Enable batch processing (experimental)
    MAX_DETECTIONS_PER_FRAME = 50  # Limit detections per frame for performance
    
    # Tracking Stability Settings
    ENABLE_TRACKING_SMOOTHING = True  # Enable tracking smoothing for stable labels
    TRACKING_HISTORY_LENGTH = 10  # Number of frames to keep tracking history
    MIN_TRACKING_CONFIDENCE = 0.2  # Minimum confidence to maintain tracking
    TRACKING_PREDICTION_FRAMES = 3  # Number of frames to predict when tracking is lost
    
    
    # Weather API Performance Settings
    ENABLE_WEATHER_API = True  # Enable weather API calls (disable for maximum performance)
    WEATHER_CACHE_DURATION = 300  # Weather cache duration in seconds (5 minutes)
    WEATHER_API_TIMEOUT = 5  # Weather API timeout in seconds
    
