#!/usr/bin/env python3
"""
Test script to verify weather data integration is working
"""

import sys
import os

# Add the backend root to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.weather_manager import weather_manager
from utils.correlation_analysis import run_correlation_analysis
from config.config import Config

def test_weather_data_collection():
    """Test weather data collection"""
    print("🌤️ Testing Weather Data Collection...")
    
    # Test weather data collection
    weather_data = weather_manager.get_weather_for_analysis(Config.LOCATION_LAT, Config.LOCATION_LON)
    
    print(f"📍 Location: {Config.LOCATION_LAT}, {Config.LOCATION_LON}")
    print(f"🌤️ Weather Data Collected:")
    for key, value in weather_data.items():
        print(f"   {key}: {value}")
    
    return weather_data

def test_correlation_analysis():
    """Test correlation analysis with weather data"""
    print("\n📊 Testing Correlation Analysis with Weather Data...")
    
    # Sample tracking data with weather
    sample_data = [
        {
            'tracker_id': 1,
            'vehicle_type': 'car',
            'compliance': 1,
            'reaction_time': 2.5,
            'weather_condition': 'clear',
            'temperature': 22.5,
            'humidity': 65,
            'visibility': 10.0,
            'precipitation_type': 'none',
            'wind_speed': 5.2,
            'date': '2024-01-01 10:00:00'
        },
        {
            'tracker_id': 2,
            'vehicle_type': 'truck',
            'compliance': 0,
            'reaction_time': None,
            'weather_condition': 'rainy',
            'temperature': 18.0,
            'humidity': 85,
            'visibility': 6.5,
            'precipitation_type': 'rain',
            'wind_speed': 12.8,
            'date': '2024-01-01 11:00:00'
        },
        {
            'tracker_id': 3,
            'vehicle_type': 'car',
            'compliance': 1,
            'reaction_time': 1.8,
            'weather_condition': 'cloudy',
            'temperature': 20.0,
            'humidity': 70,
            'visibility': 8.0,
            'precipitation_type': 'none',
            'wind_speed': 8.5,
            'date': '2024-01-01 12:00:00'
        }
    ]
    
    # Run correlation analysis
    analysis_results = run_correlation_analysis(sample_data)
    
    print("📈 Analysis Results:")
    print(f"   Basic Correlations: {len(analysis_results.get('basic_correlations', {}))} metrics")
    print(f"   Weather Analysis: {len(analysis_results.get('weather_analysis', {}))} weather metrics")
    print(f"   Behavioral Insights: {len(analysis_results.get('behavioral_insights', {}))} insights")
    print(f"   Recommendations: {len(analysis_results.get('recommendations', []))} recommendations")
    
    # Show weather analysis details
    weather_analysis = analysis_results.get('weather_analysis', {})
    if weather_analysis:
        print("\n🌤️ Weather Analysis Details:")
        for metric, data in weather_analysis.items():
            print(f"   {metric}: {data}")
    
    # Show recommendations
    recommendations = analysis_results.get('recommendations', [])
    if recommendations:
        print("\n💡 Recommendations:")
        for i, rec in enumerate(recommendations, 1):
            print(f"   {i}. {rec.get('message', 'No message')}")
    
    return analysis_results

def test_weather_impact_analysis():
    """Test weather impact analysis"""
    print("\n🔍 Testing Weather Impact Analysis...")
    
    # Sample tracking data
    sample_data = [
        {
            'tracker_id': 1,
            'vehicle_type': 'car',
            'compliance': 1,
            'reaction_time': 2.5,
            'weather_condition': 'clear',
            'temperature': 22.5,
            'humidity': 65,
            'visibility': 10.0,
            'precipitation_type': 'none',
            'wind_speed': 5.2,
            'date': '2024-01-01 10:00:00'
        },
        {
            'tracker_id': 2,
            'vehicle_type': 'truck',
            'compliance': 0,
            'reaction_time': None,
            'weather_condition': 'rainy',
            'temperature': 18.0,
            'humidity': 85,
            'visibility': 6.5,
            'precipitation_type': 'rain',
            'wind_speed': 12.8,
            'date': '2024-01-01 11:00:00'
        }
    ]
    
    # Run weather impact analysis
    impact_analysis = weather_manager.analyze_weather_impact(sample_data)
    
    print("🌦️ Weather Impact Analysis:")
    for condition, data in impact_analysis.get('weather_conditions', {}).items():
        print(f"   {condition}: {data}")
    
    return impact_analysis

def main():
    """Run all weather integration tests"""
    print("🚀 Weather Integration Test Suite")
    print("=" * 50)
    
    try:
        # Test 1: Weather data collection
        weather_data = test_weather_data_collection()
        
        # Test 2: Correlation analysis
        correlation_results = test_correlation_analysis()
        
        # Test 3: Weather impact analysis
        impact_results = test_weather_impact_analysis()
        
        print("\n✅ All tests completed successfully!")
        print("\n📋 Summary:")
        print(f"   🌤️ Weather data collected: {len(weather_data)} fields")
        print(f"   📊 Correlation analysis: {len(correlation_results)} result categories")
        print(f"   🔍 Weather impact analysis: {len(impact_results.get('weather_conditions', {}))} weather conditions analyzed")
        
        print("\n🎯 Weather integration is working correctly!")
        print("   The system will now collect and analyze weather data during video processing.")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
