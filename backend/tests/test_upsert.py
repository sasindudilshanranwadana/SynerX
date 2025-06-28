#!/usr/bin/env python3
"""
Test script to verify upsert approach works
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from clients.supabase_client import supabase_manager
from datetime import datetime

def test_upsert_approach():
    """Test the upsert approach for both vehicle counts and tracking data"""
    print("Testing upsert approach...")
    
    # Test 1: Vehicle count upsert
    print("\n1. Testing vehicle count upsert...")
    test_type = "upsert_test"
    test_date = "2025-06-30"
    
    # First upsert
    print("   First upsert with count 1...")
    success = supabase_manager.save_vehicle_count(test_type, 1, test_date)
    print(f"   First upsert result: {success}")
    
    # Second upsert (should update)
    print("   Second upsert with count 5...")
    success = supabase_manager.save_vehicle_count(test_type, 5, test_date)
    print(f"   Second upsert result: {success}")
    
    # Third upsert (should update again)
    print("   Third upsert with count 10...")
    success = supabase_manager.save_vehicle_count(test_type, 10, test_date)
    print(f"   Third upsert result: {success}")
    
    # Verify final result
    counts = supabase_manager.get_vehicle_counts(limit=10)
    for count in counts:
        if count.get('vehicle_type') == test_type and count.get('date') == test_date:
            print(f"   Final count: {count.get('count')}")
            if count.get('count') == 10:
                print("   ✅ Vehicle count upsert works!")
            else:
                print(f"   ❌ Vehicle count upsert failed - got {count.get('count')}")
            break
    
    # Test 2: Tracking data upsert
    print("\n2. Testing tracking data upsert...")
    test_tracker_id = 999
    
    # First upsert
    print("   First upsert with 'moving' status...")
    test_data = {
        "tracker_id": test_tracker_id,
        "vehicle_type": "test_car",
        "status": "moving",
        "compliance": 0,
        "reaction_time": None,
        "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    success = supabase_manager.save_tracking_data(test_data)
    print(f"   First upsert result: {success}")
    
    # Second upsert (should update)
    print("   Second upsert with 'entered' status...")
    test_data["status"] = "entered"
    test_data["compliance"] = 0
    success = supabase_manager.save_tracking_data(test_data)
    print(f"   Second upsert result: {success}")
    
    # Third upsert (should update again)
    print("   Third upsert with 'stationary' status...")
    test_data["status"] = "stationary"
    test_data["compliance"] = 1
    test_data["reaction_time"] = 3.5
    success = supabase_manager.save_tracking_data(test_data)
    print(f"   Third upsert result: {success}")
    
    # Verify final result
    tracking_data = supabase_manager.get_tracking_data(limit=10)
    for record in tracking_data:
        if record.get('tracker_id') == test_tracker_id:
            print(f"   Final status: {record.get('status')}, compliance: {record.get('compliance')}, reaction_time: {record.get('reaction_time')}")
            if record.get('status') == 'stationary' and record.get('compliance') == 1:
                print("   ✅ Tracking data upsert works!")
            else:
                print(f"   ❌ Tracking data upsert failed - status: {record.get('status')}, compliance: {record.get('compliance')}")
            break
    
    print("\n✅ Upsert test completed!")

if __name__ == "__main__":
    test_upsert_approach() 