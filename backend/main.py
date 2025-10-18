from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import time
import threading
import json
import os
from datetime import datetime
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()
# Import API modules
from api.models import *
from api.jobs import init_job_router
from api.video import init_video_router
from api.data import init_data_router
from api.analysis import init_analysis_router
from api.system import init_system_router
from api.status import init_status_router
from api.storage import init_storage_router
import asyncio

# Import core modules
from core.video_processor import main
from utils.shutdown_manager import shutdown_manager
from utils.video_streamer import video_streamer
from clients.supabase_client import supabase_manager

# Import middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, FileResponse

# Create organized temp directories within backend folder (Docker-compatible)
TEMP_DIR = Path("temp")
TEMP_DIR.mkdir(parents=True, exist_ok=True)

TEMP_UPLOADS_DIR = TEMP_DIR / "uploads"
TEMP_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

TEMP_PROCESSING_DIR = TEMP_DIR / "processing"
TEMP_PROCESSING_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_DIR = Path("processed")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Verify directories exist (critical for Docker/RunPod)
print(f"[INIT] Temp directories created:")
print(f"[INIT] - TEMP_DIR: {TEMP_DIR} (exists: {TEMP_DIR.exists()})")
print(f"[INIT] - TEMP_UPLOADS_DIR: {TEMP_UPLOADS_DIR} (exists: {TEMP_UPLOADS_DIR.exists()})")
print(f"[INIT] - TEMP_PROCESSING_DIR: {TEMP_PROCESSING_DIR} (exists: {TEMP_PROCESSING_DIR.exists()})")
print(f"[INIT] - OUTPUT_DIR: {OUTPUT_DIR} (exists: {OUTPUT_DIR.exists()})")

def ensure_directories_exist():
    """Ensure all required directories exist (critical for Docker/RunPod deployment)"""
    directories = [
        TEMP_DIR,
        TEMP_UPLOADS_DIR, 
        TEMP_PROCESSING_DIR,
        OUTPUT_DIR
    ]
    
    for directory in directories:
        try:
            directory.mkdir(parents=True, exist_ok=True)
            print(f"[INIT] ✅ Directory ensured: {directory}")
        except Exception as e:
            print(f"[ERROR] ❌ Failed to create directory {directory}: {e}")
            raise RuntimeError(f"Cannot create required directory: {directory}")

# Ensure directories exist at startup
ensure_directories_exist()

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
    allow_origins=[
        "http://localhost:3000",      # React dev server
        "http://localhost:8000",      # current backend
        "http://localhost:5500",      # Live server (VS Code Live Server)
        "http://127.0.0.1:5500", 
        "http://localhost:5173",
        "https://synerx.netlify.app", # production frontend
        "https://yourdomain.com",     # Add production domain here
        # Add more domains as needed
    ],  
    allow_credentials=True,  # Enable credentials for video streaming
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
    raw_path = job_data.get('raw_path')  # Local file path
    stream_url = job_data.get('stream_url')  # Stream URL for cloud processing
    analytic_path = job_data['analytic_path']
    suffix = job_data['suffix']
    start_time = job_data['start_time']
    video_id = job_data.get('video_id')  # Will be created at processing start
    
    print(f"[QUEUE] 🎯 Processing job {job_id}")
    
    try:
        # Reset shutdown flag before starting processing
        shutdown_manager.reset_shutdown_flag()
        
        # Create video record now (at processing start)
        try:
            # Handle both local files and stream URLs
            if stream_url:
                print(f"[QUEUE] 🌐 Processing from stream URL: {stream_url}")
                file_size = 0  # Unknown for stream URLs
                video_source = stream_url
            else:
                print(f"[QUEUE] 📁 Processing from local file: {raw_path}")
                file_size = os.path.getsize(raw_path) if raw_path and raw_path.exists() else 0
                video_source = str(raw_path)
            # Use the original filename captured at upload time, not the temp uuid name
            try:
                with job_lock:
                    if stream_url:
                        # For stream URLs, get filename from job data
                        original_display_name = background_jobs.get(job_id, {}).get('file_name', 'Stream Video')
                    else:
                        original_display_name = background_jobs.get(job_id, {}).get('file_name', raw_path.name if raw_path else 'Unknown Video')
            except Exception:
                original_display_name = "Unknown Video"
            # Compute duration using OpenCV (fallback to 0 on failure)
            duration_seconds = 0.0
            try:
                import cv2
                if stream_url:
                    cap = cv2.VideoCapture(stream_url)
                else:
                    cap = cv2.VideoCapture(str(raw_path))
                fps = cap.get(cv2.CAP_PROP_FPS) or 0
                frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
                cap.release()
                if fps and frames:
                    duration_seconds = float(frames / fps)
            except Exception as e:
                print(f"[QUEUE] Warning: failed to compute duration for {video_source}: {e}")
            video_data = {
                "video_name": original_display_name,
                "original_filename": original_display_name,  # Use the display name for both
                "file_size": file_size,
                "status": "processing",
                "processing_start_time": datetime.now().isoformat(),
                "duration_seconds": duration_seconds
            }
            video_id = supabase_manager.create_video_record(video_data)
            if not video_id:
                raise RuntimeError("Failed to create video record at processing start")
            with job_lock:
                background_jobs[job_id]["video_id"] = video_id
            print(f"[QUEUE] 🎯 Starting processing for video {video_id}")
        except Exception as e:
            print(f"[QUEUE] ❌ Could not create video record for job {job_id}: {e}")
            with job_lock:
                background_jobs[job_id]["status"] = "failed"
                background_jobs[job_id]["message"] = f"DB init failed: {str(e)}"
                background_jobs[job_id]["error"] = str(e)
            return
        
        with job_lock:
            background_jobs[job_id]["status"] = "processing"
            background_jobs[job_id]["message"] = "Running video analytics..."
            background_jobs[job_id]["progress"] = 10
        
        # Update video status in database (confirm processing)
        supabase_manager.update_video_status_preserve_timing(
            video_id, 
            "processing", 
            message="Running video analytics..."
        )
        
        # Determine total frames for progress estimation
        total_frames = None
        try:
            import cv2
            cap_total = cv2.VideoCapture(str(raw_path))
            tf = cap_total.get(cv2.CAP_PROP_FRAME_COUNT)
            cap_total.release()
            if tf and tf > 0:
                total_frames = int(tf)
        except Exception:
            pass

        # Progress callback updates background job progress (time-based instead of frame-based)
        last_progress_time = 0.0
        last_pct = 10
        processing_start_time = time.time()
        
        def on_progress(processed_frames: int, total):
            try:
                with job_lock:
                    if background_jobs.get(job_id, {}).get("status") == "processing":
                        # Use time-based progress instead of frame-based (since FPS is too high)
                        elapsed_time = time.time() - processing_start_time
                        
                        # Estimate total processing time based on video duration
                        if total and total > 0:
                            # Estimate processing time: video_duration * processing_speed_factor
                            # Based on real data: 1:11 video takes ~69 seconds (about 1x real-time)
                            estimated_duration = (total / 30.0) * 1.0  # 1x real-time processing (more accurate)
                            time_progress = min(0.8, elapsed_time / estimated_duration)  # Cap at 80% for processing
                        else:
                            # Fallback: assume 60 seconds processing time
                            estimated_duration = 60.0
                            time_progress = min(0.8, elapsed_time / estimated_duration)
                        
                        # Map time progress to 10-90%
                        pct = int(10 + time_progress * 80)
                        pct = max(10, min(90, pct))
                        
                        # Quantize to 5% steps for clearer UI changes
                        pct = (pct // 5) * 5
                        
                        # Throttle progress updates to ~1Hz and only when pct increases
                        import time as _t
                        now = _t.time()
                        nonlocal last_progress_time, last_pct
                        if pct > last_pct and (now - last_progress_time) >= 1.0:
                            background_jobs[job_id]["progress"] = pct
                            last_pct = pct
                            last_progress_time = now
                            print(f"[PROGRESS] Time-based progress: {pct}% (elapsed: {elapsed_time:.1f}s, estimated: {estimated_duration:.1f}s)")
            except Exception:
                pass

        # Run video processing - always use database mode with video_id
        from core.video_processor import VideoProcessor
        processing_start = time.time()
        if stream_url:
            processor = VideoProcessor(stream_url=stream_url, output_video_path=str(analytic_path), mode="api", video_id=video_id, progress_callback=on_progress, total_frames=total_frames)
        else:
            processor = VideoProcessor(str(raw_path), str(analytic_path), "api", video_id, progress_callback=on_progress, total_frames=total_frames)
        processor.initialize()
        processor.process_video()
        processing_time = time.time() - processing_start
        print(f"[PROCESSING] Video processing took {processing_time:.2f}s")
        session_data = processor.get_session_data()
        
        # Check if processing was interrupted by shutdown
        partial_video_url = None  # Store partial video URL for interrupted videos
        
        if shutdown_manager.check_shutdown():
            print(f"[QUEUE] 🚫 Video processing was interrupted for video {video_id}")
            
            # For interrupted videos, we need to upload the partial video BEFORE returning
            if analytic_path.exists():
                try:
                    partial_filename = f"interrupted_{job_id}{suffix}"
                    # Upload partial video directly to R2
                    from clients.r2_storage_client import R2StorageClient
                    r2_client = R2StorageClient()
                    partial_video_url = r2_client.upload_video(
                        str(analytic_path), 
                        file_name=partial_filename
                    )
                    if partial_video_url:
                        print(f"[QUEUE] 📹 Partial processed video uploaded for interrupted video {video_id}: {partial_video_url}")
                        
                        # Clean up original video from R2 storage after partial processing
                        try:
                            if stream_url:
                                # Extract filename from original R2 URL
                                original_filename = stream_url.split('/')[-1]
                                print(f"[CLEANUP] 🗑️ Deleting original video from R2 (interrupted): {original_filename}")
                                
                                # Delete original video from R2
                                r2_client.s3_client.delete_object(
                                    Bucket=r2_client.bucket_name,
                                    Key=original_filename
                                )
                                print(f"[CLEANUP] ✅ Original video deleted from R2 (interrupted): {original_filename}")
                            else:
                                print(f"[CLEANUP] ℹ️ No original R2 video to clean up (local file processing)")
                        except Exception as cleanup_error:
                            print(f"[CLEANUP] ⚠️ Failed to delete original video from R2 (interrupted): {cleanup_error}")
                            # Don't fail the process if cleanup fails
                    else:
                        print(f"[WARNING] Failed to upload partial processed video for interrupted video {video_id}")
                except Exception as e:
                    print(f"[WARNING] Failed to upload partial processed video for interrupted video {video_id}: {e}")
            
            # Don't continue with normal completion flow if interrupted
            return
        
        with job_lock:
            background_jobs[job_id]["message"] = "Processing completed, uploading to storage..."
            background_jobs[job_id]["progress"] = 85
        
        # Update video status in database
        supabase_manager.update_video_status_preserve_timing(
            video_id, 
            "processing", 
            message="Processing completed, uploading to storage..."
        )
        
        # Upload processed video to Supabase storage
        processed_video_url = None
        processed_duration_seconds = None
        if analytic_path.exists():
            try:
                processed_filename = f"processed_{job_id}{suffix}"
                # Upload processed video directly to R2 (same as initial upload)
                from clients.r2_storage_client import R2StorageClient
                r2_client = R2StorageClient()
                
                # Get processed file size for comparison
                processed_file_size = analytic_path.stat().st_size
                processed_file_size_mb = processed_file_size / (1024 * 1024)
                print(f"[PROCESSED] File size: {processed_file_size_mb:.2f} MB")
                
                print(f"[PROCESSED] Uploading processed video to R2...")
                processed_upload_start = time.time()
                processed_video_url = r2_client.upload_video(
                    str(analytic_path), 
                    file_name=processed_filename
                )
                processed_upload_time = time.time() - processed_upload_start
                print(f"[PROCESSED] R2 upload took {processed_upload_time:.2f}s ({processed_file_size_mb/processed_upload_time:.2f} MB/s)")
                
                if processed_video_url:
                    print(f"[QUEUE] 📹 Processed video uploaded successfully: {processed_video_url}")
                    
                    # Clean up original video from R2 storage after successful processing
                    try:
                        if stream_url:
                            # Extract filename from original R2 URL
                            original_filename = stream_url.split('/')[-1]
                            print(f"[CLEANUP] 🗑️ Deleting original video from R2: {original_filename}")
                            
                            # Delete original video from R2
                            r2_client.s3_client.delete_object(
                                Bucket=r2_client.bucket_name,
                                Key=original_filename
                            )
                            print(f"[CLEANUP] ✅ Original video deleted from R2: {original_filename}")
                        else:
                            print(f"[CLEANUP] ℹ️ No original R2 video to clean up (local file processing)")
                    except Exception as cleanup_error:
                        print(f"[CLEANUP] ⚠️ Failed to delete original video from R2: {cleanup_error}")
                        # Don't fail the entire process if cleanup fails
                else:
                    print(f"[WARNING] Failed to upload processed video - no URL returned")
                # Compute processed video duration
                try:
                    import cv2
                    cap_o = cv2.VideoCapture(str(analytic_path))
                    fps_o = cap_o.get(cv2.CAP_PROP_FPS) or 0
                    frames_o = cap_o.get(cv2.CAP_PROP_FRAME_COUNT) or 0
                    cap_o.release()
                    if fps_o and frames_o:
                        processed_duration_seconds = float(frames_o / fps_o)
                except Exception as e:
                    print(f"[QUEUE] ⚠️ Failed to compute processed duration: {e}")
                    
            except Exception as e:
                print(f"[WARNING] Failed to upload processed video: {e}")
        else:
            print(f"[WARNING] Processed video file not found: {analytic_path}")
        
        # Update video record with processed URL if available
        if processed_video_url:
            supabase_manager.update_video_status_preserve_timing(
                video_id, 
                "completed",
                processed_url=processed_video_url,
                duration_seconds=processed_duration_seconds if processed_duration_seconds is not None else None,
                message="Processing completed successfully!"
            )
        else:
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
        
        # Update background job with results
        with job_lock:
            background_jobs[job_id]["status"] = "completed"
            background_jobs[job_id]["progress"] = 100
            background_jobs[job_id]["message"] = "Processing completed successfully!"
            background_jobs[job_id]["end_time"] = time.time()
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

        # If no tracking data at all, delete the video row (user preference)
        try:
            related = supabase_manager.get_related_counts(video_id)
            has_any_data = (related.get("tracking_results", 0) > 0) or (related.get("vehicle_counts", 0) > 0)
            if not has_any_data:
                supabase_manager.delete_video_record(video_id)
                print(f"[QUEUE] 🗑️ Removed empty video record {video_id} (no tracking data)")
        except Exception as e:
            print(f"[QUEUE] ⚠️ Failed to delete empty video {video_id}: {e}")
        
    except Exception as e:
        processing_time = time.time() - start_time
        import traceback
        print(f"[QUEUE] ❌ Job {job_id} failed: {e}")
        print(f"[QUEUE] 🔍 FULL TRACEBACK:")
        traceback.print_exc()
        
        with job_lock:
            background_jobs[job_id]["status"] = "failed"
            background_jobs[job_id]["message"] = f"Processing failed: {str(e)}"
            background_jobs[job_id]["error"] = str(e)
            background_jobs[job_id]["end_time"] = time.time()
        
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
        if shutdown_manager.check_shutdown():
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
                    
                    # Compute partial output duration if available
                    partial_duration_seconds = None
                    try:
                        if analytic_path.exists():
                            import cv2
                            cap_p = cv2.VideoCapture(str(analytic_path))
                            fps_p = cap_p.get(cv2.CAP_PROP_FPS) or 0
                            frames_p = cap_p.get(cv2.CAP_PROP_FRAME_COUNT) or 0
                            cap_p.release()
                            if fps_p and frames_p:
                                partial_duration_seconds = float(frames_p / fps_p)
                    except Exception as e:
                        print(f"[QUEUE] ⚠️ Failed to compute partial duration: {e}")

                    # Update video status, processing end time, and partial processed URL if available
                    supabase_manager.update_video_status_preserve_timing(
                        video_id, 
                        status,
                        processed_url=partial_video_url,
                        processing_end_time=datetime.now().isoformat(),
                        duration_seconds=partial_duration_seconds if partial_duration_seconds is not None else None,
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
        # Add small delay to ensure all file handles are released
        time.sleep(1)  # Wait 1 second for file handles to be released
        
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
    """Clean up job files with retry logic to handle file locking"""
    
    def safe_delete(file_path: Path, max_retries: int = 10):
        """Safely delete a file with retry logic"""
        for attempt in range(max_retries):
            try:
                if file_path.exists():
                    file_path.unlink()
                    print(f"[CLEANUP] Removed: {file_path}")
                    return True
            except PermissionError as e:
                if attempt < max_retries - 1:
                    wait_time = min(2 ** attempt, 10)  # Exponential backoff, max 10 seconds
                    print(f"[CLEANUP] File locked, retrying in {wait_time}s... (attempt {attempt + 1}/{max_retries})")
                    time.sleep(wait_time)
                else:
                    print(f"[WARNING] Could not delete {file_path} after {max_retries} attempts: {e}")
                    # Try to force close any handles to the file
                    try:
                        import gc
                        gc.collect()
                        time.sleep(2)
                        if file_path.exists():
                            file_path.unlink()
                            print(f"[CLEANUP] Force removed: {file_path}")
                            return True
                    except Exception:
                        pass
                    return False
            except Exception as e:
                print(f"[WARNING] Failed to delete {file_path}: {e}")
                return False
        return False
    
    # Clean up files with retry logic
    safe_delete(raw_path)
    safe_delete(analytic_path)

def schedule_delayed_cleanup(job_id: str, raw_path: Path, analytic_path: Path):
    """Schedule delayed cleanup for shutdown scenarios to avoid file lock issues"""
    def delayed_cleanup():
        
        # Wait longer for video processing to completely stop
        print(f"[CLEANUP] Waiting for file handles to be released...")
        time.sleep(5)  # Increased wait time
        
        # Use the same safe delete logic with better retry strategy
        def safe_delete(file_path: Path, max_retries: int = 15):
            """Safely delete a file with retry logic"""
            for attempt in range(max_retries):
                try:
                    if file_path.exists():
                        file_path.unlink()
                        print(f"[CLEANUP] Removed (delayed): {file_path}")
                        return True
                except PermissionError as e:
                    if attempt < max_retries - 1:
                        wait_time = min(3 ** attempt, 15)  # Exponential backoff, max 15 seconds
                        print(f"[CLEANUP] File still locked, retrying in {wait_time}s... (attempt {attempt + 1}/{max_retries})")
                        time.sleep(wait_time)
                    else:
                        print(f"[WARNING] Could not delete {file_path} after {max_retries} attempts: {e}")
                        # Final attempt with garbage collection
                        try:
                            import gc
                            gc.collect()
                            time.sleep(5)
                            if file_path.exists():
                                file_path.unlink()
                                print(f"[CLEANUP] Force removed (delayed): {file_path}")
                                return True
                        except Exception:
                            pass
                        return False
                except Exception as e:
                    print(f"[WARNING] Failed to delete {file_path}: {e}")
                    return False
            return False
        
        # Clean up files with retry logic
        safe_delete(raw_path)
        safe_delete(analytic_path)
    
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
storage_router = init_storage_router()

# Include routers
app.include_router(job_router)
app.include_router(video_router)
app.include_router(data_router)
app.include_router(analysis_router)
app.include_router(system_router)
app.include_router(status_router)
app.include_router(storage_router)

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint to test CORS"""
    return {"message": "SynerX API is running!", "status": "ok"}

@app.get("/health")
async def health_check():
    """Health check endpoint that verifies critical directories exist"""
    try:
        # Check if all required directories exist
        directories = {
            "temp": TEMP_DIR.exists(),
            "temp_uploads": TEMP_UPLOADS_DIR.exists(), 
            "temp_processing": TEMP_PROCESSING_DIR.exists(),
            "processed": OUTPUT_DIR.exists()
        }
        
        all_exist = all(directories.values())
        
        return {
            "status": "healthy" if all_exist else "unhealthy",
            "directories": directories,
            "message": "All directories exist" if all_exist else "Some directories missing"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "message": "Health check failed"
        }


@app.get("/videos", include_in_schema=False)
async def videos_page():
    return FileResponse("videos_dashboard.html")

@app.get("/jobs", include_in_schema=False)
async def jobs_page():
    return FileResponse("jobs_dashboard.html")

# WebSocket endpoint
@app.websocket("/ws/video-stream/{client_id}")
async def websocket_video_stream(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time video streaming"""
    print(f"[WS] 🎬 Video stream WebSocket connection attempt for client: {client_id}")
    
    try:
        await websocket.accept()
        await video_streamer.connect(websocket, client_id)
        print(f"[WS] ✅ Video streamer connected for client: {client_id}")
        
        # Keep connection alive and handle messages
        while True:
            try:
                # Check for pending messages from video streamer
                if hasattr(video_streamer, '_pending_message') and video_streamer._pending_message:
                    try:
                        await websocket.send_text(video_streamer._pending_message)
                        video_streamer._pending_message = None
                    except Exception as e:
                        print(f"[WS] Error sending message to {client_id}: {e}")
                        break
                
                # Wait for any message from client (ping/pong) with timeout
                try:
                    data = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
                    try:
                        message = json.loads(data)
                        if message.get("type") == "ping":
                            response = {"type": "pong", "timestamp": time.time()}
                            await websocket.send_text(json.dumps(response))
                    except json.JSONDecodeError:
                        # Handle non-JSON messages
                        response = {"type": "pong", "timestamp": time.time()}
                        await websocket.send_text(json.dumps(response))
                except asyncio.TimeoutError:
                    # Send ping to keep connection alive
                    try:
                        ping_message = {"type": "ping", "timestamp": time.time()}
                        await websocket.send_text(json.dumps(ping_message))
                    except Exception as e:
                        print(f"[WS] Error sending ping to {client_id}: {e}")
                        break
                        
            except WebSocketDisconnect:
                print(f"[WS] Client {client_id} disconnected normally")
                break
            except Exception as e:
                print(f"[WS] Error handling client {client_id}: {e}")
                break
                
    except WebSocketDisconnect:
        print(f"[WS] Client {client_id} disconnected during connection")
    except Exception as e:
        print(f"[WS] Error with client {client_id}: {e}")
    finally:
        try:
            await video_streamer.disconnect(client_id)
        except Exception as e:
            print(f"[WS] Error disconnecting client {client_id}: {e}")

# WebSocket endpoint for live jobs status updates
@app.websocket("/ws/jobs")
async def websocket_jobs_status(websocket: WebSocket):
    """Push jobs summary and list to clients periodically and handle incoming job messages."""
    try:
        await websocket.accept()
        
        # Handle incoming messages (for job creation from frontend)
        async def handle_incoming_messages():
            try:
                while True:
                    message = await websocket.receive_text()
                    print(f"[WS] 📨 Received message: {message[:100]}...")  # Log first 100 chars
                    try:
                        data = json.loads(message)
                        print(f"[WS] 📋 Parsed data: {data}")
                        if data.get("type") == "new_job":
                            # Handle new job from frontend R2 upload
                            job_id = data.get("job_id")
                            r2_url = data.get("r2_url")
                            file_name = data.get("file_name", "Unknown")
                            file_size = data.get("file_size", 0)
                            
                            print(f"[WS] 📨 Received new job from frontend: {job_id}")
                            print(f"[WS] R2 URL: {r2_url}")
                            
                            # Create job record and auto-queue for processing
                            with job_lock:
                                background_jobs[job_id] = {
                                    "status": "queued",
                                    "start_time": time.time(),
                                    "file_name": file_name,
                                    "r2_url": r2_url,
                                    "progress": 0,
                                    "message": "Video uploaded to R2, queued for processing...",
                                    "result": None,
                                    "error": None,
                                    "video_id": None
                                }
                            
                            print(f"[WS] ✅ Job {job_id} created with status: queued")
                            print(f"[WS] 📊 Total jobs now: {len(background_jobs)}")
                            
                            # Auto-add to processing queue
                            suffix = Path(file_name).suffix or ".mp4"
                            analytic_path = OUTPUT_DIR / f"{job_id}_out{suffix}"
                            
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
                                print(f"[WS] 🚀 Job {job_id} auto-queued for processing (position: {queue_position})")
                            except Exception as e:
                                print(f"[WS] ⚠️ Warning: Failed to start queue processor: {e}")
                            
                            # Send confirmation back to frontend
                            await websocket.send_text(json.dumps({
                                "status": "job_queued",
                                "job_id": job_id,
                                "queue_position": queue_position,
                                "message": f"Job auto-queued for processing (position: {queue_position})"
                            }))
                        else:
                            print(f"[WS] ⚠️ Unknown message type: {data.get('type')}")
                            
                    except json.JSONDecodeError:
                        print(f"[WS] ❌ Invalid JSON received: {message}")
                    except Exception as e:
                        print(f"[WS] ❌ Error handling message: {e}")
                        
            except WebSocketDisconnect:
                print(f"[WS] 🔌 WebSocket disconnected")
                pass
            except Exception as e:
                print(f"[WS] ❌ Error in message handler: {e}")
        
        # Start message handler in background
        message_task = asyncio.create_task(handle_incoming_messages())
        
        # Main status update loop
        while True:
            try:
                with job_lock:
                    # Clear completed, interrupted, and failed jobs (older than 5 minutes)
                    current_time = time.time()
                    jobs_to_remove = []
                    for job_id, job in background_jobs.items():
                        if job["status"] in ["completed", "interrupted", "failed"]:
                            # Remove jobs older than 5 minutes
                            job_age = current_time - job.get("end_time", job["start_time"])
                            if job_age > 300:  # 5 minutes = 300 seconds
                                jobs_to_remove.append(job_id)
                    
                    # Remove old completed/failed jobs
                    for job_id in jobs_to_remove:
                        job_status = background_jobs[job_id]["status"]
                        del background_jobs[job_id]
                        print(f"[WS] 🧹 Cleared old {job_status} job: {job_id}")
                    
                    if jobs_to_remove:
                        print(f"[WS] 🧹 Cleared {len(jobs_to_remove)} old jobs")
                    
                    # Build summary payload similar to GET /jobs/
                    all_jobs = []
                    for job_id, job in background_jobs.items():
                        if job["status"] == "processing":
                            elapsed_time = time.time() - job["start_time"]
                        else:
                            end_time = job.get("end_time", job["start_time"])  # default
                            elapsed_time = max(0.0, end_time - job["start_time"])            
                        info = {
                            "job_id": job_id,
                            "status": job["status"],
                            "progress": job["progress"],
                            "file_name": job["file_name"],
                            "start_time": job["start_time"],
                            "elapsed_time": elapsed_time,
                            "message": job["message"],
                            "error": job["error"],
                        }
                        if job.get("result"):
                            info["result"] = job["result"]
                        all_jobs.append(info)

                    status_counts = {}
                    for j in all_jobs:
                        s = j["status"]
                        status_counts[s] = status_counts.get(s, 0) + 1

                    with queue_lock:
                        queue_length = len(job_queue)
                        queue_processor_running = queue_processor_active

                    payload = {
                        "status": "success",
                        "summary": {
                            "total_jobs": len(all_jobs),
                            "status_counts": status_counts,
                            "queue_length": queue_length,
                            "queue_processor_running": queue_processor_running,
                        },
                        "all_jobs": all_jobs,
                    }

                await websocket.send_text(json.dumps(payload))
                await asyncio.sleep(0.5)  # Faster updates for better responsiveness
            except WebSocketDisconnect:
                break
            except Exception as e:
                try:
                    await websocket.send_text(json.dumps({"status":"error","error":str(e)}))
                except Exception:
                    pass
                await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS] Jobs status error: {e}")
    finally:
        # Cancel the message handler task
        if 'message_task' in locals():
            message_task.cancel()

def run_health_server():
    """Runs a simple HTTP server in a thread for health checks."""
    port = int(os.environ.get('PORT_HEALTH', 8080))
    
    class PingHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == '/ping':
                self.send_response(200)
                self.end_headers()
            else:
                self.send_response(404)
                self.end_headers()
        def log_message(self, format, *args):
            # Suppress logging for health checks
            return

    try:
        with HTTPServer(("", port), PingHandler) as httpd:
            print(f"[HEALTH] Starting health check server on port {port}")
            httpd.serve_forever()
    except Exception as e:
        print(f"[HEALTH] Health server failed: {e}")

# Start the health server in a background thread when the app starts
health_thread = threading.Thread(target=run_health_server, daemon=True)
health_thread.start()

@app.post("/runsync")
async def runsync_job(request: Request):
    """
    This is the synchronous endpoint that RunPod will call to execute a job.
    """
    job = await request.json()
    job_input = job.get('input', {})
    
    # --- This logic is adapted from the previous rp_handler.py ---
    video_path_str = job_input.get("video_path")
    if not video_path_str:
        return Response(content='{"error": "Missing \'video_path\' in job input."}', status_code=400, media_type="application/json")

    original_filename = job_input.get("original_filename", Path(video_path_str).name)
    raw_path = Path(video_path_str)

    if not raw_path.exists():
        return Response(content=f'{{"error": "Input video not found at path: {video_path_str}"}}', status_code=404, media_type="application/json")

    job_id = str(uuid.uuid4())
    suffix = raw_path.suffix
    analytic_path = TEMP_PROCESSING_DIR / f"{raw_path.stem}_processed{suffix}"

    with job_lock:
        background_jobs[job_id] = {
            "status": "queued", "progress": 0, "message": "Initializing worker...",
            "error": None, "start_time": time.time(), "file_name": original_filename,
            "result": None, "video_id": None
        }

    job_data = {
        'job_id': job_id, 'raw_path': raw_path, 'analytic_path': analytic_path,
        'suffix': suffix, 'start_time': background_jobs[job_id]["start_time"],
    }
    
    print(f"[RUNPOD] Starting job {job_id} for video {original_filename}")
    
    try:
        # Call your existing function directly
        process_single_job(job_data)
        with job_lock:
            final_status = background_jobs[job_id]
            del background_jobs[job_id]
        return final_status
    except Exception as e:
        print(f"[RUNPOD] Job {job_id} failed with an error: {e}")
        return {"status": "failed", "error": str(e)}



if __name__ == "__main__":
    # Final directory check before starting server
    print("[STARTUP] 🔍 Final directory verification...")
    ensure_directories_exist()
    print("[STARTUP] ✅ All directories verified, starting server...")
    
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
