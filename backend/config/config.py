import numpy as np
import os
import cv2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def _parse_polygon(env_var: str, default: list) -> np.ndarray:
    """Parse polygon coordinates from environment variable.
    Format: comma-separated values like "x1,y1,x2,y2,x3,y3,x4,y4"
    """
    polygon_str = os.getenv(env_var)
    if polygon_str:
        try:
            coords = [int(x.strip()) for x in polygon_str.split(',')]
            # Reshape to pairs: [(x1,y1), (x2,y2), ...]
            polygon_points = [(coords[i], coords[i+1]) for i in range(0, len(coords), 2)]
            return np.array(polygon_points)
        except (ValueError, IndexError) as e:
            print(f"[WARNING] Failed to parse {env_var}, using default: {e}")
    return np.array(default)

def _parse_polygon_required(env_var: str) -> np.ndarray:
    """Parse polygon coordinates from environment variable (required).
    Raises ValueError if environment variable is missing or invalid.
    Format: comma-separated values like "x1,y1,x2,y2,x3,y3,x4,y4"
    """
    polygon_str = os.getenv(env_var)
    if not polygon_str:
        raise ValueError(f"Required environment variable {env_var} is not set. Please configure it in your .env file.")
    
    try:
        coords = [int(x.strip()) for x in polygon_str.split(',')]
        if len(coords) < 6 or len(coords) % 2 != 0:
            raise ValueError(f"{env_var} must contain an even number of coordinates (at least 3 points, 6 values)")
        # Reshape to pairs: [(x1,y1), (x2,y2), ...]
        polygon_points = [(coords[i], coords[i+1]) for i in range(0, len(coords), 2)]
        return np.array(polygon_points)
    except (ValueError, IndexError) as e:
        raise ValueError(f"Failed to parse {env_var}: {e}. Expected format: 'x1,y1,x2,y2,x3,y3,x4,y4'") from e

def _parse_tuple(env_var: str, default: tuple, dtype=int) -> tuple:
    """Parse tuple from environment variable.
    Format: comma-separated values like "0,255,255"
    """
    tuple_str = os.getenv(env_var)
    if tuple_str:
        try:
            values = [dtype(x.strip()) for x in tuple_str.split(',')]
            return tuple(values)
        except ValueError as e:
            print(f"[WARNING] Failed to parse {env_var}, using default: {e}")
    return default

def _parse_int(env_var: str, default: int) -> int:
    """Parse integer from environment variable."""
    value = os.getenv(env_var)
    if value:
        try:
            return int(value)
        except ValueError:
            print(f"[WARNING] Failed to parse {env_var} as int, using default: {default}")
    return default

def _parse_float(env_var: str, default: float) -> float:
    """Parse float from environment variable."""
    value = os.getenv(env_var)
    if value:
        try:
            return float(value)
        except ValueError:
            print(f"[WARNING] Failed to parse {env_var} as float, using default: {default}")
    return default

def _parse_float_required(env_var: str) -> float:
    """Parse float from environment variable (required).
    Raises ValueError if environment variable is missing or invalid.
    """
    value = os.getenv(env_var)
    if not value:
        raise ValueError(f"Required environment variable {env_var} is not set. Please configure it in your .env file.")
    
    try:
        return float(value)
    except ValueError as e:
        raise ValueError(f"Failed to parse {env_var} as float: {e}. Expected a numeric value.") from e

def _parse_bool(env_var: str, default: bool) -> bool:
    """Parse boolean from environment variable."""
    value = os.getenv(env_var)
    if value:
        return value.lower() in ('true', '1', 'yes', 'on')
    return default

class Config:
    """Configuration class to centralize all settings"""
    # Get the backend root directory (parent of config directory)
    BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # File Paths (relative to backend root)
    VIDEO_PATH = os.path.join(BACKEND_ROOT, 'asset', 'videoplayback.mp4')  # Input video file path
    OUTPUT_VIDEO_PATH = os.path.join(BACKEND_ROOT, 'asset', 'TrackingWithStopResult.mp4')  # Output processed video path
    MODEL_PATH = os.path.join(BACKEND_ROOT, 'models', 'yolo12s.pt')  # YOLO model weights file path
    LICENSE_PLATE_MODEL_PATH = os.path.join(BACKEND_ROOT, 'models', 'best.pt')  # License plate detection model path
    ENABLE_LICENSE_PLATE_BLURRING = True  # Disable license plate blurring for performance
    
    # Detection Zones (required environment variables)
    SOURCE_POLYGON = _parse_polygon_required('SOURCE_POLYGON')  # Detection area polygon coordinates (required)
    STOP_ZONE_POLYGON = _parse_polygon_required('STOP_ZONE_POLYGON')  # Stop zone polygon coordinates (required)
    
    # Thresholds - Optimized for Performance (from environment variables)
    TARGET_WIDTH = _parse_int('TARGET_WIDTH', 50)  # Target dimensions for perspective transformation
    TARGET_HEIGHT = _parse_int('TARGET_HEIGHT', 130)  # Target dimensions for perspective transformation
    DETECTION_CONFIDENCE = _parse_float('DETECTION_CONFIDENCE', 0.25)  # Minimum confidence threshold for object detection
    NMS_THRESHOLD = _parse_float('NMS_THRESHOLD', 0.3)  # Non-Maximum Suppression threshold to remove duplicate detections
    VELOCITY_THRESHOLD = _parse_float('VELOCITY_THRESHOLD', 0.6)  # Threshold to determine if vehicle is stationary in pixels/frame
    FRAME_BUFFER = _parse_int('FRAME_BUFFER', 5)  # Number of frames to buffer for velocity calculation
    DETECTION_OVERLAP_THRESHOLD = _parse_float('DETECTION_OVERLAP_THRESHOLD', 0.5)  # IoU threshold for merging overlapping detections
    CLASS_CONFIDENCE_THRESHOLD = _parse_float('CLASS_CONFIDENCE_THRESHOLD', 0.5)  # Confidence threshold for stable class assignment
    CLASS_HISTORY_FRAMES = _parse_int('CLASS_HISTORY_FRAMES', 10)  # Number of frames to track for class consistency
    
    # Video Settings - Balanced for Quality and Performance (from environment variables)
    TARGET_FPS = _parse_int('TARGET_FPS', 30)  # Target 30 FPS for smooth playback
    FPS_UPDATE_INTERVAL = _parse_int('FPS_UPDATE_INTERVAL', 30)  # Interval (in frames) to update FPS display
    PROCESSING_FRAME_SKIP = _parse_int('PROCESSING_FRAME_SKIP', 2)  # Skip every N frames during processing
    
    # Visual Settings (from environment variables)
    ANNOTATION_THICKNESS = _parse_int('ANNOTATION_THICKNESS', 1)  # Thickness of bounding box lines
    TEXT_SCALE = _parse_float('TEXT_SCALE', 0.4)  # Scale factor for text labels
    TEXT_THICKNESS = _parse_int('TEXT_THICKNESS', 1)  # Thickness of text labels
    TRACE_LENGTH_SECONDS = _parse_int('TRACE_LENGTH_SECONDS', 2)  # Length of tracking traces in seconds
    STOP_ZONE_COLOR = _parse_tuple('STOP_ZONE_COLOR', (0, 255, 255), dtype=int)  # Color for stop zone outline (BGR format)
    STOP_ZONE_LINE_THICKNESS = _parse_int('STOP_ZONE_LINE_THICKNESS', 2)  # Thickness of stop zone outline
    ANCHOR_Y_OFFSET = _parse_int('ANCHOR_Y_OFFSET', 0)  # Vertical offset for anchor points in pixels
    SHOW_ANCHOR_POINTS = _parse_bool('SHOW_ANCHOR_POINTS', True)  # Whether to display anchor points on vehicles
    ANCHOR_POINT_COLOR = _parse_tuple('ANCHOR_POINT_COLOR', (255, 0, 255), dtype=int)  # Color for anchor points (BGR format)
    ANCHOR_POINT_RADIUS = _parse_int('ANCHOR_POINT_RADIUS', 5)  # Radius of anchor point circles
    ANCHOR_POINT_THICKNESS = _parse_int('ANCHOR_POINT_THICKNESS', -1)  # Thickness of anchor point circles (-1 for filled, 1-3 for outline)
    
    # Vehicle Classes
    CLASS_NAMES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}  # YOLO class ID to vehicle type mapping
    
    # Display Settings (for API mode)
    # Auto-detect environment: enable display locally, disable in production
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
    # Display Settings (from environment variables)
    MAX_DISPLAY_WIDTH = _parse_int('MAX_DISPLAY_WIDTH', 1280)  # Maximum width for display window (resize if larger)
    DISPLAY_FRAME_SKIP = _parse_int('DISPLAY_FRAME_SKIP', 1)  # Skip every N frames for better performance (1 = no skip, 2 = skip every other frame)
    DISPLAY_WAIT_KEY_DELAY = _parse_int('DISPLAY_WAIT_KEY_DELAY', 1)  # Delay in milliseconds for cv2.waitKey() (1 = responsive, 0 = fastest)
    
    # Location Coordinates for Weather Data (required environment variables)
    # Camera location coordinates for weather data collection
    LOCATION_LAT = _parse_float_required('LOCATION_LAT')  # Latitude (required)
    LOCATION_LON = _parse_float_required('LOCATION_LON')  # Longitude (required)
    
    # WebSocket Streaming Configuration - Smooth Playback (30 FPS) (from environment variables)
    # Performance settings for smooth real-time video streaming
    STREAMING_FRAME_SKIP = _parse_int('STREAMING_FRAME_SKIP', 2)  # Send every Nth frame for balanced smoothness
    STREAMING_JPEG_QUALITY = _parse_int('STREAMING_JPEG_QUALITY', 85)  # Higher quality for better visual
    STREAMING_MAX_FRAME_SIZE = _parse_tuple('STREAMING_MAX_FRAME_SIZE', (1280, 720), dtype=int)  # Larger size for better quality (720p)
    STREAMING_QUEUE_SIZE = _parse_int('STREAMING_QUEUE_SIZE', 4)  # Slightly larger buffer for quality
    STREAMING_WORKERS = _parse_int('STREAMING_WORKERS', 4)  # More workers for better quality processing
    STREAMING_TARGET_FPS = _parse_int('STREAMING_TARGET_FPS', 30)  # Target 30 FPS for smooth playback
    
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
    
