from fastapi import APIRouter, HTTPException
from api.models import JobStatusResponse
import time
import threading

# Import global variables from main (will be passed in)
# background_jobs, job_lock, job_queue, queue_lock, queue_processor_active, etc.

router = APIRouter(prefix="/jobs", tags=["Job Management"])

def init_job_router(background_jobs, job_lock, job_queue, queue_lock, queue_processor_active, start_queue_processor, shutdown_manager):
    """Initialize the job router with global variables"""
    
    

    

    @router.post("/clear-completed", response_model=JobStatusResponse)
    async def clear_completed_jobs():
        """
        Clear completed and failed jobs from memory
        
        This endpoint removes all jobs with status 'completed', 'failed', or 'cancelled' 
        from the job tracking system, keeping only active processing and queued jobs.
        
        Returns:
            JobStatusResponse: Status of the cleanup operation
        """
        try:
            with job_lock:
                # Keep only processing and queued jobs
                jobs_to_remove = []
                for job_id, job in background_jobs.items():
                    if job["status"] in ["completed", "failed", "cancelled"]:
                        jobs_to_remove.append(job_id)
                
                for job_id in jobs_to_remove:
                    del background_jobs[job_id]
                
                removed_count = len(jobs_to_remove)
            
            return JobStatusResponse(
                status="success",
                message=f"Cleared {removed_count} completed/failed jobs",
                removed_count=removed_count,
                remaining_jobs=len(background_jobs)
            )
        except Exception as e:
            return JobStatusResponse(status="error", error=str(e))

    @router.post("/shutdown")
    async def shutdown_processing():
        """
        Stop the current processing or queued job
        
        Cancels the currently active job (either processing or queued). If a job is currently
        processing, it will be stopped gracefully. If a job is queued, it will be removed
        from the queue.
        
        Returns:
            dict: Status of the cancellation operation
        """
        try:
            # Find the currently processing or queued job
            active_job = None
            job_status = None
            with job_lock:
                # First look for processing job
                for job_id, job_info in background_jobs.items():
                    if job_info["status"] == "processing":
                        active_job = job_id
                        job_status = "processing"
                        break
                
                # If no processing job, look for queued job
                if not active_job:
                    for job_id, job_info in background_jobs.items():
                        if job_info["status"] == "queued":
                            active_job = job_id
                            job_status = "queued"
                            break
            
            if active_job:
                # Mark job state based on whether it's processing or queued
                with job_lock:
                    if job_status == "processing":
                        background_jobs[active_job]["status"] = "interrupted"
                        background_jobs[active_job]["message"] = "Job interrupted by user"
                        background_jobs[active_job]["error"] = "Interrupted by user request"
                    else:
                        background_jobs[active_job]["status"] = "cancelled"
                        background_jobs[active_job]["message"] = "Job cancelled by user"
                        background_jobs[active_job]["error"] = "Cancelled by user request"
                
                # If it was a queued job, remove it from the queue
                if job_status == "queued":
                    with queue_lock:
                        job_queue[:] = [job for job in job_queue if job["job_id"] != active_job]
                
                # Set shutdown flag to actually stop the processing
                if job_status == "processing":
                    shutdown_manager.set_shutdown_flag()
                    print(f"[SHUTDOWN] Set shutdown flag to stop processing job: {active_job}")
                # Mark end time
                with job_lock:
                    background_jobs[active_job]["end_time"] = time.time()
                
                # Clean up files for cancelled job
                try:
                    job_info = background_jobs[active_job]
                    file_name = job_info.get("file_name", "")
                    temp_filename = job_info.get("temp_filename", "")
                    
                    # Clean up temp upload file
                    if temp_filename:
                        from pathlib import Path
                        temp_uploads_dir = Path("temp/uploads")
                        temp_processing_dir = Path("temp/processing")
                        
                        # Remove upload file using the actual temp filename
                        upload_file = temp_uploads_dir / temp_filename
                        if upload_file.exists():
                            upload_file.unlink()
                            print(f"[SHUTDOWN] Cleaned up upload file: {upload_file}")
                        else:
                            print(f"[SHUTDOWN] Upload file not found: {upload_file}")
                        
                        # Remove processing file (if it exists) - use job_id for this one
                        processing_file = temp_processing_dir / f"{active_job}{Path(file_name).suffix}"
                        if processing_file.exists():
                            processing_file.unlink()
                            print(f"[SHUTDOWN] Cleaned up processing file: {processing_file}")
                        
                        # Remove output file (if it exists)
                        output_file = Path("processed") / f"{active_job}_out{Path(file_name).suffix}"
                        if output_file.exists():
                            output_file.unlink()
                            print(f"[SHUTDOWN] Cleaned up output file: {output_file}")
                    else:
                        print(f"[WARNING] No temp_filename found for job {active_job}")
                            
                except Exception as e:
                    print(f"[WARNING] Failed to clean up files for cancelled job {active_job}: {e}")
                
                print(f"[SHUTDOWN] Cancelled {job_status} job: {active_job}")
                
                return {
                    "status": "interrupted" if job_status == "processing" else "cancelled", 
                    "message": f"{job_status.capitalize()} job {active_job} has been { 'interrupted' if job_status == 'processing' else 'cancelled' }",
                    "job_id": active_job,
                    "job_status": job_status
                }
            else:
                # No active job found
                return {
                    "status": "no_job", 
                    "message": "No processing or queued job found to cancel"
                }
        except Exception as e:
            return {"status": "error", "error": str(e)}

    @router.post("/shutdown/{job_id}")
    async def shutdown_specific_job(job_id: str):
        """
        Stop a specific job by ID
        
        Cancels a specific job by its ID. If the job is currently processing, it will be 
        stopped gracefully. If the job is queued, it will be removed from the queue.
        If the job is already completed, failed, or cancelled, it will return an error.
        
        Args:
            job_id: The unique identifier of the job to cancel
        
        Returns:
            dict: Status of the cancellation operation
        """
        try:
            # Check if job exists
            with job_lock:
                if job_id not in background_jobs:
                    return {
                        "status": "not_found",
                        "message": f"Job {job_id} not found"
                    }
                
                job_info = background_jobs[job_id]
                job_status = job_info["status"]
                
                # Check if job can be cancelled
                if job_status in ["completed", "failed", "cancelled"]:
                    return {
                        "status": "cannot_cancel",
                        "message": f"Job {job_id} is already {job_status} and cannot be cancelled",
                        "job_status": job_status
                    }
                
                # Mark job state based on status
                if job_status == "processing":
                    background_jobs[job_id]["status"] = "interrupted"
                    background_jobs[job_id]["message"] = "Job interrupted by user"
                    background_jobs[job_id]["error"] = "Interrupted by user request"
                else:
                    background_jobs[job_id]["status"] = "cancelled"
                    background_jobs[job_id]["message"] = "Job cancelled by user"
                    background_jobs[job_id]["error"] = "Cancelled by user request"
                
                # If it was a queued job, remove it from the queue
                if job_status == "queued":
                    with queue_lock:
                        job_queue[:] = [job for job in job_queue if job["job_id"] != job_id]
                
                # Set shutdown flag to actually stop the processing
                if job_status == "processing":
                    shutdown_manager.set_shutdown_flag()
                    print(f"[SHUTDOWN] Set shutdown flag to stop processing job: {job_id}")
                # Mark end time
                background_jobs[job_id]["end_time"] = time.time()
                
                # Clean up files for cancelled job
                try:
                    file_name = job_info.get("file_name", "")
                    temp_filename = job_info.get("temp_filename", "")
                    
                    # Clean up temp upload file
                    if temp_filename:
                        from pathlib import Path
                        temp_uploads_dir = Path("temp/uploads")
                        temp_processing_dir = Path("temp/processing")
                        
                        # Remove upload file using the actual temp filename
                        upload_file = temp_uploads_dir / temp_filename
                        if upload_file.exists():
                            upload_file.unlink()
                            print(f"[SHUTDOWN] Cleaned up upload file: {upload_file}")
                        else:
                            print(f"[SHUTDOWN] Upload file not found: {upload_file}")
                        
                        # Remove processing file (if it exists) - use job_id for this one
                        processing_file = temp_processing_dir / f"{job_id}{Path(file_name).suffix}"
                        if processing_file.exists():
                            processing_file.unlink()
                            print(f"[SHUTDOWN] Cleaned up processing file: {processing_file}")
                        
                        # Remove output file (if it exists)
                        output_file = Path("processed") / f"{job_id}_out{Path(file_name).suffix}"
                        if output_file.exists():
                            output_file.unlink()
                            print(f"[SHUTDOWN] Cleaned up output file: {output_file}")
                    else:
                        print(f"[WARNING] No temp_filename found for job {job_id}")
                            
                except Exception as e:
                    print(f"[WARNING] Failed to clean up files for cancelled job {job_id}: {e}")
                
                print(f"[SHUTDOWN] Cancelled {job_status} job: {job_id}")
                
                return {
                    "status": "interrupted" if job_status == "processing" else "cancelled", 
                    "message": f"{job_status.capitalize()} job {job_id} has been { 'interrupted' if job_status == 'processing' else 'cancelled' }",
                    "job_id": job_id,
                    "job_status": job_status
                }
                
        except Exception as e:
            return {"status": "error", "error": str(e)}

    

    

    return router
