from fastapi import APIRouter
from utils.video_streamer import video_streamer

router = APIRouter(prefix="/status", tags=["Status"])

def init_status_router(shutdown_manager, get_processing_time):
    """Initialize the status router with required functions"""
    
    @router.get("/processing")
    async def get_processing_status():
        """
        Get processing status
        
        Check if video processing is currently active and get processing time information.
        This endpoint provides real-time status of the video processing system.
        
        Returns:
            dict: Processing status including active state, shutdown status, and processing time
        """
        try:
            is_shutdown_requested = shutdown_manager.check_shutdown()
            processing_time = get_processing_time()
            return {
                "processing_active": not is_shutdown_requested,
                "shutdown_requested": is_shutdown_requested,
                "processing_time": processing_time
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}

    @router.get("/stream")
    async def get_stream_status():
        """
        Get stream status
        
        Get current WebSocket streaming status including active connections and streaming state.
        This endpoint provides information about the real-time video streaming system.
        
        Returns:
            dict: Streaming status including active connections and streaming state
        """
        try:
            connection_count = video_streamer.get_connection_count()
            return {
                "streaming_active": video_streamer.streaming_active,
                "active_connections": connection_count,
                "status": "active" if video_streamer.streaming_active else "inactive"
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}

    return router
