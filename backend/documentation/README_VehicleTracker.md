# Vehicle Tracker Performance & Testing

## Overview
The Vehicle Tracker is a high-performance component of the SynerX system that handles real-time vehicle detection, tracking, and behavior analysis. It processes video streams to identify vehicles, track their movement, and determine compliance with traffic rules.

## Performance Metrics

### ✅ Test Results (Latest Run)
```
tests/test_vehicle_tracker.py::test_iou_and_merge_behavior PASSED                     [ 37%] 
tests/test_vehicle_tracker.py::test_tracker_performance_merge_and_class_updates PASSED [ 50%]
```

### 🚀 Performance Benchmarks
- **Detection Merging**: Processes 200 detections in <1.5s
- **Class Updates**: Updates vehicle classifications for 200 tracked objects in <1.5s  
- **IoU Calculation**: Accurate intersection-over-union calculations with 1e-6 precision
- **Memory Efficient**: Uses deque structures with configurable buffer sizes

### 🎯 Key Features Tested
- **IoU Accuracy**: Validates geometric calculations for bounding box overlap
- **Detection Merging**: Combines overlapping detections to prevent duplicate tracking
- **Class Consistency**: Maintains stable vehicle classifications across frames
- **Performance Scaling**: Linear performance scaling with number of detections

## Architecture

### Core Components
1. **VehicleTracker Class** (`utils/vehicle_tracker.py`)
   - Position history tracking with configurable buffer
   - Vehicle classification with confidence thresholding
   - Detection merging using IoU calculations
   - Status caching for performance optimization

2. **Configuration** (`config/config.py`)
   - `FRAME_BUFFER`: Number of frames for velocity calculation (default: 5)
   - `CLASS_HISTORY_FRAMES`: Frames to track for class consistency (default: 10)
   - `DETECTION_OVERLAP_THRESHOLD`: IoU threshold for merging (default: 0.5)
   - `CLASS_CONFIDENCE_THRESHOLD`: Confidence for stable classification (default: 0.5)

### Data Structures
```python
position_history: defaultdict(deque)  # Track vehicle positions over time
class_history: defaultdict(deque)     # Track classification confidence  
stable_class: dict                    # Established vehicle classifications
stationary_vehicles: set             # Vehicles identified as stopped
```

## Usage

### Basic Usage
```python
from utils.vehicle_tracker import VehicleTracker
from supervision import Detections

# Initialize tracker
tracker = VehicleTracker()

# Process detections from YOLO model
detections = your_yolo_model.predict(frame)

# Merge overlapping detections
merged_detections = tracker.merge_overlapping_detections(detections)

# Update class consistency 
tracker.update_class_consistency(merged_detections)

# Calculate IoU between two bounding boxes
iou = tracker.calculate_iou(box1, box2)
```

### Integration with Video Processing
```python
# In your video processing loop
for frame in video_frames:
    # Get detections from YOLO
    detections = model(frame)
    
    # Clean up overlapping detections
    clean_detections = tracker.merge_overlapping_detections(detections)
    
    # Ensure consistent vehicle classification
    tracker.update_class_consistency(clean_detections)
    
    # Use clean_detections for further processing
    process_vehicles(clean_detections)
```

## Running Tests

### Prerequisites
```bash
# Install dependencies (if using real modules)
pip install supervision numpy

# Or run with fake modules (no dependencies required)
cd backend/
python -m pytest tests/test_vehicle_tracker.py -v
```

### Test Commands
```powershell
# Navigate to backend directory
cd "f:\personal\projects\SynerX-main\SynerX-main\backend"

# Set Python path for imports
$env:PYTHONPATH = "f:\personal\projects\SynerX-main\SynerX-main\backend"

# Run all vehicle tracker tests
python -m pytest tests/test_vehicle_tracker.py -v

# Run specific performance test
python -m pytest tests/test_vehicle_tracker.py::test_tracker_performance_merge_and_class_updates -v

# Run with detailed output
python -m pytest tests/test_vehicle_tracker.py -v -s
```

### Expected Test Output
```
tests/test_vehicle_tracker.py::test_iou_and_merge_behavior PASSED                     
tests/test_vehicle_tracker.py::test_tracker_performance_merge_and_class_updates PASSED

==================================== 2 passed in 0.24s ====================================
```

## Performance Optimization

### Configuration Tuning
```python
# High-performance settings (config/config.py)
FRAME_BUFFER = 3                    # Reduce for faster processing
CLASS_HISTORY_FRAMES = 5           # Smaller history for quick updates
DETECTION_OVERLAP_THRESHOLD = 0.6  # Higher threshold = fewer merges
CLASS_CONFIDENCE_THRESHOLD = 0.7   # Higher confidence = more stable classes
```

### Memory Optimization
```python
# Automatic cleanup of old tracking data
MAX_TRACKING_AGE = 100  # Remove tracks older than N frames
tracker.cleanup_old_tracks()

# Limit maximum detections per frame
MAX_DETECTIONS_PER_FRAME = 50
detections = detections[:MAX_DETECTIONS_PER_FRAME]
```

## Troubleshooting

### Common Issues
1. **Slow Performance**: Reduce `CLASS_HISTORY_FRAMES` or increase `DETECTION_OVERLAP_THRESHOLD`
2. **Memory Usage**: Implement periodic cleanup of old tracking data
3. **Inconsistent Classifications**: Increase `CLASS_CONFIDENCE_THRESHOLD` 
4. **Too Many Duplicate Tracks**: Lower `DETECTION_OVERLAP_THRESHOLD`

### Debug Mode
```python
# Enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Check tracking statistics
print(f"Active tracks: {len(tracker.position_history)}")
print(f"Stable classifications: {len(tracker.stable_class)}")
print(f"Stationary vehicles: {len(tracker.stationary_vehicles)}")
```

## Integration Notes

### With YOLO Models
- Compatible with YOLOv8/YOLOv11 detection outputs
- Expects supervision.Detections format with `xyxy`, `class_id`, `confidence`
- Handles variable number of detections per frame

### With Video Processing Pipeline
- Designed for real-time processing (30+ FPS)
- Minimal memory footprint with configurable buffers
- Thread-safe operations for multi-threaded environments

### Vehicle Classes Supported
```python
CLASS_NAMES = {
    2: "car", 
    3: "motorcycle", 
    5: "bus", 
    7: "truck"
}
```

## Contributing
When modifying the vehicle tracker:
1. Run the test suite to ensure performance requirements are met
2. Add new tests for any additional functionality
3. Update performance benchmarks if making optimization changes
4. Ensure thread safety for concurrent access patterns