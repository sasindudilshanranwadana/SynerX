from fastapi import APIRouter
from api.models import CleanupResponse

router = APIRouter(prefix="/system", tags=["System Management"])

def init_system_router(cleanup_temp_files_func):
    """Initialize the system router with cleanup function"""
    
    @router.post("/cleanup-temp-files", response_model=CleanupResponse)
    async def cleanup_temp_files_endpoint():
        """
        Manually clean up old temporary files
        
        This endpoint removes temporary files that are older than the configured time limits:
        - Upload files older than 1 hour
        - Processing files older than 30 minutes
        
        Returns:
            CleanupResponse: Status of the cleanup operation
        """
        try:
            cleaned_count = cleanup_temp_files_func()
            
            return CleanupResponse(
                status="success",
                message=f"Cleaned up {cleaned_count} old temporary files",
                cleaned_count=cleaned_count
            )
        except Exception as e:
            return CleanupResponse(status="error", error=str(e))

    return router
