from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import time
import threading
import json
import os

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
    """Process jobs in the queue sequentially"""
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
    """Process a single video job"""
    job_id = job_data['job_id']
    raw_path = job_data['raw_path']
    analytic_path = job_data['analytic_path']
    suffix = job_data['suffix']
    start_time = job_data['start_time']
    
    try:
        # Reset shutdown flag before starting processing
        shutdown_manager.reset_shutdown_flag()
        
        with job_lock:
            background_jobs[job_id]["status"] = "processing"
            background_jobs[job_id]["message"] = "Running video analytics..."
            background_jobs[job_id]["progress"] = 10
        
        # Run video processing
        session_data = main(
            str(raw_path),          # input video (original)
            str(analytic_path),     # processed output
            "api"                   # API mode - save to database only
        )
        
        with job_lock:
            background_jobs[job_id]["message"] = "Processing completed, uploading to storage..."
            background_jobs[job_id]["progress"] = 80
        
        # Upload processed video to Supabase storage
        processed_video_url = None
        try:
            processed_filename = f"processed_{job_id}{suffix}"
            processed_video_url = supabase_manager.upload_video_to_storage(
                str(analytic_path), 
                file_name=processed_filename
            )
        except Exception as e:
            print(f"[WARNING] Failed to upload processed video: {e}")
        
        # Calculate statistics
        processing_time = time.time() - start_time
        tracking_data = session_data.get("tracking_data", []) if session_data else []
        vehicle_counts = session_data.get("vehicle_counts", []) if session_data else []
        total_vehicles = len(tracking_data)
        compliance_count = sum(1 for item in tracking_data if isinstance(item, dict) and item.get('compliance') == 1)
        compliance_rate = (compliance_count / total_vehicles * 100) if total_vehicles > 0 else 0
        
        # Update job with results
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
        
        print(f"[QUEUE] ✅ Job {job_id} completed successfully")
        
    except Exception as e:
        processing_time = time.time() - start_time
        print(f"[QUEUE] ❌ Job {job_id} failed: {e}")
        
        with job_lock:
            background_jobs[job_id]["status"] = "failed"
            background_jobs[job_id]["message"] = f"Processing failed: {str(e)}"
            background_jobs[job_id]["error"] = str(e)
    
    finally:
        # Clean up temporary files from organized temp directory
        try:
            if raw_path.exists():
                raw_path.unlink()
                print(f"[CLEANUP] Removed temp upload: {raw_path}")
            if analytic_path.exists():
                analytic_path.unlink()
                print(f"[CLEANUP] Removed temp output: {analytic_path}")
        except Exception as e:
            print(f"[WARNING] Failed to clean up files for job {job_id}: {e}")

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
        for temp_file in TEMP_UPLOADS_DIR.glob("*"):
            if temp_file.is_file():
                file_age = current_time - temp_file.stat().st_mtime
                should_clean = False
                
                # Check if file is old enough
                if file_age > 3600:  # 1 hour
                    should_clean = True
                    reason = "old file"
                else:
                    # Check if file is orphaned (no corresponding active job)
                    file_stem = temp_file.stem  # filename without extension
                    if file_stem not in active_job_ids:
                        should_clean = True
                        reason = "orphaned file"
                
                if should_clean:
                    temp_file.unlink()
                    cleaned_count += 1
                    print(f"[CLEANUP] Removed {reason}: {temp_file}")
        
        # Clean up temp processing files older than 30 minutes OR orphaned files
        for temp_file in TEMP_PROCESSING_DIR.glob("*"):
            if temp_file.is_file():
                file_age = current_time - temp_file.stat().st_mtime
                should_clean = False
                
                # Check if file is old enough
                if file_age > 1800:  # 30 minutes
                    should_clean = True
                    reason = "old file"
                else:
                    # Check if file is orphaned (no corresponding active job)
                    file_stem = temp_file.stem  # filename without extension
                    if file_stem not in active_job_ids:
                        should_clean = True
                        reason = "orphaned file"
                
                if should_clean:
                    temp_file.unlink()
                    cleaned_count += 1
                    print(f"[CLEANUP] Removed {reason}: {temp_file}")
        
        # Clean up orphaned output files in processed directory
        for output_file in OUTPUT_DIR.glob("*"):
            if output_file.is_file():
                # Check if file is orphaned (no corresponding active job)
                file_stem = output_file.stem.replace("_out", "")  # Remove _out suffix
                if file_stem not in active_job_ids:
                    output_file.unlink()
                    cleaned_count += 1
                    print(f"[CLEANUP] Removed orphaned output file: {output_file}")
        
        if cleaned_count > 0:
            print(f"[CLEANUP] Cleaned up {cleaned_count} temporary/orphaned files")
        
        return cleaned_count
    except Exception as e:
        print(f"[WARNING] Failed to cleanup temp files: {e}")
        return 0

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
