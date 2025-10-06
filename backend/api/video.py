from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
import shutil
import uuid
import time
import os
from datetime import datetime

router = APIRouter(prefix="/video", tags=["Video Processing"])

def init_video_router(background_jobs, job_lock, job_queue, queue_lock, start_queue_processor, 
                     shutdown_manager, set_processing_start_time, TEMP_UPLOADS_DIR, OUTPUT_DIR):
    """Initialize the video router with global variables"""
    
    @router.post("/upload")
    async def upload_video(
        file: UploadFile = File(..., description="Video file to upload and process")
    ):
        """
        Upload a video file for processing
        
        Uploads a video file and adds it to the processing queue. The video will be processed
        in the background and results will be available via the job status endpoints.
        
        Args:
            file: Video file to upload (supports common video formats)
        
        Returns:
            dict: Job information including job ID and queue position
        """
        try:
            # Reset shutdown flag for this request
            shutdown_manager.reset_shutdown_flag()
            
            # Set processing start time
            set_processing_start_time()
            
            start_time = time.time()
            print("[UPLOAD] Step 1: File received")
            
            # 1. Upload directly to R2 storage (no temp files!)
            suffix = Path(file.filename).suffix or ".mp4"
            job_id = str(uuid.uuid4())
            r2_filename = f"temp_{job_id}{suffix}"
            
            print(f"[UPLOAD] Step 2: Uploading directly to R2 storage...")
            
            # Upload to R2 using authentication
            from clients.r2_storage_client import get_r2_client
            r2_client = get_r2_client()
            
            # Upload file stream directly to R2
            r2_filename_uploaded = r2_client.upload_video_stream(file.file, r2_filename)
            
            if not r2_filename_uploaded:
                raise Exception("Failed to upload video to R2 storage")
            
            print(f"[UPLOAD] Step 3: Video uploaded to R2: {r2_filename_uploaded}")

            # 2. Create job with R2 URL instead of local path
            analytic_path = OUTPUT_DIR / f"{job_id}_out{suffix}"
            
            # Initialize job status with R2 filename
            with job_lock:
                background_jobs[job_id] = {
                    "status": "queued",
                    "start_time": time.time(),
                    "file_name": file.filename,
                    "r2_filename": r2_filename_uploaded,  # Store R2 filename instead of URL
                    "progress": 0,
                    "message": "Video uploaded to R2 storage, added to processing queue...",
                    "result": None,
                    "error": None,
                    "video_id": None
                }
            
            # Add job to queue with R2 filename
            job_data = {
                "job_id": job_id,
                "r2_filename": r2_filename_uploaded,  # Use R2 filename instead of URL
                "analytic_path": analytic_path,
                "suffix": suffix,
                "start_time": time.time(),
                "video_id": None
            }
            
            with queue_lock:
                job_queue.append(job_data)
                queue_position = len(job_queue)
            
            # Start queue processor if not already running
            try:
                start_queue_processor()
                print(f"[UPLOAD] Step 3: Job {job_id} added to queue (position: {queue_position})")
            except Exception as e:
                print(f"[UPLOAD] Warning: Failed to start queue processor: {e}")
                # Continue anyway, the job is still added to queue
            
            upload_time = time.time() - start_time
            print(f"[UPLOAD] ✅ Upload completed in {upload_time:.2f}s")
            
            # Return immediately with job ID and queue position
            return {
                "status": "queued",
                "job_id": job_id,
                "queue_position": queue_position,
                "message": f"Video uploaded to R2 storage and added to processing queue (position: {queue_position})",
                "file_name": file.filename,
                "r2_filename": r2_filename_uploaded,
                "upload_time": upload_time
            }
        except Exception as e:
            print(f"[UPLOAD] Error: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"R2 upload failed: {str(e)}")

    return router
