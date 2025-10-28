from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
import shutil
import uuid
import time
import os
from datetime import datetime
import boto3
from botocore.exceptions import ClientError

def init_video_router(background_jobs, job_lock, job_queue, queue_lock, start_queue_processor, 
                     shutdown_manager, set_processing_start_time, TEMP_UPLOADS_DIR, OUTPUT_DIR):
    """Initialize the video router with global variables"""
    
    router = APIRouter(prefix="/video", tags=["Video Processing"])
    
    # DEPRECATED: Server-side upload endpoint - COMMENTED OUT
    # This endpoint is no longer used because:
    # - Server-side uploads cause slow upload issues on RunPod
    # - RunPod has bandwidth limitations that slow down large file uploads
    # - Server resources are wasted on file transfer instead of processing
    # 
    # NEW APPROACH: Client-side upload + WebSocket communication
    # - Frontend uploads directly to Cloudflare R2 storage
    # - Frontend sends job info to backend via WebSocket
    # - Backend processes video from R2 URL (no file transfer needed)
    # - Much faster and more efficient for RunPod environments
    
    # @router.post("/upload")
    # async def upload_video(
    #     file: UploadFile = File(..., description="Video file to upload and process")
    # ):
    #     """
    #     Upload a video file for processing
    #     
    #     Uploads a video file and automatically adds it to the processing queue.
    #     
    #     Args:
    #         file: Video file to upload (supports common video formats)
    #     
    #     Returns:
    #         dict: Job information including job ID and queue position
    #     """
    #     try:
    #         # Reset shutdown flag for this request
    #         shutdown_manager.reset_shutdown_flag()
    #         
    #         # Set processing start time
    #         set_processing_start_time()
    #         
    #         start_time = time.time()
    #         print("[UPLOAD] Step 1: File received")
    #         
    #         # 1. Upload directly to R2 (no temp files!)
    #         suffix = Path(file.filename).suffix or ".mp4"
    #         
    #         print(f"[UPLOAD] Step 2: Uploading directly to R2 (no temp files)...")
    #         upload_start = time.time()
    #         
    #         # Upload directly from file stream to R2
    #         from clients.r2_storage_client import R2StorageClient
    #         r2_client = R2StorageClient()
    #         r2_url = r2_client.upload_video_from_stream(file.file, file.filename)
    #         
    #         upload_time = time.time() - upload_start
    #         print(f"[UPLOAD] R2 upload took {upload_time:.2f}s")
    #         
    #         if not r2_url:
    #             raise HTTPException(status_code=500, detail="Failed to upload to R2 storage")
    #         
    #         print(f"[UPLOAD] Step 3: R2 upload successful: {r2_url}")
    # 
    #         # 2. Create job ID
    #         job_id = str(uuid.uuid4())
    #         analytic_path = OUTPUT_DIR / f"{job_id}_out{suffix}"
    #         
    #         # Initialize job status
    #         with job_lock:
    #             background_jobs[job_id] = {
    #                 "status": "uploaded", # Initial status is 'uploaded', not 'queued'
    #                 "start_time": time.time(),
    #                 "file_name": file.filename,
    #                 "r2_url": r2_url,
    #                 "progress": 0,
    #                 "message": "Video uploaded to R2, awaiting processing trigger...",
    #                 "result": None,
    #                 "error": None,
    #                 "video_id": None
    #             }
    #             print(f"[UPLOAD] Job {job_id} created with status: uploaded")
    #         
    #         # Just upload, don't add to queue yet
    #         print(f"[UPLOAD] Step 3: Video uploaded to R2, ready for processing")
    #         
    #         # Return job ID for manual processing trigger
    #         return {
    #             "status": "uploaded",
    #             "job_id": job_id,
    #             "message": "Video uploaded to R2, ready for processing",
    #             "file_name": file.filename,
    #             "r2_url": r2_url
    #         }
    #     except Exception as e:
    #         print(f"[UPLOAD] Error: {e}")
    #         # Best-effort cleanup of temp file if it was created
    #         try:
    #             from pathlib import Path as _Path
    #             if 'raw_path' in locals():
    #                 _p = _Path(str(raw_path))
    #                 if _p.exists():
    #                     _p.unlink()
    #                     print(f"[UPLOAD] Cleaned temp file after failure: {_p}")
    #         except Exception as _ce:
    #             print(f"[UPLOAD] Warning: failed to cleanup temp file: {_ce}")
    #         import traceback
    #         traceback.print_exc()
    #         raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

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

    @router.post("/process/{job_id}")
    async def start_processing(job_id: str):
        """
        Start processing a previously uploaded video
        
        Args:
            job_id: Job ID from the upload endpoint
        
        Returns:
            dict: Processing status and queue position
        """
        try:
            print(f"[PROCESS] Starting processing for job_id: {job_id}")
            
            # Check if job exists
            with job_lock:
                print(f"[PROCESS] Checking if job exists in background_jobs")
                if job_id not in background_jobs:
                    print(f"[PROCESS] Job {job_id} not found in background_jobs")
                    raise HTTPException(status_code=404, detail="Job not found")
                
                job_info = background_jobs[job_id]
                print(f"[PROCESS] Job found with status: {job_info.get('status', 'unknown')}")
                
                # Check if job is in uploaded status
                if job_info["status"] != "uploaded":
                    print(f"[PROCESS] Job status is '{job_info['status']}', expected 'uploaded'")
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Job is in '{job_info['status']}' status. Only 'uploaded' jobs can be processed."
                    )
                
                # Get job details
                r2_url = job_info.get("r2_url")
                file_name = job_info.get("file_name", "Unknown")
                
                if not r2_url:
                    raise HTTPException(status_code=400, detail="No R2 URL found for this job")
            
            # Create analytic path
            suffix = Path(file_name).suffix or ".mp4"
            analytic_path = OUTPUT_DIR / f"{job_id}_out{suffix}"
            
            # Update job status to queued
            with job_lock:
                background_jobs[job_id]["status"] = "queued"
                background_jobs[job_id]["message"] = "Job queued for processing..."
            
            # Add job to processing queue
            job_data = {
                "job_id": job_id,
                "stream_url": r2_url,
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
                print(f"[PROCESS] Job {job_id} added to processing queue (position: {queue_position})")
            except Exception as e:
                print(f"[PROCESS] Warning: Failed to start queue processor: {e}")
                # Continue anyway, the job is still added to queue
            
            return {
                "status": "queued",
                "job_id": job_id,
                "queue_position": queue_position,
                "message": f"Job queued for processing (position: {queue_position})",
                "file_name": file_name,
                "r2_url": r2_url
            }
            
        except HTTPException:
            raise
        except Exception as e:
            print(f"[PROCESS] Error: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to start processing: {str(e)}")

    return router
