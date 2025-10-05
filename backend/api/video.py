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
            
            # 1. save raw upload to organized temp directory
            suffix = Path(file.filename).suffix or ".mp4"
            temp_filename = f"{uuid.uuid4()}{suffix}"
            raw_path = TEMP_UPLOADS_DIR / temp_filename
            
            # Optimized chunked upload for large files with progress tracking
            chunk_size = 8192 * 16  # 128KB chunks for better performance
            total_size = 0
            start_time = time.time()
            
            with open(raw_path, "wb") as tmp_in:
                while chunk := file.file.read(chunk_size):
                    tmp_in.write(chunk)
                    total_size += len(chunk)
                    
                    # Log progress every 10MB
                    if total_size % (10 * 1024 * 1024) == 0:
                        elapsed = time.time() - start_time
                        speed = total_size / elapsed / 1024 / 1024  # MB/s
                        print(f"[UPLOAD] Progress: {total_size // (1024*1024)}MB uploaded at {speed:.1f}MB/s")
            
            upload_time = time.time() - start_time
            speed = total_size / upload_time / 1024 / 1024  # MB/s
            print(f"[UPLOAD] Step 2: File saved to {raw_path} ({total_size // (1024*1024)}MB in {upload_time:.1f}s at {speed:.1f}MB/s)")

            # 2. Create job ID and add to queue (DB record will be created when processing starts)
            job_id = str(uuid.uuid4())
            analytic_path = OUTPUT_DIR / f"{job_id}_out{suffix}"
            
            # Initialize job status
            with job_lock:
                background_jobs[job_id] = {
                    "status": "queued",
                    "start_time": time.time(),
                    "file_name": file.filename,
                    "temp_filename": temp_filename,  # Store the actual temp filename
                    "progress": 0,
                    "message": "Video added to processing queue...",
                    "result": None,
                    "error": None,
                    "video_id": None
                }
            
            # Add job to queue (video_id will be set when processing actually begins)
            job_data = {
                "job_id": job_id,
                "raw_path": raw_path,
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
                "message": f"Video added to processing queue (position: {queue_position})",
                "file_name": file.filename
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

    return router
