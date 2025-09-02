from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import time
import threading
import json
import os
from datetime import datetime

# Import API modules
from api.models import *
from api.jobs import init_job_router
from api.video import init_video_router
from api.data import init_data_router
from api.analysis import init_analysis_router
from api.system import init_system_router
from api.status import init_status_router

# Import core modules
from core.video_processor import main
from utils.shutdown_manager import shutdown_manager
from utils.video_streamer import video_streamer
from clients.supabase_client import supabase_manager

# Import middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Create organized temp directories within backend folder
TEMP_DIR = Path("temp")
TEMP_DIR.mkdir(exist_ok=True)

TEMP_UPLOADS_DIR = TEMP_DIR / "uploads"
TEMP_UPLOADS_DIR.mkdir(exist_ok=True)

TEMP_PROCESSING_DIR = TEMP_DIR / "processing"
TEMP_PROCESSING_DIR.mkdir(exist_ok=True)

OUTPUT_DIR = Path("processed")
OUTPUT_DIR.mkdir(exist_ok=True)

# Global variables
api_shutdown_requested = False
api_shutdown_lock = threading.Lock()
processing_start_time = None
processing_lock = threading.Lock()

# Background job tracking
background_jobs = {}
job_lock = threading.Lock()

# Queue for background jobs
job_queue = []
queue_lock = threading.Lock()
queue_processor_active = False
queue_processor_thread = None

# Middleware for upload size limits
class LimitUploadSizeMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_upload_size: int):
        super().__init__(app)
        self.max_upload_size = max_upload_size

    async def dispatch(self, request: Request, call_next):
        if request.headers.get("content-length"):
            if int(request.headers["content-length"]) > self.max_upload_size:
                return Response("Request too large", status_code=413)
        return await call_next(request)

# Create FastAPI app
app = FastAPI(
    title="SynerX Video Processing API",
    description="API for video processing with vehicle tracking and analysis",
    version="1.0.0"
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=False,  
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(LimitUploadSizeMiddleware, max_upload_size=1024*1024*1024)  

# Mount static files
app.mount("/videos", StaticFiles(directory=OUTPUT_DIR), name="videos")

# Queue processing functions
def start_queue_processor():
    """Start the job queue processor if not already running"""
    global queue_processor_active, queue_processor_thread
    
    with queue_lock:
        if not queue_processor_active:
            queue_processor_active = True
            queue_processor_thread = threading.Thread(target=process_job_queue, daemon=True)
            queue_processor_thread.start()
            print("[QUEUE] 🚀 Job queue processor started")

def process_job_queue():
    """Process jobs in the queue sequentially with video-based schema"""
    global queue_processor_active
    
    print("[QUEUE] 🔄 Queue processor started - waiting for jobs...")
    
    while queue_processor_active:
        try:
            # Get next job from queue
            job_data = None
            with queue_lock:
                if job_queue:
                    job_data = job_queue.pop(0)
                    print(f"[QUEUE] 📋 Processing job: {job_data['job_id']}")
            
            if job_data:
                # Process the job
                process_single_job(job_data)
            else:
                # No jobs in queue, sleep for a bit
                time.sleep(1)
                
        except Exception as e:
            print(f"[QUEUE] ❌ Error in queue processor: {e}")
            time.sleep(5)  # Wait before retrying
    
    print("[QUEUE] 🛑 Queue processor stopped")

def process_single_job(job_data):
    """Process a single video job with video-based schema"""
    job_id = job_data['job_id']
    raw_path = job_data['raw_path']
    analytic_path = job_data['analytic_path']
    suffix = job_data['suffix']
    start_time = job_data['start_time']
    video_id = job_data.get('video_id')  # New: video ID from job data
    
    # Validate video_id
    if not video_id:
        print(f"[QUEUE] ❌ Job {job_id} has no video_id - cannot process")
        with job_lock:
            background_jobs[job_id]["status"] = "failed"
            background_jobs[job_id]["message"] = "No video_id provided - cannot process"
            background_jobs[job_id]["error"] = "Missing video_id"
        return
    
    print(f"[QUEUE] 🎯 Processing job {job_id} for video {video_id}")
    
    try:
        # Reset shutdown flag before starting processing
        shutdown_manager.reset_shutdown_flag()
        
        # Create job record in database if video_id exists
        if video_id:
            # No need to create job records - background tasks handle job management
            # Just update video status to processing
            print(f"[QUEUE] 🎯 Starting processing for video {video_id}")
            
            # Update video record with processing status
            supabase_manager.update_video_status_preserve_timing(
                video_id, 
                "processing", 
                message="Running video analytics..."
            )
        
        with job_lock:
            background_jobs[job_id]["status"] = "processing"
            background_jobs[job_id]["message"] = "Running video analytics..."
            background_jobs[job_id]["progress"] = 10
        
        # Update video status in database (no job records needed)
        if video_id:
            supabase_manager.update_video_status_preserve_timing(
                video_id, 
                "processing", 
                message="Running video analytics..."
            )
        
        # Run video processing - always use database mode with video_id
        session_data = main(
            str(raw_path),          # input video (original)
            str(analytic_path),     # processed output
            "api",                  # Always use database mode
            video_id                # New: video ID for linking data
        )
        
        # Check if processing was interrupted by shutdown
        partial_video_url = None  # Store partial video URL for interrupted videos
        
        if shutdown_manager.check_shutdown():
            print(f"[QUEUE] 🚫 Video processing was interrupted for video {video_id}")
            
            # For interrupted videos, we need to upload the partial video BEFORE returning
            if analytic_path.exists():
                try:
                    partial_filename = f"interrupted_{job_id}{suffix}"
                    partial_video_url = supabase_manager.upload_video_to_storage(
                        str(analytic_path), 
                        file_name=partial_filename
                    )
                    if partial_video_url:
                        print(f"[QUEUE] 📹 Partial processed video uploaded for interrupted video {video_id}: {partial_video_url}")
                    else:
                        print(f"[WARNING] Failed to upload partial processed video for interrupted video {video_id}")
                except Exception as e:
                    print(f"[WARNING] Failed to upload partial processed video for interrupted video {video_id}: {e}")
            
            # Don't continue with normal completion flow if interrupted
            return
        
        with job_lock:
            background_jobs[job_id]["message"] = "Processing completed, uploading to storage..."
            background_jobs[job_id]["progress"] = 80
        
        # Update video status in database
        if video_id:
            supabase_manager.update_video_status_preserve_timing(
                video_id, 
                "processing", 
                message="Processing completed, uploading to storage..."
            )
        
        # Upload processed video to Supabase storage
        processed_video_url = None
        if analytic_path.exists():
            try:
                processed_filename = f"processed_{job_id}{suffix}"
                processed_video_url = supabase_manager.upload_video_to_storage(
                    str(analytic_path), 
                    file_name=processed_filename
                )
                
                if processed_video_url:
                    print(f"[QUEUE] 📹 Processed video uploaded successfully: {processed_video_url}")
                else:
                    print(f"[WARNING] Failed to upload processed video - no URL returned")
                    
            except Exception as e:
                print(f"[WARNING] Failed to upload processed video: {e}")
        else:
            print(f"[WARNING] Processed video file not found: {analytic_path}")
        
        # Update video record with processed URL if available
        if video_id and processed_video_url:
            supabase_manager.update_video_status_preserve_timing(
                video_id, 
                "completed",
                processed_url=processed_video_url,
                message="Processing completed successfully!"
            )
        elif video_id:
            # No processed video URL available
            supabase_manager.update_video_status_preserve_timing(
                video_id, 
                "completed",
                message="Processing completed but no video uploaded"
            )
        
        # Calculate statistics from the actual saved data in database
        processing_time = time.time() - start_time
        
        # Get actual saved data from database for accurate statistics
        tracking_data = supabase_manager.get_tracking_data(video_id=video_id) if video_id else []
        vehicle_counts = supabase_manager.get_vehicle_counts(video_id=video_id) if video_id else []
        
        print(f"[DEBUG] Retrieved tracking data: {len(tracking_data)} records for video {video_id}")
        print(f"[DEBUG] Retrieved vehicle counts: {len(vehicle_counts)} records for video {video_id}")
        
        total_vehicles = len(tracking_data) if tracking_data else 0
        compliance_count = sum(1 for item in tracking_data if isinstance(item, dict) and item.get('compliance') == 1)
        compliance_rate = (compliance_count / total_vehicles * 100) if total_vehicles > 0 else 0
        
        print(f"[DEBUG] Calculated stats: {total_vehicles} vehicles, {compliance_count} compliant, {compliance_rate:.1f}% rate")
        
        # Update video statistics in database
        if video_id:
            success = supabase_manager.update_video_stats(
                video_id, 
                total_vehicles, 
                compliance_rate, 
                processing_time
            )
            if success:
                print(f"[QUEUE] ✅ Video {video_id} statistics updated: {total_vehicles} vehicles, {compliance_rate:.1f}% compliance")
            else:
                print(f"[QUEUE] ⚠️ Failed to update video {video_id} statistics")
        else:
            print(f"[QUEUE] ⚠️ No video_id available for statistics update")
        
        # Update background job with results
        with job_lock:
            background_jobs[job_id]["status"] = "completed"
            background_jobs[job_id]["progress"] = 100
            background_jobs[job_id]["message"] = "Processing completed successfully!"
            background_jobs[job_id]["result"] = {
                "status": "done",
                "processed_video_url": processed_video_url,
                "tracking_data": tracking_data,
                "vehicle_counts": vehicle_counts,
                "processing_stats": {
                    "total_vehicles": total_vehicles,
                    "compliance_rate": compliance_rate,
                    "processing_time": processing_time,
                    "total_processing_time": processing_time
                }
            }
        
        print(f"[QUEUE] ✅ Job {job_id} completed successfully for video {video_id}")
        
    except Exception as e:
        processing_time = time.time() - start_time
        print(f"[QUEUE] ❌ Job {job_id} failed: {e}")
        
        with job_lock:
            background_jobs[job_id]["status"] = "failed"
            background_jobs[job_id]["message"] = f"Processing failed: {str(e)}"
            background_jobs[job_id]["error"] = str(e)
        
        # Update video status in database with error details
        if video_id:
            supabase_manager.update_video_status_preserve_timing(
                video_id, 
                "failed",
                message=f"Processing failed: {str(e)}",
                error=str(e)
            )
    
    finally:
        # Handle shutdown scenarios intelligently first
        if video_id and shutdown_manager.check_shutdown():
            try:
                # Check if we have any saved data to determine the appropriate status
                tracking_data = supabase_manager.get_tracking_data(video_id=video_id) if video_id else []
                vehicle_counts = supabase_manager.get_vehicle_counts(video_id=video_id) if video_id else []
                
                has_saved_data = len(tracking_data) > 0 or len(vehicle_counts) > 0
                
                if has_saved_data:
                    # Processing was interrupted but we have partial results
                    status = "interrupted"
                    message = f"Processing interrupted but saved {len(tracking_data)} tracking records and {len(vehicle_counts)} vehicle counts"
                    print(f"[QUEUE] 🚫 Video {video_id} status updated to interrupted (partial data saved)")
                    
                    # Calculate partial statistics from saved data
                    processing_time = time.time() - start_time
                    total_vehicles = len(tracking_data) if tracking_data else 0
                    compliance_count = sum(1 for item in tracking_data if isinstance(item, dict) and item.get('compliance') == 1)
                    compliance_rate = (compliance_count / total_vehicles * 100) if total_vehicles > 0 else 0
                    
                    print(f"[DEBUG] Interrupted video stats: {total_vehicles} vehicles, {compliance_count} compliant, {compliance_rate:.1f}% rate")
                    
                    # The partial video was already uploaded in the early return section
                    # partial_video_url variable already contains the URL from the upload above
                    
                    # Update video statistics in database with partial data
                    supabase_manager.update_video_stats(
                        video_id, 
                        total_vehicles, 
                        compliance_rate, 
                        processing_time
                    )
                    
                    # Update video status, processing end time, and partial processed URL if available
                    supabase_manager.update_video_status_preserve_timing(
                        video_id, 
                        status,
                        processed_url=partial_video_url,
                        processing_end_time=datetime.now().isoformat(),
                        message=message
                    )
                    
                else:
                    # Processing was cancelled before any data was saved
                    status = "cancelled"
                    message = "Processing cancelled before data collection"
                    print(f"[QUEUE] 🚫 Video {video_id} status updated to cancelled (no data saved)")
                    
                    # Update video status with message
                    supabase_manager.update_video_status_preserve_timing(
                        video_id, 
                        status,
                        message=message
                    )
                    
            except Exception as e:
                print(f"[WARNING] Failed to update video {video_id} status for shutdown: {e}")
        
        # Clean up temporary files AFTER processing is completely stopped
        # For shutdown scenarios, delay cleanup to avoid file lock issues
        if shutdown_manager.check_shutdown():
            # Schedule delayed cleanup for shutdown scenarios
            print(f"[QUEUE] 🚫 Scheduling delayed cleanup for shutdown job {job_id}")
            schedule_delayed_cleanup(job_id, raw_path, analytic_path)
        else:
            # Immediate cleanup for normal completion/failure
            cleanup_job_files(job_id, raw_path, analytic_path)

def set_processing_start_time():
    """Set the processing start time"""
    global processing_start_time
    with processing_lock:
        processing_start_time = time.time()

def get_processing_time():
    """Get the current processing time in seconds"""
    global processing_start_time
    with processing_lock:
        if processing_start_time is None:
            return 0
        return time.time() - processing_start_time

def cleanup_temp_files():
    """Clean up old temporary files and orphaned files"""
    try:
        current_time = time.time()
        cleaned_count = 0
        
        # Get active job IDs (processing, queued, or recently completed/failed)
        active_job_ids = set()
        with job_lock:
            for job_id in background_jobs.keys():
                active_job_ids.add(job_id)
        
        # Clean up temp uploads older than 1 hour OR orphaned files
        for upload_file in TEMP_UPLOADS_DIR.glob("*.mp4"):
            try:
                file_age = current_time - upload_file.stat().st_mtime
                if file_age > 3600:  # 1 hour
                    upload_file.unlink()
                    cleaned_count += 1
                    print(f"[CLEANUP] Removed old temp upload: {upload_file}")
            except Exception as e:
                print(f"[WARNING] Failed to clean up old temp upload {upload_file}: {e}")
        
        # Clean up temp processing files older than 1 hour OR orphaned files
        for processing_file in TEMP_PROCESSING_DIR.glob("*.mp4"):
            try:
                file_age = current_time - processing_file.stat().st_mtime
                if file_age > 3600:  # 1 hour
                    processing_file.unlink()
                    cleaned_count += 1
                    print(f"[CLEANUP] Removed old temp processing file: {processing_file}")
            except Exception as e:
                print(f"[WARNING] Failed to clean up old temp processing file {processing_file}: {e}")
        
        # Clean up processed output files older than 24 hours
        for output_file in OUTPUT_DIR.glob("*.mp4"):
            try:
                file_age = current_time - output_file.stat().st_mtime
                if file_age > 86400:  # 24 hours
                    output_file.unlink()
                    cleaned_count += 1
                    print(f"[CLEANUP] Removed old output file: {output_file}")
            except Exception as e:
                print(f"[WARNING] Failed to clean up old output file {output_file}: {e}")
        
        if cleaned_count > 0:
            print(f"[CLEANUP] Cleaned up {cleaned_count} old temporary files")
        else:
            print("[CLEANUP] No old temporary files to clean up")
            
    except Exception as e:
        print(f"[WARNING] Error during temp file cleanup: {e}")

def cleanup_job_files(job_id: str, raw_path: Path, analytic_path: Path):
    """Clean up job files immediately (for normal completion/failure)"""
    try:
        if raw_path.exists():
            raw_path.unlink()
            print(f"[CLEANUP] Removed temp upload: {raw_path}")
        if analytic_path.exists():
            analytic_path.unlink()
            print(f"[CLEANUP] Removed temp output: {analytic_path}")
    except Exception as e:
        print(f"[WARNING] Failed to clean up files for job {job_id}: {e}")

def schedule_delayed_cleanup(job_id: str, raw_path: Path, analytic_path: Path):
    """Schedule delayed cleanup for shutdown scenarios to avoid file lock issues"""
    def delayed_cleanup():
        import time
        # Wait a bit for video processing to completely stop
        time.sleep(2)
        try:
            if raw_path.exists():
                raw_path.unlink()
                print(f"[CLEANUP] Removed temp upload (delayed): {raw_path}")
            if analytic_path.exists():
                analytic_path.unlink()
                print(f"[CLEANUP] Removed temp output (delayed): {analytic_path}")
        except Exception as e:
            print(f"[WARNING] Failed to clean up files for job {job_id} (delayed): {e}")
    
    # Run delayed cleanup in a separate thread
    cleanup_thread = threading.Thread(target=delayed_cleanup, daemon=True)
    cleanup_thread.start()
    print(f"[CLEANUP] Scheduled delayed cleanup for job {job_id}")

# Initialize API routers
job_router = init_job_router(
    background_jobs, job_lock, job_queue, queue_lock, 
    queue_processor_active, start_queue_processor, shutdown_manager
)

video_router = init_video_router(
    background_jobs, job_lock, job_queue, queue_lock, start_queue_processor,
    shutdown_manager, set_processing_start_time, TEMP_UPLOADS_DIR, OUTPUT_DIR
)

data_router = init_data_router()
analysis_router = init_analysis_router()
system_router = init_system_router(cleanup_temp_files, job_lock, background_jobs)
status_router = init_status_router(shutdown_manager, get_processing_time)

# Include routers
app.include_router(job_router)
app.include_router(video_router)
app.include_router(data_router)
app.include_router(analysis_router)
app.include_router(system_router)
app.include_router(status_router)

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint to test CORS"""
    return {"message": "SynerX API is running!", "status": "ok"}

# WebSocket endpoint
@app.websocket("/ws/video-stream/{client_id}")
async def websocket_video_stream(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time video streaming"""
    try:
        await video_streamer.connect(websocket, client_id)
        
        # Keep connection alive and handle messages
        while True:
            try:
                # Wait for any message from client (ping/pong)
                data = await websocket.receive_text()
                message = {"type": "pong", "timestamp": time.time()}
                await websocket.send_text(json.dumps(message))
            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"[WS] Error handling client {client_id}: {e}")
                break
                
    except WebSocketDisconnect:
        print(f"[WS] Client {client_id} disconnected")
    except Exception as e:
        print(f"[WS] Error with client {client_id}: {e}")
    finally:
        await video_streamer.disconnect(client_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
