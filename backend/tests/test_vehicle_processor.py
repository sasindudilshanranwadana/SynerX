#!/usr/bin/env python3

import sys
import os

# Add the current directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_vehicle_processor_creation():
    """Test VehicleProcessor creation and initialization"""
    print("Testing VehicleProcessor creation...")
    
    try:
        from utils.vehicle_processor import VehicleProcessor
        from utils.data_manager import DataManager
        from utils.vehicle_tracker import VehicleTracker
        
        # Create instances
        data_manager = DataManager()
        vehicle_tracker = VehicleTracker()
        
        print("✅ Components created successfully")
        
        # Test VehicleProcessor creation
        vehicle_processor = VehicleProcessor(vehicle_tracker, data_manager, "local")
        print("✅ VehicleProcessor created successfully")
        
        # Test initialization
        vehicle_processor.initialize_data()
        print("✅ Data initialization successful")
        
        # Test loading counts
        vehicle_processor.load_existing_counts()
        print("✅ Loading counts successful")
        
        # Test setup tracker offset
        vehicle_processor.setup_tracker_offset()
        print("✅ Tracker offset setup successful")
        
        return True
        
    except Exception as e:
        print(f"❌ Error in VehicleProcessor test: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_weather_integration():
    """Test weather integration in VehicleProcessor"""
    print("Testing weather integration...")
    
    try:
        from utils.vehicle_processor import VehicleProcessor
        from utils.data_manager import DataManager
        from utils.vehicle_tracker import VehicleTracker
        
        # Create instances
        data_manager = DataManager()
        vehicle_tracker = VehicleTracker()
        vehicle_processor = VehicleProcessor(vehicle_tracker, data_manager, "local")
        vehicle_processor.initialize_data()
        
        # Test weather data collection
        weather_data = vehicle_processor._get_current_weather_data()
        print(f"Weather data: {weather_data}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error in weather integration test: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=== VehicleProcessor Test Script ===")
    
    # Test VehicleProcessor creation and initialization
    if not test_vehicle_processor_creation():
        print("❌ VehicleProcessor test failed")
        sys.exit(1)
    
    # Test weather integration
    if not test_weather_integration():
        print("❌ Weather integration test failed")
        sys.exit(1)
    
    print("✅ All VehicleProcessor tests passed!")
