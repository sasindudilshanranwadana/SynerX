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
            
            # 1. Upload directly to R2 (no temp files!)
            suffix = Path(file.filename).suffix or ".mp4"
            
            print(f"[UPLOAD] Step 2: Uploading directly to R2 (no temp files)...")
            upload_start = time.time()
            
            # Upload directly from file stream to R2
            from clients.r2_storage_client import R2StorageClient
            r2_client = R2StorageClient()
            r2_url = r2_client.upload_video_from_stream(file.file, file.filename)
            
            upload_time = time.time() - upload_start
            print(f"[UPLOAD] R2 upload took {upload_time:.2f}s")
            
            if not r2_url:
                raise HTTPException(status_code=500, detail="Failed to upload to R2 storage")
            
            print(f"[UPLOAD] Step 3: R2 upload successful: {r2_url}")

            # 2. Create job ID and add to queue (DB record will be created when processing starts)
            job_id = str(uuid.uuid4())
            analytic_path = OUTPUT_DIR / f"{job_id}_out{suffix}"
            
            # Initialize job status
            with job_lock:
                background_jobs[job_id] = {
                    "status": "queued",
                    "start_time": time.time(),
                    "file_name": file.filename,
                    "r2_url": r2_url,  # Store the R2 URL instead of temp filename
                    "progress": 0,
                    "message": "Video uploaded to R2 and queued for processing...",
                    "result": None,
                    "error": None,
                    "video_id": None
                }
            
            # Add job to queue with R2 URL (video_id will be set when processing actually begins)
            job_data = {
                "job_id": job_id,
                "stream_url": r2_url,  # Use R2 URL instead of local path
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
            
            # Return immediately with job ID and queue position
            return {
                "status": "queued",
                "job_id": job_id,
                "queue_position": queue_position,
                "message": f"Video uploaded to R2 and queued for processing (position: {queue_position})",
                "file_name": file.filename,
                "r2_url": r2_url
            }
        except Exception as e:
            print(f"[UPLOAD] Error: {e}")
            # Best-effort cleanup of temp file if it was created
            try:
                from pathlib import Path as _Path
                if 'raw_path' in locals():
                    _p = _Path(str(raw_path))
                    if _p.exists():
                        _p.unlink()
                        print(f"[UPLOAD] Cleaned temp file after failure: {_p}")
            except Exception as _ce:
                print(f"[UPLOAD] Warning: failed to cleanup temp file: {_ce}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

    @router.get("/stream/{job_id}")
    async def stream_video(job_id: str):
        """
        Stream video from R2 for a specific job (for private R2 access)
        """
        try:
            # Get job info to find the R2 URL
            with job_lock:
                job_info = background_jobs.get(job_id)
                if not job_info:
                    raise HTTPException(status_code=404, detail="Job not found")
                
                r2_url = job_info.get('r2_url')
                if not r2_url:
                    raise HTTPException(status_code=404, detail="No video URL found for this job")
            
            # For now, redirect to R2 URL (this will work if R2 is public)
            # TODO: Implement proper streaming for private R2
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=r2_url)
            
        except Exception as e:
            print(f"[STREAM] Error streaming video for job {job_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Streaming failed: {str(e)}")

    return router
