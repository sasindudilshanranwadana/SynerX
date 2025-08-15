#!/usr/bin/env python3

import sys
import os

# Add the current directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_video_processor_initialization():
    """Test VideoProcessor initialization step by step"""
    print("Testing VideoProcessor initialization...")
    
    try:
        from core.video_processor import VideoProcessor
        from config.config import Config
        
        print(f"Video path: {Config.VIDEO_PATH}")
        print(f"Output path: {Config.OUTPUT_VIDEO_PATH}")
        
        # Check if video file exists
        if not os.path.exists(Config.VIDEO_PATH):
            print(f"❌ Video file not found: {Config.VIDEO_PATH}")
            return False
        
        print("✅ Video file exists")
        
        # Create VideoProcessor instance
        processor = VideoProcessor(mode="local")
        print("✅ VideoProcessor instance created")
        
        # Test initialization
        processor.initialize()
        print("✅ VideoProcessor initialization completed")
        
        return True
        
    except Exception as e:
        print(f"❌ Error in VideoProcessor initialization: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_video_processor_components():
    """Test individual VideoProcessor components"""
    print("Testing VideoProcessor components...")
    
    try:
        from utils.device_manager import DeviceManager
        from utils.annotation_manager import AnnotationManager
        from utils.display_manager import DisplayManager
        from utils.data_manager import DataManager
        from utils.heatmap import HeatMapGenerator
        from utils.view_transformer import ViewTransformer
        from utils.vehicle_tracker import VehicleTracker
        from config.config import Config
        
        # Test device manager
        device_manager = DeviceManager()
        device = device_manager.get_device()
        print(f"✅ Device manager: {device}")
        
        # Test annotation manager
        annotation_manager = AnnotationManager()
        print("✅ Annotation manager created")
        
        # Test display manager
        display_manager = DisplayManager()
        print("✅ Display manager created")
        
        # Test data manager
        data_manager = DataManager()
        print("✅ Data manager created")
        
        # Test heat map generator
        heat_map = HeatMapGenerator((1920, 1080))  # Example resolution
        print("✅ Heat map generator created")
        
        # Test view transformer
        transformer = ViewTransformer(Config.SOURCE_POLYGON, (Config.TARGET_WIDTH, Config.TARGET_HEIGHT))
        print("✅ View transformer created")
        
        # Test vehicle tracker
        vehicle_tracker = VehicleTracker()
        print("✅ Vehicle tracker created")
        
        return True
        
    except Exception as e:
        print(f"❌ Error in component test: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=== VideoProcessor Test Script ===")
    
    # Test components first
    if not test_video_processor_components():
        print("❌ Component test failed")
        sys.exit(1)
    
    # Test VideoProcessor initialization
    if not test_video_processor_initialization():
        print("❌ VideoProcessor initialization test failed")
        sys.exit(1)
    
    print("✅ All VideoProcessor tests passed!")
