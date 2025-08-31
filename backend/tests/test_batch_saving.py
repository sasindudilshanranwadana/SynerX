#!/usr/bin/env python3
"""
Test batch saving functionality for both tracking data and vehicle counts
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clients.supabase_client import supabase_manager
from datetime import datetime

def test_batch_tracking_saving():
    """Test batch saving of tracking data"""
    print("🧪 Testing batch tracking data saving...")
    
    # Create test tracking data
    test_tracking_data = [
        {
            "tracker_id": 9991,
            "vehicle_type": "car",
            "status": "stationary",
            "compliance": 1,
            "reaction_time": 2.5,
            "weather_condition": "clear",
            "temperature": 25.0,
            "humidity": 60,
            "visibility": 10.0,
            "precipitation_type": "none",
            "wind_speed": 5.0,
            "date": datetime.now().isoformat()
        },
        {
            "tracker_id": 9992,
            "vehicle_type": "truck",
            "status": "moving",
            "compliance": 0,
            "reaction_time": None,
            "weather_condition": "clear",
            "temperature": 25.0,
            "humidity": 60,
            "visibility": 10.0,
            "precipitation_type": "none",
            "wind_speed": 5.0,
            "date": datetime.now().isoformat()
        }
    ]
    
    # Test batch save
    success = supabase_manager.save_tracking_data_batch(test_tracking_data)
    print(f"✅ Batch tracking save result: {success}")
    
    return success

def test_batch_vehicle_count_saving():
    """Test batch saving of vehicle counts"""
    print("🧪 Testing batch vehicle count saving...")
    
    # Create test vehicle count data
    test_vehicle_counts = [
        {
            "vehicle_type": "car",
            "count": 15,
            "date": datetime.now().strftime("%Y-%m-%d")
        },
        {
            "vehicle_type": "truck",
            "count": 8,
            "date": datetime.now().strftime("%Y-%m-%d")
        },
        {
            "vehicle_type": "bus",
            "count": 3,
            "date": datetime.now().strftime("%Y-%m-%d")
        }
    ]
    
    # Test batch save
    success = supabase_manager.save_vehicle_count_batch(test_vehicle_counts)
    print(f"✅ Batch vehicle count save result: {success}")
    
    return success

def test_individual_vs_batch_performance():
    """Test performance difference between individual and batch saves"""
    print("🧪 Testing performance: individual vs batch saves...")
    
    import time
    
    # Test individual saves
    test_data = [
        {
            "tracker_id": 9993,
            "vehicle_type": "car",
            "status": "stationary",
            "compliance": 1,
            "reaction_time": 2.5,
            "weather_condition": "clear",
            "temperature": 25.0,
            "humidity": 60,
            "visibility": 10.0,
            "precipitation_type": "none",
            "wind_speed": 5.0,
            "date": datetime.now().isoformat()
        }
    ] * 10  # 10 records
    
    # Individual saves
    start_time = time.time()
    for data in test_data:
        supabase_manager.save_tracking_data(data)
    individual_time = time.time() - start_time
    
    # Batch save
    start_time = time.time()
    supabase_manager.save_tracking_data_batch(test_data)
    batch_time = time.time() - start_time
    
    print(f"⏱️ Individual saves (10 records): {individual_time:.3f}s")
    print(f"⏱️ Batch save (10 records): {batch_time:.3f}s")
    print(f"🚀 Performance improvement: {individual_time/batch_time:.1f}x faster")
    
    return batch_time < individual_time

if __name__ == "__main__":
    print("🚀 Starting batch saving tests...")
    
    # Run tests
    tracking_success = test_batch_tracking_saving()
    count_success = test_batch_vehicle_count_saving()
    performance_success = test_individual_vs_batch_performance()
    
    print("\n📊 Test Results:")
    print(f"✅ Tracking batch save: {'PASS' if tracking_success else 'FAIL'}")
    print(f"✅ Vehicle count batch save: {'PASS' if count_success else 'FAIL'}")
    print(f"✅ Performance improvement: {'PASS' if performance_success else 'FAIL'}")
    
    if all([tracking_success, count_success, performance_success]):
        print("\n🎉 All tests passed! Batch saving is working correctly.")
    else:
        print("\n❌ Some tests failed. Please check the implementation.")
