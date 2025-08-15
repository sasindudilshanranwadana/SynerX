#!/usr/bin/env python3
"""
Simple test to verify database fixes work
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from clients.supabase_client import supabase_manager
from datetime import datetime

def test_simple_updates():
    """Test simple database updates"""
    print("Testing simple database updates...")
    
    # Test 1: Vehicle count update
    print("\n1. Testing vehicle count update...")
    test_type = "simple_test"
    test_date = "2025-06-29"
    
    # Insert
    print("   Inserting count of 1...")
    success = supabase_manager.save_vehicle_count(test_type, 1, test_date)
    print(f"   Insert result: {success}")
    
    # Update
    print("   Updating count to 5...")
    success = supabase_manager.save_vehicle_count(test_type, 5, test_date)
    print(f"   Update result: {success}")
    
    # Verify
    counts = supabase_manager.get_vehicle_counts(limit=10)
    for count in counts:
        if count.get('vehicle_type') == test_type and count.get('date') == test_date:
            print(f"   Final count: {count.get('count')}")
            if count.get('count') == 5:
                print("   ✅ Vehicle count update works!")
            else:
                print(f"   ❌ Vehicle count update failed - got {count.get('count')}")
            break
    
    # Test 2: Tracking data update
    print("\n2. Testing tracking data update...")
    test_tracker_id = 777
    
    # Insert
    print("   Inserting with 'moving' status...")
    test_data = {
        "tracker_id": test_tracker_id,
        "vehicle_type": "test_car",
        "status": "moving",
        "compliance": 0,
        "reaction_time": None,
        "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    success = supabase_manager.save_tracking_data(test_data)
    print(f"   Insert result: {success}")
    
    # Update
    print("   Updating to 'stationary' status...")
    test_data["status"] = "stationary"
    test_data["compliance"] = 1
    test_data["reaction_time"] = 2.5
    success = supabase_manager.save_tracking_data(test_data)
    print(f"   Update result: {success}")
    
    # Verify
    tracking_data = supabase_manager.get_tracking_data(limit=10)
    for record in tracking_data:
        if record.get('tracker_id') == test_tracker_id:
            print(f"   Final status: {record.get('status')}, compliance: {record.get('compliance')}")
            if record.get('status') == 'stationary' and record.get('compliance') == 1:
                print("   ✅ Tracking data update works!")
            else:
                print(f"   ❌ Tracking data update failed - status: {record.get('status')}, compliance: {record.get('compliance')}")
            break
    
    print("\n✅ Simple test completed!")

if __name__ == "__main__":
    test_simple_updates() 