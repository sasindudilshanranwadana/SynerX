#!/usr/bin/env python3
"""
Test script to simulate upload-video API endpoint functionality
This test processes a video file and returns the same response structure as the API
"""
import sys
import os
import time
import tempfile
import shutil
from pathlib import Path
from datetime import datetime

# Add the parent directory to the path so we can import from backend root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.config import Config
from core.video_processor import main, set_shutdown_flag, reset_shutdown_flag, check_shutdown
from clients.supabase_client import supabase_manager

def test_upload_video_simulation(video_path: str, output_dir: str = "test_output"):
    """
    Simulate the upload-video API endpoint functionality
    
    Args:
        video_path: Path to the input video file
        output_dir: Directory to save processed output
    
    Returns:
        dict: Same response structure as the API endpoint
    """
    start_time = time.time()
    print(f"[TEST] Starting upload video simulation for: {video_path}")
    
    # Create output directory
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    
    # Reset shutdown flag for this test
    reset_shutdown_flag()
    
    # Step 1: Validate input file
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")
    
    print(f"[TEST] Step 1: Input file validated: {video_path}")
    
    # Step 2: Generate output path
    suffix = Path(video_path).suffix or ".mp4"
    output_video_path = output_path / f"test_processed_{int(time.time())}{suffix}"
    print(f"[TEST] Step 2: Output path generated: {output_video_path}")
    
    # Step 3: Run video processing (same as API)
    print(f"[TEST] Step 3: Running video processing in API mode...")
    try:
        main(
            video_path=video_path,
            output_video_path=str(output_video_path),
            mode="api"  # API mode - save to database only
        )
        print(f"[TEST] Step 4: Video processing completed: {output_video_path}")
    except KeyboardInterrupt:
        processing_time = time.time() - start_time
        print(f"[TEST] Processing interrupted by user (Ctrl+C) after {processing_time:.2f} seconds")
        # Clean up output file
        if os.path.exists(output_video_path):
            os.unlink(output_video_path)
        raise
    except Exception as e:
        processing_time = time.time() - start_time
        print(f"[TEST] Processing failed after {processing_time:.2f} seconds: {e}")
        # Clean up output file
        if os.path.exists(output_video_path):
            os.unlink(output_video_path)
        raise
    
    # Step 4: Upload processed video to Supabase storage (same as API)
    processed_video_url = None
    try:
        processed_filename = f"test_processed_{int(time.time())}{suffix}"
        print("[TEST] Step 5: Uploading processed video to Supabase...")
        processed_video_url = supabase_manager.upload_video_to_storage(
            str(output_video_path), 
            file_name=processed_filename
        )
        print(f"[TEST] Step 6: Processed video uploaded: {processed_video_url}")
    except Exception as e:
        print(f"[TEST] Warning: Failed to upload processed video to Supabase: {e}")
    
    # Step 5: Get data from Supabase (same as API)
    tracking_data = []
    vehicle_counts = []
    print("[TEST] Step 7: Fetching analytics data from Supabase...")
    try:
        tracking_data = supabase_manager.get_tracking_data(limit=1000)
        vehicle_counts = supabase_manager.get_vehicle_counts(limit=1000)
        print(f"[TEST] Step 8: Got {len(tracking_data)} tracking records and {len(vehicle_counts)} vehicle counts.")
    except Exception as e:
        print(f"[TEST] Warning: Failed to retrieve data from Supabase: {e}")
        # Fallback to CSV files (same as API)
        if os.path.exists(Config.OUTPUT_CSV_PATH):
            with open(Config.OUTPUT_CSV_PATH) as f:
                tracking_data = f.read()
        if os.path.exists(Config.COUNT_CSV_PATH):
            with open(Config.COUNT_CSV_PATH) as f:
                vehicle_counts = f.read()
    
    # Step 6: Calculate processing statistics (same as API)
    processing_time = time.time() - start_time
    total_vehicles = len(tracking_data) if isinstance(tracking_data, list) else 0
    compliance_count = sum(1 for item in tracking_data if isinstance(item, dict) and item.get('compliance') == 1)
    compliance_rate = (compliance_count / total_vehicles * 100) if total_vehicles > 0 else 0
    print(f"[TEST] Step 9: Processing stats calculated. Time: {processing_time:.2f}s, Vehicles: {total_vehicles}, Compliance: {compliance_rate:.2f}%")
    
    # Step 7: Clean up output file (optional - keep for inspection)
    cleanup_output = input(f"[TEST] Keep output file {output_video_path} for inspection? (y/n): ").lower().strip()
    if cleanup_output != 'y':
        try:
            os.unlink(output_video_path)
            print("[TEST] Step 10: Output file cleaned up.")
        except Exception as e:
            print(f"[TEST] Warning: Failed to clean up output file: {e}")
    else:
        print(f"[TEST] Step 10: Output file kept at: {output_video_path}")
    
    print("[TEST] Step 11: Returning API response structure.")
    
    # Return same structure as API endpoint
    return {
        "status": "done",
        "processed_video_url": processed_video_url,
        "tracking_data": tracking_data,
        "vehicle_counts": vehicle_counts,
        "processing_stats": {
            "total_vehicles": total_vehicles,
            "compliance_rate": compliance_rate,
            "processing_time": processing_time,
            "total_processing_time": processing_time
        }
    }

def test_database_connectivity():
    """Test database connectivity before running main test"""
    print("[TEST] Testing database connectivity...")
    try:
        # Test vehicle_counts table
        supabase_manager.test_vehicle_counts_table()
        
        # Get current data
        tracking_data = supabase_manager.get_tracking_data(limit=5)
        vehicle_counts = supabase_manager.get_vehicle_counts(limit=5)
        
        print(f"[TEST] Database connectivity OK. Found {len(tracking_data)} tracking records and {len(vehicle_counts)} vehicle counts.")
        return True
    except Exception as e:
        print(f"[TEST] Database connectivity failed: {e}")
        return False

def main_test():
    """Main test function"""
    print("=" * 60)
    print("SYNERX UPLOAD VIDEO API SIMULATION TEST")
    print("=" * 60)
    
    # Test database connectivity first
    if not test_database_connectivity():
        print("[TEST] Skipping main test due to database connectivity issues.")
        return
    
    # Get video path from user or use default
    default_video = Config.VIDEO_PATH
    if os.path.exists(default_video):
        video_path = input(f"[TEST] Enter video path (or press Enter for default: {default_video}): ").strip()
        if not video_path:
            video_path = default_video
    else:
        video_path = input("[TEST] Enter video path: ").strip()
    
    if not video_path or not os.path.exists(video_path):
        print("[TEST] Error: Invalid video path provided.")
        return
    
    # Run the simulation
    try:
        result = test_upload_video_simulation(video_path)
        
        # Display results
        print("\n" + "=" * 60)
        print("TEST RESULTS")
        print("=" * 60)
        print(f"Status: {result['status']}")
        print(f"Processing Time: {result['processing_stats']['processing_time']:.2f} seconds")
        print(f"Total Vehicles: {result['processing_stats']['total_vehicles']}")
        print(f"Compliance Rate: {result['processing_stats']['compliance_rate']:.2f}%")
        print(f"Processed Video URL: {result['processed_video_url']}")
        print(f"Tracking Records: {len(result['tracking_data']) if isinstance(result['tracking_data'], list) else 'N/A'}")
        print(f"Vehicle Counts: {len(result['vehicle_counts']) if isinstance(result['vehicle_counts'], list) else 'N/A'}")
        
        # Show sample data
        if isinstance(result['tracking_data'], list) and result['tracking_data']:
            print(f"\nSample Tracking Data:")
            for i, record in enumerate(result['tracking_data'][:3]):
                print(f"  {i+1}. Vehicle {record.get('tracker_id')} ({record.get('vehicle_type')}) - {record.get('status')} (Compliance: {record.get('compliance')})")
        
        if isinstance(result['vehicle_counts'], list) and result['vehicle_counts']:
            print(f"\nSample Vehicle Counts:")
            for i, count in enumerate(result['vehicle_counts'][:3]):
                print(f"  {i+1}. {count.get('vehicle_type')}: {count.get('count')} on {count.get('date')}")
        
        print("\n[TEST] ✅ Test completed successfully!")
        
    except KeyboardInterrupt:
        print("\n[TEST] ❌ Test interrupted by user.")
    except Exception as e:
        print(f"\n[TEST] ❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main_test() 