from fastapi import APIRouter
from api.models import CleanupResponse

router = APIRouter(prefix="/system", tags=["System Management"])

def init_system_router(cleanup_temp_files_func, job_lock, background_jobs):
    """Initialize the system router with cleanup function and job tracking"""
    
    @router.post("/cleanup-temp-files", response_model=CleanupResponse)
    async def cleanup_temp_files_endpoint():
        """
        Manually clean up old temporary files and orphaned files
        
        This endpoint removes:
        - Upload files older than 1 hour OR orphaned files (no active job)
        - Processing files older than 30 minutes OR orphaned files
        - Orphaned output files in processed directory
        
        Returns:
            CleanupResponse: Status of the cleanup operation
        """
        try:
            cleaned_count = cleanup_temp_files_func()
            
            return CleanupResponse(
                status="success",
                message=f"Cleaned up {cleaned_count} temporary/orphaned files",
                cleaned_count=cleaned_count
            )
        except Exception as e:
            return CleanupResponse(status="error", error=str(e))

    @router.post("/cleanup-orphaned-files", response_model=CleanupResponse)
    async def cleanup_orphaned_files_endpoint():
        """
        Clean up only orphaned files (files without corresponding active jobs)
        
        This endpoint specifically targets files that don't have corresponding
        active jobs in the system, regardless of their age.
        
        Returns:
            CleanupResponse: Status of the cleanup operation
        """
        try:
            from pathlib import Path
            import time
            
            current_time = time.time()
            cleaned_count = 0
            
            # Get active job IDs
            active_job_ids = set()
            with job_lock:
                for job_id in background_jobs.keys():
                    active_job_ids.add(job_id)
            
            # Clean up orphaned upload files
            temp_uploads_dir = Path("temp/uploads")
            for temp_file in temp_uploads_dir.glob("*"):
                if temp_file.is_file():
                    # Check if this temp file belongs to any active job
                    file_is_orphaned = True
                    for job_id, job_info in background_jobs.items():
                        temp_filename = job_info.get("temp_filename", "")
                        if temp_filename == temp_file.name:
                            file_is_orphaned = False
                            break
                    
                    if file_is_orphaned:
                        temp_file.unlink()
                        cleaned_count += 1
                        print(f"[CLEANUP] Removed orphaned upload file: {temp_file}")
            
            # Clean up orphaned processing files
            temp_processing_dir = Path("temp/processing")
            for temp_file in temp_processing_dir.glob("*"):
                if temp_file.is_file():
                    file_stem = temp_file.stem
                    if file_stem not in active_job_ids:
                        temp_file.unlink()
                        cleaned_count += 1
                        print(f"[CLEANUP] Removed orphaned processing file: {temp_file}")
            
            # Clean up orphaned output files
            output_dir = Path("processed")
            for output_file in output_dir.glob("*"):
                if output_file.is_file():
                    file_stem = output_file.stem.replace("_out", "")
                    if file_stem not in active_job_ids:
                        output_file.unlink()
                        cleaned_count += 1
                        print(f"[CLEANUP] Removed orphaned output file: {output_file}")
            
            return CleanupResponse(
                status="success",
                message=f"Cleaned up {cleaned_count} orphaned files",
                cleaned_count=cleaned_count
            )
        except Exception as e:
            return CleanupResponse(status="error", error=str(e))

    return router
