#!/usr/bin/env python3

import sys
import os

# Add the current directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.weather_manager import weather_manager
from config.config import Config

def test_weather_manager():
    """Test if weather manager is working"""
    print("Testing weather manager...")
    
    try:
        # Test weather data collection
        lat = getattr(Config, 'LOCATION_LAT', -37.740585)
        lon = getattr(Config, 'LOCATION_LON', 144.731637)
        
        print(f"Getting weather for location: {lat}, {lon}")
        weather_data = weather_manager.get_weather_for_analysis(lat, lon)
        print(f"Weather data: {weather_data}")
        
        return True
    except Exception as e:
        print(f"Error testing weather manager: {e}")
        return False

def test_imports():
    """Test if all imports are working"""
    print("Testing imports...")
    
    try:
        from utils.vehicle_processor import VehicleProcessor
        from utils.data_manager import DataManager
        from utils.vehicle_tracker import VehicleTracker
        
        print("All imports successful!")
        return True
    except Exception as e:
        print(f"Import error: {e}")
        return False

if __name__ == "__main__":
    print("=== Simple Test Script ===")
    
    # Test imports first
    if not test_imports():
        print("❌ Import test failed")
        sys.exit(1)
    
    # Test weather manager
    if not test_weather_manager():
        print("❌ Weather manager test failed")
        sys.exit(1)
    
    print("✅ All tests passed!")
