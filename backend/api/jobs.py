from fastapi import APIRouter, HTTPException
from api.models import JobStatusResponse
import time
import threading

# Import global variables from main (will be passed in)
# background_jobs, job_lock, job_queue, queue_lock, queue_processor_active, etc.

router = APIRouter(prefix="/jobs", tags=["Job Management"])

def init_job_router(background_jobs, job_lock, job_queue, queue_lock, queue_processor_active, start_queue_processor, shutdown_manager):
    """Initialize the job router with global variables"""
    
    @router.get("/")
    async def list_all_jobs():
        """
        Get comprehensive status of all background jobs
        
        Returns detailed information about all jobs including:
        - Jobs organized by status (processing, queued, completed, failed, cancelled)
        - System summary with total jobs and queue information
        - Queue order and status breakdown
        
        Returns:
            dict: Comprehensive job status information
        """
        try:
            with job_lock:
                # Get all jobs with detailed information
                all_jobs = []
                for job_id, job in background_jobs.items():
                    elapsed_time = time.time() - job["start_time"]
                    
                    job_info = {
                        "job_id": job_id,
                        "status": job["status"],
                        "progress": job["progress"],
                        "file_name": job["file_name"],
                        "start_time": job["start_time"],
                        "elapsed_time": elapsed_time,
                        "message": job["message"],
                        "error": job["error"]
                    }
                    
                    # Add result info if available
                    if job["result"]:
                        job_info["result"] = job["result"]
                    
                    all_jobs.append(job_info)
                
                # Organize jobs by status
                jobs_by_status = {
                    "processing": [],
                    "queued": [],
                    "completed": [],
                    "failed": [],
                    "cancelled": []
                }
                
                for job in all_jobs:
                    status = job["status"]
                    if status in jobs_by_status:
                        jobs_by_status[status].append(job)
                
                # Get queue information
                with queue_lock:
                    queue_length = len(job_queue)
                    queue_processor_running = queue_processor_active
                    
                    # Get queue order
                    queue_order = []
                    for i, job_data in enumerate(job_queue):
                        job_id = job_data['job_id']
                        if job_id in background_jobs:
                            job_info = background_jobs[job_id]
                            queue_order.append({
                                "position": i + 1,
                                "job_id": job_id,
                                "file_name": job_info["file_name"],
                                "status": job_info["status"]
                            })
                
                # Count jobs by status
                status_counts = {}
                for job in all_jobs:
                    status = job["status"]
                    status_counts[status] = status_counts.get(status, 0) + 1
                
                return {
                    "status": "success",
                    "summary": {
                        "total_jobs": len(all_jobs),
                        "status_counts": status_counts,
                        "queue_length": queue_length,
                        "queue_processor_running": queue_processor_running
                    },
                    "jobs_by_status": jobs_by_status,
                    "queue_order": queue_order,
                    "all_jobs": all_jobs  # Complete list for backward compatibility
                }
        except Exception as e:
            return {"status": "error", "error": str(e)}

    @router.get("/status/{job_id}")
    async def get_job_status(job_id: str):
        """
        Get the status of a specific background video processing job
        
        Args:
            job_id: The unique identifier of the job to check
        
        Returns:
            dict: Detailed job status information including progress, elapsed time, and results
        """
        try:
            with job_lock:
                if job_id not in background_jobs:
                    raise HTTPException(status_code=404, detail="Job not found")
                
                job = background_jobs[job_id]
                return {
                    "job_id": job_id,
                    "status": job["status"],
                    "progress": job["progress"],
                    "message": job["message"],
                    "file_name": job["file_name"],
                    "start_time": job["start_time"],
                    "elapsed_time": time.time() - job["start_time"],
                    "result": job["result"],
                    "error": job["error"]
                }
        except HTTPException:
            raise
        except Exception as e:
            return {"status": "error", "error": str(e)}

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
                # Mark the job as cancelled
                with job_lock:
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
                    "status": "cancelled", 
                    "message": f"{job_status.capitalize()} job {active_job} has been cancelled",
                    "cancelled_job": active_job,
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

    @router.post("/restart-queue")
    async def restart_queue_processor():
        """
        Restart the job queue processor
        
        Restarts the background queue processor that handles video processing jobs.
        This can be useful if the queue processor gets stuck or stops working.
        
        Returns:
            dict: Status of the restart operation and current queue information
        """
        try:
            global queue_processor_active
            
            # Stop current processor if running
            with queue_lock:
                if queue_processor_active:
                    queue_processor_active = False
                    print("[QUEUE] 🛑 Stopping current queue processor")
                    time.sleep(1)  # Give it time to stop
            
            # Start new processor
            start_queue_processor()
            
            return {
                "status": "success",
                "message": "Queue processor restarted",
                "queue_processor_running": queue_processor_active,
                "queue_length": len(job_queue)
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}

    @router.get("/queue-status")
    async def get_queue_status():
        """
        Get current queue status and information
        
        Returns detailed information about the job queue including:
        - Queue processor status (running/stopped)
        - Queue length and total jobs
        - Status breakdown (processing, queued, completed, etc.)
        - Queue details with job positions
        
        Returns:
            dict: Comprehensive queue status information
        """
        try:
            with queue_lock:
                queue_length = len(job_queue)
                queue_processor_running = queue_processor_active
            
            with job_lock:
                # Count jobs by status
                status_counts = {}
                for job in background_jobs.values():
                    status = job["status"]
                    status_counts[status] = status_counts.get(status, 0) + 1
                
                # Get queue details
                queue_details = []
                for i, job_data in enumerate(job_queue):
                    job_id = job_data['job_id']
                    if job_id in background_jobs:
                        job_info = background_jobs[job_id]
                        queue_details.append({
                            "position": i + 1,
                            "job_id": job_id,
                            "file_name": job_info["file_name"],
                            "status": job_info["status"],
                            "progress": job_info["progress"]
                        })
            
            return {
                "status": "success",
                "queue_processor_running": queue_processor_running,
                "queue_length": queue_length,
                "total_jobs": len(background_jobs),
                "status_counts": status_counts,
                "queue_details": queue_details
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}

    return router
