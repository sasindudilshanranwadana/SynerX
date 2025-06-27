#!/usr/bin/env python3
"""
Debug script to test CSV backup functionality
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.csv_manager import CSVManager
from config.config import Config
import csv

def test_csv_backup():
    """Test CSV backup functionality"""
    print("Testing CSV backup functionality...")
    
    # Test 1: Check if CSV file exists and what's in it
    print("\n1. Checking existing CSV file...")
    if os.path.exists(Config.OUTPUT_CSV_PATH):
        with open(Config.OUTPUT_CSV_PATH, 'r', newline='') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            print(f"   CSV file exists with {len(rows)} rows")
            for i, row in enumerate(rows[:5]):  # Show first 5 rows
                print(f"   Row {i+1}: {row}")
    else:
        print("   CSV file does not exist")
    
    # Test 2: Test the read_existing_data function
    print("\n2. Testing read_existing_data function...")
    existing_data = CSVManager.read_existing_data()
    print(f"   read_existing_data returned {len(existing_data)} records")
    for tid, data in list(existing_data.items())[:3]:  # Show first 3
        print(f"   Track {tid}: {data}")
    
    # Test 3: Simulate what happens during processing
    print("\n3. Simulating processing scenario...")
    
    # Create a mock history_dict with multiple vehicles
    mock_history = {
        "1": {
            "tracker_id": 1,
            "vehicle_type": "car",
            "status": "stationary",
            "compliance": 1,
            "reaction_time": 3.5,
            "date": "2025-06-27 20:00:00"
        },
        "2": {
            "tracker_id": 2,
            "vehicle_type": "truck",
            "status": "moving",
            "compliance": 0,
            "reaction_time": None,
            "date": "2025-06-27 20:01:00"
        },
        "3": {
            "tracker_id": 3,
            "vehicle_type": "car",
            "status": "stationary",
            "compliance": 1,
            "reaction_time": 2.8,
            "date": "2025-06-27 20:02:00"
        }
    }
    
    print(f"   Mock history has {len(mock_history)} vehicles")
    
    # Test 4: Call update_tracking_file with mock data
    print("\n4. Testing update_tracking_file with mock data...")
    try:
        result = CSVManager.update_tracking_file(mock_history)
        print(f"   update_tracking_file result: {result}")
    except Exception as e:
        print(f"   Error in update_tracking_file: {e}")
    
    # Test 5: Check what's in the CSV after the update
    print("\n5. Checking CSV after update...")
    if os.path.exists(Config.OUTPUT_CSV_PATH):
        with open(Config.OUTPUT_CSV_PATH, 'r', newline='') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            print(f"   CSV now has {len(rows)} rows")
            for i, row in enumerate(rows):
                print(f"   Row {i+1}: {row}")
    else:
        print("   CSV file still does not exist")
    
    print("\n✅ CSV debug test completed!")

def test_csv_append_scenario():
    """Test the scenario where new vehicles are added"""
    print("\n" + "="*50)
    print("Testing CSV append scenario...")
    
    # Step 1: Start with existing data
    print("\nStep 1: Starting with existing vehicles 1, 2, 3...")
    initial_history = {
        "1": {"tracker_id": 1, "vehicle_type": "car", "status": "stationary", "compliance": 1, "reaction_time": 3.5},
        "2": {"tracker_id": 2, "vehicle_type": "truck", "status": "moving", "compliance": 0, "reaction_time": None},
        "3": {"tracker_id": 3, "vehicle_type": "car", "status": "stationary", "compliance": 1, "reaction_time": 2.8}
    }
    
    CSVManager.update_tracking_file(initial_history)
    
    # Check CSV after step 1
    with open(Config.OUTPUT_CSV_PATH, 'r', newline='') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        print(f"   After step 1: CSV has {len(rows)} rows")
        for row in rows:
            print(f"   Vehicle {row['tracker_id']}: {row['vehicle_type']} - {row['status']}")
    
    # Step 2: Add vehicle 4
    print("\nStep 2: Adding vehicle 4...")
    updated_history = {
        "1": {"tracker_id": 1, "vehicle_type": "car", "status": "stationary", "compliance": 1, "reaction_time": 3.5},
        "2": {"tracker_id": 2, "vehicle_type": "truck", "status": "moving", "compliance": 0, "reaction_time": None},
        "3": {"tracker_id": 3, "vehicle_type": "car", "status": "stationary", "compliance": 1, "reaction_time": 2.8},
        "4": {"tracker_id": 4, "vehicle_type": "car", "status": "moving", "compliance": 0, "reaction_time": None}
    }
    
    CSVManager.update_tracking_file(updated_history)
    
    # Check CSV after step 2
    with open(Config.OUTPUT_CSV_PATH, 'r', newline='') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        print(f"   After step 2: CSV has {len(rows)} rows")
        for row in rows:
            print(f"   Vehicle {row['tracker_id']}: {row['vehicle_type']} - {row['status']}")
    
    print("\n✅ CSV append scenario test completed!")

if __name__ == "__main__":
    test_csv_backup()
    test_csv_append_scenario() 