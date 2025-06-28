#!/usr/bin/env python3
"""
Test script to verify local and API modes work correctly
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.video_processor import main
from config.config import Config
import tempfile
import shutil

def test_local_mode():
    """Test local mode with CSV files"""
    print("\n=== Testing Local Mode ===")
    
    # Create temporary video file for testing
    with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp_video:
        # Create a simple test video (just copy existing one if available)
        test_video_path = tmp_video.name
        if os.path.exists(Config.VIDEO_PATH):
            shutil.copy2(Config.VIDEO_PATH, test_video_path)
        else:
            print(f"Warning: No test video found at {Config.VIDEO_PATH}")
            return
    
    try:
        # Create temporary output path
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp_output:
            output_path = tmp_output.name
        
        # Run local mode
        print("Running local mode...")
        session_data = main(
            video_path=test_video_path,
            output_video_path=output_path,
            mode="local"
        )
        
        print(f"Local mode session data:")
        print(f"  Tracking data: {len(session_data.get('tracking_data', []))} records")
        print(f"  Vehicle counts: {session_data.get('vehicle_counts', [])}")
        
        # Check if CSV files were created/updated
        if os.path.exists(Config.OUTPUT_CSV_PATH):
            print(f"  ✅ Tracking CSV file exists: {Config.OUTPUT_CSV_PATH}")
        else:
            print(f"  ❌ Tracking CSV file missing: {Config.OUTPUT_CSV_PATH}")
            
        if os.path.exists(Config.COUNT_CSV_PATH):
            print(f"  ✅ Count CSV file exists: {Config.COUNT_CSV_PATH}")
        else:
            print(f"  ❌ Count CSV file missing: {Config.COUNT_CSV_PATH}")
        
        return session_data
        
    finally:
        # Cleanup
        try:
            os.unlink(test_video_path)
            os.unlink(output_path)
        except:
            pass

def test_api_mode():
    """Test API mode with database"""
    print("\n=== Testing API Mode ===")
    
    # Create temporary video file for testing
    with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp_video:
        # Create a simple test video (just copy existing one if available)
        test_video_path = tmp_video.name
        if os.path.exists(Config.VIDEO_PATH):
            shutil.copy2(Config.VIDEO_PATH, test_video_path)
        else:
            print(f"Warning: No test video found at {Config.VIDEO_PATH}")
            return
    
    try:
        # Create temporary output path
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp_output:
            output_path = tmp_output.name
        
        # Run API mode
        print("Running API mode...")
        session_data = main(
            video_path=test_video_path,
            output_video_path=output_path,
            mode="api"
        )
        
        print(f"API mode session data:")
        print(f"  Tracking data: {len(session_data.get('tracking_data', []))} records")
        print(f"  Vehicle counts: {session_data.get('vehicle_counts', [])}")
        
        return session_data
        
    finally:
        # Cleanup
        try:
            os.unlink(test_video_path)
            os.unlink(output_path)
        except:
            pass

if __name__ == "__main__":
    print("Testing Video Processor Modes")
    print("=" * 50)
    
    # Test local mode
    local_data = test_local_mode()
    
    # Test API mode
    api_data = test_api_mode()
    
    print("\n=== Summary ===")
    if local_data:
        print(f"Local mode processed {len(local_data.get('tracking_data', []))} vehicles")
    if api_data:
        print(f"API mode processed {len(api_data.get('tracking_data', []))} vehicles")
    
    print("\n✅ Mode testing completed!") 