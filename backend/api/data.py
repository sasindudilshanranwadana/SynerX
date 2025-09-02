from fastapi import APIRouter
from clients.supabase_client import supabase_manager

router = APIRouter(prefix="/data", tags=["Data"])

def init_data_router():
    """Initialize the data router"""
    
    @router.get("/tracking")
    async def get_tracking_data(limit: int = 100):
        """
        Get tracking results data from database
        
        Retrieves vehicle tracking data from the database including vehicle positions,
        speeds, compliance status, and timestamps.
        
        Args:
            limit: Maximum number of records to return (default: 100)
        
        Returns:
            dict: Tracking data with vehicle information and compliance metrics
        """
        try:
            # Get tracking data
            tracking_data = supabase_manager.get_tracking_data(limit=limit)
            
            return {
                "status": "success",
                "table": "tracking_results",
                "count": len(tracking_data),
                "limit": limit,
                "data": tracking_data
            }
            
        except Exception as e:
            print(f"[ERROR] Failed to fetch tracking data: {e}")
            return {
                "status": "error",
                "error": str(e),
                "data": []
            }

    @router.get("/vehicle-counts")
    async def get_vehicle_counts(limit: int = 100):
        """
        Get vehicle counts data from database
        
        Retrieves vehicle count data from the database including counts by vehicle type,
        timestamps, and location information.
        
        Args:
            limit: Maximum number of records to return (default: 100)
        
        Returns:
            dict: Vehicle count data with type breakdowns and timestamps
        """
        try:
            # Get vehicle counts
            vehicle_counts = supabase_manager.get_vehicle_counts(limit=limit)
            
            return {
                "status": "success",
                "table": "vehicle_counts",
                "count": len(vehicle_counts),
                "limit": limit,
                "data": vehicle_counts
            }
            
        except Exception as e:
            print(f"[ERROR] Failed to fetch vehicle counts: {e}")
            return {
                "status": "error",
                "error": str(e),
                "data": []
            }

    @router.get("/tracking/filter")
    async def get_filtered_tracking_data(
        limit: int = 100,
        date_from: str = None,
        date_to: str = None,
        compliance: int = None,
        vehicle_type: str = None,
        weather_condition: str = None,
        video_id: int = None,
    ):
        """
        Get filtered tracking results data from database
        
        Retrieves filtered tracking data based on various criteria including date range,
        compliance status, vehicle type, and weather conditions.
        
        Args:
            limit: Maximum number of records to return (default: 100)
            date_from: Start date filter (YYYY-MM-DD format)
            date_to: End date filter (YYYY-MM-DD format)
            compliance: Compliance status filter (0 or 1)
            vehicle_type: Vehicle type filter (car, truck, bus, motorcycle)
            weather_condition: Weather condition filter
        
        Returns:
            dict: Filtered tracking data with applied filters information
        """
        try:
            # Get tracking data (optionally by video)
            tracking_data = supabase_manager.get_tracking_data(limit=1000, video_id=video_id)
            
            # Apply filters
            filtered_data = tracking_data
            # Filter by video_id if supplied (redundant when passed to DB, but safe)
            if video_id is not None:
                filtered_data = [item for item in filtered_data if item.get('video_id') == video_id]

            # Filter by date range
            if date_from:
                filtered_data = [item for item in filtered_data if item.get('date', '').split(' ')[0] >= date_from]
            
            if date_to:
                filtered_data = [item for item in filtered_data if item.get('date', '').split(' ')[0] <= date_to]
            
            # Filter by compliance
            if compliance is not None:
                filtered_data = [item for item in filtered_data if item.get('compliance') == compliance]
            
            # Filter by vehicle type
            if vehicle_type:
                filtered_data = [item for item in filtered_data if item.get('vehicle_type') == vehicle_type]
            
            # Filter by weather condition
            if weather_condition:
                filtered_data = [item for item in filtered_data if item.get('weather_condition') == weather_condition]
            
            # Apply limit
            filtered_data = filtered_data[:limit]
            
            return {
                "status": "success",
                "table": "tracking_results",
                "count": len(filtered_data),
                "limit": limit,
                "filters_applied": {
                    "date_from": date_from,
                    "date_to": date_to,
                    "compliance": compliance,
                    "vehicle_type": vehicle_type,
                    "weather_condition": weather_condition,
                    "video_id": video_id,
                },
                "data": filtered_data
            }
            
        except Exception as e:
            print(f"[ERROR] Failed to fetch filtered tracking data: {e}")
            return {
                "status": "error",
                "error": str(e),
                "data": []
            }

    @router.get("/vehicle-counts/filter")
    async def get_filtered_vehicle_counts(
        limit: int = 100,
        date_from: str = None,
        date_to: str = None,
        vehicle_type: str = None,
        video_id: int = None,
    ):
        """
        Get filtered vehicle counts data from database
        
        Retrieves filtered vehicle count data based on various criteria including date range
        and vehicle type.
        
        Args:
            limit: Maximum number of records to return (default: 100)
            date_from: Start date filter (YYYY-MM-DD format)
            date_to: End date filter (YYYY-MM-DD format)
            vehicle_type: Vehicle type filter (car, truck, bus, motorcycle)
        
        Returns:
            dict: Filtered vehicle count data with applied filters information
        """
        try:
            # Get vehicle counts (optionally by video)
            vehicle_counts = supabase_manager.get_vehicle_counts(limit=1000, video_id=video_id)
            
            # Apply filters
            filtered_data = vehicle_counts
            # Filter by video_id if supplied (redundant when passed to DB, but safe)
            if video_id is not None:
                filtered_data = [item for item in filtered_data if item.get('video_id') == video_id]

            # Filter by date range
            if date_from:
                filtered_data = [item for item in filtered_data if item.get('date', '').split(' ')[0] >= date_from]
            
            if date_to:
                filtered_data = [item for item in filtered_data if item.get('date', '').split(' ')[0] <= date_to]
            
            # Filter by vehicle type
            if vehicle_type:
                filtered_data = [item for item in filtered_data if item.get('vehicle_type') == vehicle_type]
            
            # Apply limit
            filtered_data = filtered_data[:limit]
            
            return {
                "status": "success",
                "table": "vehicle_counts",
                "count": len(filtered_data),
                "limit": limit,
                "filters_applied": {
                    "date_from": date_from,
                    "date_to": date_to,
                    "vehicle_type": vehicle_type,
                    "video_id": video_id,
                },
                "data": filtered_data
            }
            
        except Exception as e:
            print(f"[ERROR] Failed to fetch filtered vehicle counts: {e}")
            return {
                "status": "error",
                "error": str(e),
                "data": []
            }

    @router.get("/summary/by-video/{video_id}")
    async def get_summary_by_video(video_id: int):
        """
        Get a combined payload: video details + tracking data + vehicle counts + totals.
        """
        try:
            video = supabase_manager.get_video_data(video_id)
            if not video:
                return {"status": "error", "error": "Video not found", "video_id": video_id}

            # The RPC returns tracking_data and vehicle_counts as JSON arrays already
            tracking_data = video.get("tracking_data") or []
            vehicle_counts = video.get("vehicle_counts") or []

            # Prepare a minimal video subset for convenience
            video_core = {
                "id": video.get("video_id") or video_id,
                "video_name": video.get("video_name"),
                "status": video.get("status"),
                "processed_url": video.get("processed_url"),
                "duration_seconds": video.get("processing_time"),
                "total_vehicles": video.get("total_vehicles"),
                "compliance_rate": video.get("compliance_rate"),
            }

            return {
                "status": "success",
                "video": video_core,
                "tracking_data": tracking_data,
                "vehicle_counts": vehicle_counts,
                "totals": {
                    "tracking": len(tracking_data),
                    "vehicle_counts": len(vehicle_counts),
                }
            }
        except Exception as e:
            print(f"[ERROR] Failed to get summary for video {video_id}: {e}")
            return {"status": "error", "error": str(e), "video_id": video_id}

    return router
