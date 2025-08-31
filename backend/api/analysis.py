from fastapi import APIRouter
from clients.supabase_client import supabase_manager
import time

router = APIRouter(prefix="/analysis", tags=["Correlation Analysis"])

def init_analysis_router():
    """Initialize the analysis router"""
    
    @router.get("/correlation")
    async def get_correlation_analysis():
        """
        Get weather-driver behavior correlation analysis
        
        Analyzes the correlation between weather conditions and driver behavior patterns
        using tracking data from the database. This helps understand how weather affects
        driving patterns and compliance rates.
        
        Returns:
            dict: Correlation analysis results with weather-driver behavior insights
        """
        try:
            from utils.correlation_analysis import run_correlation_analysis
            
            # Get tracking data from database
            tracking_data = supabase_manager.get_tracking_data(limit=1000)
            
            if not tracking_data:
                return {
                    "status": "no_data",
                    "message": "No tracking data available for analysis",
                    "analysis": {}
                }
            
            print(f"[CORRELATION] Analyzing {len(tracking_data)} tracking records for weather correlations")
            
            # Run correlation analysis
            analysis_results = run_correlation_analysis(tracking_data)
            
            return {
                "status": "success",
                "data_points": len(tracking_data),
                "analysis": analysis_results
            }
            
        except Exception as e:
            print(f"[ERROR] Correlation analysis failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "analysis": {}
            }

    @router.get("/weather-impact")
    async def get_weather_impact_analysis():
        """
        Get detailed weather impact analysis on driver behavior
        
        Provides comprehensive analysis of how weather conditions impact driver behavior,
        including speed patterns, compliance rates, and safety metrics under different
        weather conditions.
        
        Returns:
            dict: Detailed weather impact analysis results
        """
        try:
            from utils.weather_manager import weather_manager
            
            # Get tracking data from database
            tracking_data = supabase_manager.get_tracking_data(limit=1000)
            
            if not tracking_data:
                return {
                    "status": "no_data",
                    "message": "No tracking data available for weather impact analysis",
                    "weather_impact": {}
                }
            
            print(f"[WEATHER] Analyzing weather impact on {len(tracking_data)} tracking records")
            
            # Run weather impact analysis
            weather_impact = weather_manager.analyze_weather_impact(tracking_data)
            
            return {
                "status": "success",
                "data_points": len(tracking_data),
                "weather_impact": weather_impact
            }
            
        except Exception as e:
            print(f"[ERROR] Weather impact analysis failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "weather_impact": {}
            }

    @router.get("/complete")
    async def get_complete_analysis():
        """
        Get complete weather-driver behavior analysis including correlations and impact
        
        Provides a comprehensive analysis combining both correlation analysis and weather
        impact analysis. This gives a complete picture of how weather conditions affect
        driver behavior patterns and safety metrics.
        
        Returns:
            dict: Complete analysis results combining correlations and weather impact
        """
        try:
            from utils.correlation_analysis import run_correlation_analysis
            from utils.weather_manager import weather_manager
            
            # Get tracking data from database
            tracking_data = supabase_manager.get_tracking_data(limit=1000)
            
            if not tracking_data:
                return {
                    "status": "no_data",
                    "message": "No tracking data available for complete analysis",
                    "complete_analysis": {}
                }
            
            print(f"[COMPLETE] Running complete analysis on {len(tracking_data)} tracking records")
            
            # Run both analyses
            correlation_results = run_correlation_analysis(tracking_data)
            weather_impact = weather_manager.analyze_weather_impact(tracking_data)
            
            # Combine results
            complete_analysis = {
                "correlation_analysis": correlation_results,
                "weather_impact_analysis": weather_impact,
                "summary": {
                    "total_data_points": len(tracking_data),
                    "analysis_timestamp": time.time()
                }
            }
            
            return {
                "status": "success",
                "data_points": len(tracking_data),
                "complete_analysis": complete_analysis
            }
            
        except Exception as e:
            print(f"[ERROR] Complete analysis failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "complete_analysis": {}
            }

    return router
