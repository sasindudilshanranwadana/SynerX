import pandas as pd
import numpy as np
from scipy import stats
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Dict, List, Optional
import warnings
warnings.filterwarnings('ignore')
import json

def run_correlation_analysis(tracking_data: List[Dict]) -> Dict:
    """
    Run comprehensive correlation analysis on tracking data including weather factors
    
    Args:
        tracking_data: List of tracking records with weather data
        
    Returns:
        Dictionary containing correlation analysis results
    """
    if not tracking_data:
        return {}
    
    # Convert to DataFrame
    df = pd.DataFrame(tracking_data)
    
    analysis_results = {
        'basic_correlations': {},
        'weather_analysis': {},
        'behavioral_insights': {},
        'recommendations': []
    }
    
    # Basic correlations
    analysis_results['basic_correlations'] = _analyze_basic_correlations(df)
    
    # Weather-based analysis
    analysis_results['weather_analysis'] = _analyze_weather_correlations(df)
    
    # Behavioral insights
    analysis_results['behavioral_insights'] = _analyze_behavioral_patterns(df)
    
    # Generate recommendations
    analysis_results['recommendations'] = _generate_correlation_recommendations(analysis_results)
    
    return analysis_results

def _analyze_basic_correlations(df: pd.DataFrame) -> Dict:
    """Analyze basic correlations in tracking data"""
    correlations = {}
    
    # Vehicle type vs compliance
    if 'vehicle_type' in df.columns and 'compliance' in df.columns:
        vehicle_compliance = df.groupby('vehicle_type')['compliance'].agg(['mean', 'count']).round(3)
        correlations['vehicle_type_compliance'] = vehicle_compliance.to_dict('index')
    
    # Time of day vs compliance
    if 'date' in df.columns:
        df['hour'] = pd.to_datetime(df['date']).dt.hour
        hour_compliance = df.groupby('hour')['compliance'].agg(['mean', 'count']).round(3)
        correlations['hour_compliance'] = hour_compliance.to_dict('index')
    
    # Reaction time analysis
    if 'reaction_time' in df.columns:
        reaction_stats = {
            'mean': df['reaction_time'].mean(),
            'median': df['reaction_time'].median(),
            'std': df['reaction_time'].std(),
            'min': df['reaction_time'].min(),
            'max': df['reaction_time'].max()
        }
        correlations['reaction_time_stats'] = {k: round(v, 3) if v is not None else None for k, v in reaction_stats.items()}
    
    return correlations

def _analyze_weather_correlations(df: pd.DataFrame) -> Dict:
    """Analyze weather-related correlations"""
    weather_analysis = {}
    
    # Weather condition vs compliance
    if 'weather_condition' in df.columns and 'compliance' in df.columns:
        weather_compliance = df.groupby('weather_condition')['compliance'].agg(['mean', 'count']).round(3)
        weather_analysis['weather_compliance'] = weather_compliance.to_dict('index')
    
    # Temperature vs compliance
    if 'temperature' in df.columns and 'compliance' in df.columns:
        temp_compliance = df.groupby(pd.cut(df['temperature'], bins=5))['compliance'].mean().round(3)
        weather_analysis['temperature_compliance'] = temp_compliance.to_dict()
    
    # Visibility vs compliance
    if 'visibility' in df.columns and 'compliance' in df.columns:
        vis_compliance = df.groupby(pd.cut(df['visibility'], bins=5))['compliance'].mean().round(3)
        weather_analysis['visibility_compliance'] = vis_compliance.to_dict()
    
    # Weather vs reaction time
    if 'weather_condition' in df.columns and 'reaction_time' in df.columns:
        weather_reaction = df.groupby('weather_condition')['reaction_time'].agg(['mean', 'count']).round(3)
        weather_analysis['weather_reaction_time'] = weather_reaction.to_dict('index')
    
    # Precipitation type vs compliance
    if 'precipitation_type' in df.columns and 'compliance' in df.columns:
        precip_compliance = df.groupby('precipitation_type')['compliance'].agg(['mean', 'count']).round(3)
        weather_analysis['precipitation_compliance'] = precip_compliance.to_dict('index')
    
    return weather_analysis

def _analyze_behavioral_patterns(df: pd.DataFrame) -> Dict:
    """Analyze behavioral patterns in the data"""
    behavioral_insights = {}
    
    # Compliance trends over time
    if 'date' in df.columns and 'compliance' in df.columns:
        df['date_only'] = pd.to_datetime(df['date']).dt.date
        daily_compliance = df.groupby('date_only')['compliance'].agg(['mean', 'count']).round(3)
        behavioral_insights['daily_compliance_trend'] = daily_compliance.to_dict('index')
    
    # Vehicle type distribution
    if 'vehicle_type' in df.columns:
        vehicle_distribution = df['vehicle_type'].value_counts().to_dict()
        behavioral_insights['vehicle_distribution'] = vehicle_distribution
    
    # Status distribution
    if 'status' in df.columns:
        status_distribution = df['status'].value_counts().to_dict()
        behavioral_insights['status_distribution'] = status_distribution
    
    # Peak hours analysis
    if 'date' in df.columns:
        df['hour'] = pd.to_datetime(df['date']).dt.hour
        peak_hours = df['hour'].value_counts().sort_index().to_dict()
        behavioral_insights['peak_hours'] = peak_hours
    
    return behavioral_insights

def _generate_correlation_recommendations(analysis_results: Dict) -> List[Dict]:
    """Generate recommendations based on correlation analysis"""
    recommendations = []
    
    # Weather-based recommendations
    weather_analysis = analysis_results.get('weather_analysis', {})
    
    # Check for poor weather compliance
    weather_compliance = weather_analysis.get('weather_compliance', {})
    for condition, data in weather_compliance.items():
        if isinstance(data, dict) and data.get('mean', 1) < 0.8:
            recommendations.append({
                'type': 'warning',
                'category': 'weather',
                'message': f"Low compliance rate ({data['mean']*100:.1f}%) in {condition} weather conditions",
                'suggestion': "Consider enhanced signage or warnings during poor weather"
            })
    
    # Check for slow reaction times in poor weather
    weather_reaction = weather_analysis.get('weather_reaction_time', {})
    for condition, data in weather_reaction.items():
        if isinstance(data, dict) and data.get('mean', 0) > 3.0:
            recommendations.append({
                'type': 'info',
                'category': 'weather',
                'message': f"Slow average reaction time ({data['mean']:.1f}s) in {condition} weather",
                'suggestion': "Drivers may need more time to respond in adverse weather conditions"
            })
    
    # Vehicle type recommendations
    basic_correlations = analysis_results.get('basic_correlations', {})
    vehicle_compliance = basic_correlations.get('vehicle_type_compliance', {})
    
    for vehicle_type, data in vehicle_compliance.items():
        if isinstance(data, dict) and data.get('mean', 1) < 0.7:
            recommendations.append({
                'type': 'warning',
                'category': 'vehicle_type',
                'message': f"Low compliance rate ({data['mean']*100:.1f}%) for {vehicle_type} vehicles",
                'suggestion': f"Consider targeted interventions for {vehicle_type} drivers"
            })
    
    # Time-based recommendations
    hour_compliance = basic_correlations.get('hour_compliance', {})
    low_compliance_hours = []
    
    for hour, data in hour_compliance.items():
        if isinstance(data, dict) and data.get('mean', 1) < 0.75:
            low_compliance_hours.append(hour)
    
    if low_compliance_hours:
        recommendations.append({
            'type': 'info',
            'category': 'time',
            'message': f"Low compliance during hours: {', '.join(map(str, low_compliance_hours))}",
            'suggestion': "Consider enhanced monitoring or signage during these peak hours"
        })
    
    return recommendations

def create_weather_heatmap(tracking_data: List[Dict], save_path: Optional[str] = None) -> str:
    """
    Create a heatmap showing weather impact on compliance
    
    Args:
        tracking_data: List of tracking records
        save_path: Optional path to save the heatmap
        
    Returns:
        Path to saved heatmap or base64 string
    """
    if not tracking_data:
        return ""
    
    df = pd.DataFrame(tracking_data)
    
    if 'weather_condition' not in df.columns or 'compliance' not in df.columns:
        return ""
    
    # Create pivot table for heatmap
    weather_compliance = df.groupby('weather_condition')['compliance'].agg(['mean', 'count']).round(3)
    
    # Create heatmap
    plt.figure(figsize=(10, 6))
    sns.heatmap(weather_compliance.T, annot=True, cmap='RdYlGn', center=0.5, 
                cbar_kws={'label': 'Compliance Rate'})
    plt.title('Weather Impact on Driver Compliance')
    plt.xlabel('Weather Condition')
    plt.ylabel('Metrics')
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        plt.close()
        return save_path
    else:
        # Return as base64 string for web display
        import io
        import base64
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=300, bbox_inches='tight')
        buf.seek(0)
        plt.close()
        return base64.b64encode(buf.getvalue()).decode()

# Legacy function for backward compatibility
def run_correlation_analysis_legacy():
    """Legacy function for backward compatibility"""
    try:
        df = pd.read_csv("data/merged_dataset.csv")
        
        # Correlation matrix
        correlation_matrix = df[['visibility', 'speed', 'reaction_time']].corr()
        print("\nCorrelation Matrix:\n", correlation_matrix)
        
        # Heatmap
        sns.heatmap(correlation_matrix, annot=True, cmap='coolwarm')
        plt.title("Weather vs Driver Behaviour Correlation")
        plt.tight_layout()
        plt.savefig("data/correlation_heatmap.png")
        plt.show()
        
        # Pearson Test
        r, p = stats.pearsonr(df['visibility'], df['reaction_time'])
        print(f"\nPearson correlation (Visibility vs Reaction Time): r = {r:.2f}, p = {p:.4f}")
        
    except Exception as e:
        print(f"Error in legacy correlation analysis: {e}")

# Optional: for testing directly
if __name__ == "__main__":
    # Test with sample data
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
            'date': '2024-01-01 11:00:00'
        }
    ]
    
    results = run_correlation_analysis(sample_data)
    print("Correlation Analysis Results:")
    print(json.dumps(results, indent=2, default=str))