#!/usr/bin/env python3
"""
Test script to verify database fixes work properly
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from supabase_client import supabase_manager
from datetime import datetime

def test_vehicle_count_update():
    """Test vehicle count update functionality"""
    print("Testing vehicle count update...")
    
    # Test 1: Insert new vehicle count
    print("1. Testing insert new vehicle count...")
    success = supabase_manager.save_vehicle_count("test_car", 5, "2025-06-27")
    print(f"   Insert result: {success}")
    
    # Test 2: Update existing vehicle count
    print("2. Testing update existing vehicle count...")
    success = supabase_manager.save_vehicle_count("test_car", 10, "2025-06-27")
    print(f"   Update result: {success}")
    
    # Test 3: Check the data
    print("3. Checking saved data...")
    counts = supabase_manager.get_vehicle_counts(limit=10)
    for count in counts:
        if count.get('vehicle_type') == 'test_car' and count.get('date') == '2025-06-27':
            print(f"   Found test_car count: {count}")
            if count.get('count') != 10:
                print(f"   ❌ ERROR: Expected count 10, got {count.get('count')}")
            else:
                print(f"   ✅ Count updated successfully")
            break
    
    print("✅ Vehicle count tests completed!")

def test_tracking_data_update():
    """Test tracking data update functionality"""
    print("\nTesting tracking data update...")
    
    # Test 1: Insert new tracking data
    print("1. Testing insert new tracking data...")
    test_data = {
        "tracker_id": 999,
        "vehicle_type": "test_car",
        "status": "moving",
        "compliance": 0,
        "reaction_time": None,
        "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    success = supabase_manager.save_tracking_data(test_data)
    print(f"   Insert result: {success}")
    
    # Test 2: Update existing tracking data
    print("2. Testing update existing tracking data...")
    test_data["status"] = "stationary"
    test_data["compliance"] = 1
    test_data["reaction_time"] = 5.5
    success = supabase_manager.save_tracking_data(test_data)
    print(f"   Update result: {success}")
    
    # Test 3: Check the data
    print("3. Checking saved data...")
    tracking_data = supabase_manager.get_tracking_data(limit=10)
    for record in tracking_data:
        if record.get('tracker_id') == 999:
            print(f"   Found test tracking data: {record}")
            if record.get('status') != 'stationary':
                print(f"   ❌ ERROR: Expected status 'stationary', got '{record.get('status')}'")
            else:
                print(f"   ✅ Status updated successfully")
            break
    
    print("✅ Tracking data tests completed!")

def test_status_update():
    """Test status update functionality specifically"""
    print("\nTesting status update functionality...")
    
    # Test 1: Create a test vehicle with moving status
    print("1. Creating test vehicle with 'moving' status...")
    test_data = {
        "tracker_id": 888,
        "vehicle_type": "test_truck",
        "status": "moving",
        "compliance": 0,
        "reaction_time": None,
        "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    success = supabase_manager.save_tracking_data(test_data)
    print(f"   Initial insert result: {success}")
    
    # Test 2: Update to 'entered' status
    print("2. Updating status to 'entered'...")
    test_data["status"] = "entered"
    test_data["compliance"] = 0
    success = supabase_manager.save_tracking_data(test_data)
    print(f"   'entered' update result: {success}")
    
    # Test 3: Update to 'stationary' status
    print("3. Updating status to 'stationary'...")
    test_data["status"] = "stationary"
    test_data["compliance"] = 1
    test_data["reaction_time"] = 3.2
    success = supabase_manager.save_tracking_data(test_data)
    print(f"   'stationary' update result: {success}")
    
    # Test 4: Check final status
    print("4. Checking final status...")
    tracking_data = supabase_manager.get_tracking_data(limit=20)
    for record in tracking_data:
        if record.get('tracker_id') == 888:
            print(f"   Final record: {record}")
            if record.get('status') == 'stationary' and record.get('compliance') == 1:
                print(f"   ✅ Status update test passed!")
            else:
                print(f"   ❌ ERROR: Expected 'stationary' status with compliance=1")
            break
    
    print("✅ Status update tests completed!")

def test_vehicle_count_debug():
    """Debug vehicle count update issue"""
    print("\nDebugging vehicle count update issue...")
    
    # Test with a different date to avoid conflicts
    test_date = "2025-06-28"
    test_type = "debug_car"
    
    print(f"1. Testing with date: {test_date}, type: {test_type}")
    
    # Insert initial count
    print("2. Inserting initial count of 1...")
    success = supabase_manager.save_vehicle_count(test_type, 1, test_date)
    print(f"   Insert result: {success}")
    
    # Check what was actually saved
    print("3. Checking what was saved...")
    counts = supabase_manager.get_vehicle_counts(limit=20)
    for count in counts:
        if count.get('vehicle_type') == test_type and count.get('date') == test_date:
            print(f"   Found count record: {count}")
            break
    
    # Try to update
    print("4. Attempting to update count to 3...")
    success = supabase_manager.save_vehicle_count(test_type, 3, test_date)
    print(f"   Update result: {success}")
    
    # Check again
    print("5. Checking after update...")
    counts = supabase_manager.get_vehicle_counts(limit=20)
    for count in counts:
        if count.get('vehicle_type') == test_type and count.get('date') == test_date:
            print(f"   Found count record after update: {count}")
            if count.get('count') == 3:
                print(f"   ✅ Update worked!")
            else:
                print(f"   ❌ Update failed - count is still {count.get('count')}")
            break
    
    print("✅ Vehicle count debug completed!")

if __name__ == "__main__":
    test_vehicle_count_update()
    test_tracking_data_update()
    test_status_update()
    test_vehicle_count_debug() 