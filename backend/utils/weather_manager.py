import requests
import json
from datetime import datetime
from typing import Dict, Optional, Tuple
import os
from dataclasses import dataclass
from dotenv import load_dotenv
from config.config import Config

# Load environment variables from .env file
load_dotenv()

@dataclass
class WeatherData:
    """Data class for weather information"""
    condition: str
    temperature: float
    humidity: int
    visibility: float
    precipitation_type: str
    wind_speed: float
    timestamp: datetime

class WeatherManager:
    """Manages weather data collection and integration for road-user behaviour analysis"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('WEATHER_API_KEY')
        self.base_url = "http://api.openweathermap.org/data/2.5"
        
        # Debug: Check if API key is loaded
        if self.api_key:
            print(f"[INFO] Weather API key loaded: {self.api_key[:8]}...")
        else:
            print("[WARNING] No weather API key found in environment variables")
            print(f"[DEBUG] Available env vars: {[k for k in os.environ.keys() if 'WEATHER' in k.upper()]}")
        
    def get_current_weather(self, lat: float, lon: float) -> Optional[WeatherData]:
        """
        Get current weather data for a specific location with performance optimization
        
        Args:
            lat: Latitude
            lon: Longitude
            
        Returns:
            WeatherData object or None if failed
        """
        if not self.api_key:
            print("[INFO] No weather API key provided. Using default weather data for performance.")
            return self._get_default_weather()
        
        try:
            url = f"{self.base_url}/weather"
            params = {
                'lat': lat,
                'lon': lon,
                'appid': self.api_key,
                'units': 'metric'
            }
            
            response = requests.get(url, params=params, timeout=Config.WEATHER_API_TIMEOUT)
            response.raise_for_status()
            
            data = response.json()
            return self._parse_weather_data(data)
            
        except Exception as e:
            print(f"[ERROR] Failed to fetch weather data: {e}")
            return self._get_default_weather()
    
    def _parse_weather_data(self, data: Dict) -> WeatherData:
        """Parse weather API response into WeatherData object"""
        weather_main = data.get('weather', [{}])[0].get('main', 'unknown').lower()
        weather_desc = data.get('weather', [{}])[0].get('description', 'unknown').lower()
        
        # Map weather conditions to standardized values
        condition = self._map_weather_condition(weather_main, weather_desc)
        
        # Determine precipitation type
        precipitation_type = self._determine_precipitation_type(weather_main, weather_desc)
        
        return WeatherData(
            condition=condition,
            temperature=data.get('main', {}).get('temp', 20.0),
            humidity=data.get('main', {}).get('humidity', 70),
            visibility=data.get('visibility', 10000) / 1000,  # Convert to km
            precipitation_type=precipitation_type,
            wind_speed=data.get('wind', {}).get('speed', 5.0),
            timestamp=datetime.now()
        )
    
    def _map_weather_condition(self, main: str, description: str) -> str:
        """Map weather conditions to standardized values"""
        condition_mapping = {
            'clear': ['clear', 'clear sky'],
            'cloudy': ['clouds', 'cloudy', 'overcast'],
            'rainy': ['rain', 'drizzle', 'shower'],
            'snowy': ['snow', 'sleet'],
            'foggy': ['fog', 'mist', 'haze'],
            'stormy': ['thunderstorm'],
            'windy': ['wind']
        }
        
        for condition, keywords in condition_mapping.items():
            if any(keyword in main.lower() or keyword in description.lower() for keyword in keywords):
                return condition
        
        return 'unknown'
    
    def _determine_precipitation_type(self, main: str, description: str) -> str:
        """Determine precipitation type from weather data"""
        if 'rain' in main.lower() or 'rain' in description.lower():
            return 'rain'
        elif 'snow' in main.lower() or 'snow' in description.lower():
            return 'snow'
        elif 'sleet' in main.lower() or 'sleet' in description.lower():
            return 'sleet'
        elif 'hail' in main.lower() or 'hail' in description.lower():
            return 'hail'
        else:
            return 'none'
    
    def _get_default_weather(self) -> WeatherData:
        """Get default weather data when API is not available"""
        return WeatherData(
            condition='clear',
            temperature=20.0,
            humidity=70,
            visibility=10.0,
            precipitation_type='none',
            wind_speed=5.0,
            timestamp=datetime.now()
        )
    
    def get_weather_for_analysis(self, lat: float, lon: float) -> Dict:
        """
        Get weather data formatted for database insertion
        
        Args:
            lat: Latitude
            lon: Longitude
            
        Returns:
            Dictionary with weather data for database
        """
        weather = self.get_current_weather(lat, lon)
        
        return {
            'weather_condition': weather.condition,
            'temperature': weather.temperature,
            'humidity': weather.humidity,
            'visibility': weather.visibility,
            'precipitation_type': weather.precipitation_type,
            'wind_speed': weather.wind_speed
        }
    
    def analyze_weather_impact(self, tracking_data: list) -> Dict:
        """
        Analyze the impact of weather conditions on driver behaviour
        
        Args:
            tracking_data: List of tracking records with weather data
            
        Returns:
            Dictionary with weather impact analysis
        """
        if not tracking_data:
            return {}
        
        # Group by weather condition
        weather_groups = {}
        for record in tracking_data:
            condition = record.get('weather_condition', 'unknown')
            if condition not in weather_groups:
                weather_groups[condition] = []
            weather_groups[condition].append(record)
        
        analysis = {
            'weather_conditions': {},
            'compliance_by_weather': {},
            'reaction_times_by_weather': {},
            'recommendations': []
        }
        
        for condition, records in weather_groups.items():
            total_vehicles = len(records)
            compliant_vehicles = sum(1 for r in records if r.get('compliance') == 1)
            compliance_rate = (compliant_vehicles / total_vehicles * 100) if total_vehicles > 0 else 0
            
            # Calculate average reaction time
            reaction_times = [r.get('reaction_time') for r in records if r.get('reaction_time') is not None]
            avg_reaction_time = sum(reaction_times) / len(reaction_times) if reaction_times else None
            
            analysis['weather_conditions'][condition] = {
                'total_vehicles': total_vehicles,
                'compliance_rate': compliance_rate,
                'avg_reaction_time': avg_reaction_time
            }
            
            analysis['compliance_by_weather'][condition] = compliance_rate
            analysis['reaction_times_by_weather'][condition] = avg_reaction_time
        
        # Generate recommendations
        analysis['recommendations'] = self._generate_weather_recommendations(analysis)
        
        return analysis
    
    def _generate_weather_recommendations(self, analysis: Dict) -> list:
        """Generate recommendations based on weather impact analysis"""
        recommendations = []
        
        # Check for poor weather conditions with low compliance
        for condition, data in analysis['weather_conditions'].items():
            if data['compliance_rate'] < 80 and condition in ['rainy', 'foggy', 'snowy']:
                recommendations.append({
                    'type': 'warning',
                    'message': f"Low compliance rate ({data['compliance_rate']:.1f}%) in {condition} weather. Consider enhanced signage or warnings.",
                    'condition': condition,
                    'compliance_rate': data['compliance_rate']
                })
            
            # Check for slow reaction times in poor weather
            if data['avg_reaction_time'] and data['avg_reaction_time'] > 3.0 and condition in ['rainy', 'foggy', 'snowy']:
                recommendations.append({
                    'type': 'info',
                    'message': f"Slow average reaction time ({data['avg_reaction_time']:.1f}s) in {condition} weather. Drivers may need more time to respond.",
                    'condition': condition,
                    'avg_reaction_time': data['avg_reaction_time']
                })
        
        return recommendations

# Global instance for easy access
weather_manager = WeatherManager()
