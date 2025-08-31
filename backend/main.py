from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import shutil
import json
import time
from pathlib import Path
import os, tempfile, uuid
from config.config import Config
from core.video_processor import main
from utils.shutdown_manager import shutdown_manager
from utils.video_streamer import video_streamer

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from clients.supabase_client import supabase_manager

from fastapi.concurrency import run_in_threadpool

from fastapi.responses import StreamingResponse
import time
import threading
import signal
import sys

# Add middleware for larger uploads and security
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.middleware.trustedhost import TrustedHostMiddleware

# Global shutdown flag for graceful termination
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

class LimitUploadSizeMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_upload_size: int):
        super().__init__(app)
        self.max_upload_size = max_upload_size

    async def dispatch(self, request: Request, call_next):
        if request.headers.get("content-length"):
            if int(request.headers["content-length"]) > self.max_upload_size:
                return Response("Request too large", status_code=413)
        return await call_next(request)

OUTPUT_CSV_PATH = Config.OUTPUT_CSV_PATH
COUNT_CSV_PATH = Config.COUNT_CSV_PATH
VIDEO_PATH = Config.VIDEO_PATH
OUTPUT_VIDEO_PATH = Config.OUTPUT_VIDEO_PATH
OUTPUT_DIR = Path("processed")
OUTPUT_DIR.mkdir(exist_ok=True)



app = FastAPI()


# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=[
#         "http://localhost:3000",      # React dev server
#         "http://localhost:8080",      # Vue dev server
#         "http://127.0.0.1:3000",      # Alternative localhost
#         "http://127.0.0.1:8080",      # Alternative localhost
#         # Add your production domain here:
#         # "https://yourdomain.com",
#         # "https://www.yourdomain.com",
#     ],
#     allow_credentials=True,
#     allow_methods=["GET", "POST", "PUT", "DELETE"],
#     allow_headers=["*"],
# )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=False,  
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(LimitUploadSizeMiddleware, max_upload_size=1024*1024*1024)  

app.mount("/videos", StaticFiles(directory=OUTPUT_DIR), name="videos")

# Simple shutdown manager for video processing

def check_api_shutdown():
    """Check if API shutdown has been requested"""
    global api_shutdown_requested
    with api_shutdown_lock:
        return api_shutdown_requested

def start_queue_processor():
    """Start the job queue processor if not already running"""
    global queue_processor_active
    
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
        # Clean up temporary files
        try:
            os.unlink(raw_path)
            if os.path.exists(analytic_path):
                os.unlink(analytic_path)
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

@app.post("/upload-video/")
async def upload_video(
    file: UploadFile = File(...)
):
    try:
        # Reset shutdown flag for this request
        shutdown_manager.reset_shutdown_flag()
        
        # Set processing start time
        set_processing_start_time()
        
        start_time = time.time()
        print("[UPLOAD] Step 1: File received")
        
        # 1. save raw upload locally (temporary)
        suffix = Path(file.filename).suffix or ".mp4"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_in:
            shutil.copyfileobj(file.file, tmp_in)
            raw_path = Path(tmp_in.name)
        print(f"[UPLOAD] Step 2: File saved to {raw_path}")

        # 2. Create job ID and add to queue
        job_id = str(uuid.uuid4())
        analytic_path = OUTPUT_DIR / f"{job_id}_out{suffix}"
        
        # Initialize job status
        with job_lock:
            background_jobs[job_id] = {
                "status": "queued",
                "start_time": time.time(),
                "file_name": file.filename,
                "progress": 0,
                "message": "Video added to processing queue...",
                "result": None,
                "error": None
            }
        
        # Add job to queue
        job_data = {
            "job_id": job_id,
            "raw_path": raw_path,
            "analytic_path": analytic_path,
            "suffix": suffix,
            "start_time": time.time()
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
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.get("/job-status/{job_id}")
async def get_job_status(job_id: str):
    """Get the status of a background video processing job"""
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

@app.get("/jobs/")
async def list_all_jobs():
    """Get comprehensive status of all background jobs"""
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

@app.post("/restart-queue/")
async def restart_queue_processor():
    """Restart the queue processor"""
    try:
        global queue_processor_active, queue_processor_thread
        
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

@app.get("/queue-status/")
async def get_queue_status():
    """Get current queue status and information"""
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

@app.post("/shutdown/")
async def shutdown_processing():
    """Stop the current processing or queued job"""
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

@app.get("/correlation-analysis/")
async def get_correlation_analysis():
    """Get weather-driver behavior correlation analysis"""
    try:
        from utils.correlation_analysis import run_correlation_analysis
        
        # Get tracking data from database
        tracking_data = supabase_manager.get_tracking_data(limit=1000)
        
        if not tracking_data:
            return {
                "status": "no_data",
                "message": "No tracking data available for analysis",
                "analysis": {}
            }
        
        print(f"[CORRELATION] Analyzing {len(tracking_data)} tracking records for weather correlations")
        
        # Run correlation analysis
        analysis_results = run_correlation_analysis(tracking_data)
        
        return {
            "status": "success",
            "data_points": len(tracking_data),
            "analysis": analysis_results
        }
        
    except Exception as e:
        print(f"[ERROR] Correlation analysis failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "analysis": {}
        }

@app.get("/weather-impact/")
async def get_weather_impact_analysis():
    """Get detailed weather impact analysis on driver behavior"""
    try:
        from utils.weather_manager import weather_manager
        
        # Get tracking data from database
        tracking_data = supabase_manager.get_tracking_data(limit=1000)
        
        if not tracking_data:
            return {
                "status": "no_data",
                "message": "No tracking data available for weather impact analysis",
                "weather_impact": {}
            }
        
        print(f"[WEATHER] Analyzing weather impact on {len(tracking_data)} tracking records")
        
        # Run weather impact analysis
        weather_impact = weather_manager.analyze_weather_impact(tracking_data)
        
        return {
            "status": "success",
            "data_points": len(tracking_data),
            "weather_impact": weather_impact
        }
        
    except Exception as e:
        print(f"[ERROR] Weather impact analysis failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "weather_impact": {}
        }

@app.get("/complete-analysis/")
async def get_complete_analysis():
    """Get complete weather-driver behavior analysis including correlations and impact"""
    try:
        from utils.correlation_analysis import run_correlation_analysis
        from utils.weather_manager import weather_manager
        
        # Get tracking data from database
        tracking_data = supabase_manager.get_tracking_data(limit=1000)
        
        if not tracking_data:
            return {
                "status": "no_data",
                "message": "No tracking data available for analysis",
                "complete_analysis": {}
            }
        
        print(f"[ANALYSIS] Running complete analysis on {len(tracking_data)} tracking records")
        
        # Run both analyses
        correlation_results = run_correlation_analysis(tracking_data)
        weather_impact = weather_manager.analyze_weather_impact(tracking_data)
        
        # Combine results
        complete_analysis = {
            "correlation_analysis": correlation_results,
            "weather_impact_analysis": weather_impact,
            "summary": {
                "total_vehicles": len(tracking_data),
                "weather_conditions_found": len(set(r.get('weather_condition') for r in tracking_data if r.get('weather_condition'))),
                "compliance_rate": sum(1 for r in tracking_data if r.get('compliance') == 1) / len(tracking_data) * 100 if tracking_data else 0
            }
        }
        
        return {
            "status": "success",
            "data_points": len(tracking_data),
            "complete_analysis": complete_analysis
        }
        
    except Exception as e:
        print(f"[ERROR] Complete analysis failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "complete_analysis": {}
        }

@app.get("/tracking-data/")
async def get_tracking_data(limit: int = 100):
    """Get tracking results data from database"""
    try:
        # Get tracking data
        tracking_data = supabase_manager.get_tracking_data(limit=limit)
        
        return {
            "status": "success",
            "table": "tracking_results",
            "count": len(tracking_data),
            "limit": limit,
            "data": tracking_data
        }
        
    except Exception as e:
        print(f"[ERROR] Failed to fetch tracking data: {e}")
        return {
            "status": "error",
            "error": str(e),
            "data": []
        }

@app.get("/vehicle-counts/")
async def get_vehicle_counts(limit: int = 100):
    """Get vehicle counts data from database"""
    try:
        # Get vehicle counts
        vehicle_counts = supabase_manager.get_vehicle_counts(limit=limit)
        
        return {
            "status": "success",
            "table": "vehicle_counts",
            "count": len(vehicle_counts),
            "limit": limit,
            "data": vehicle_counts
        }
        
    except Exception as e:
        print(f"[ERROR] Failed to fetch vehicle counts: {e}")
        return {
            "status": "error",
            "error": str(e),
            "data": []
        }

@app.get("/tracking-data/filter/")
async def get_filtered_tracking_data(
    limit: int = 100,
    date_from: str = None,
    date_to: str = None,
    compliance: int = None,
    vehicle_type: str = None,
    weather_condition: str = None
):
    """Get filtered tracking results data from database"""
    try:
        # Get all tracking data first
        tracking_data = supabase_manager.get_tracking_data(limit=1000)
        
        # Apply filters
        filtered_data = tracking_data
        
        # Filter by date range
        if date_from:
            filtered_data = [item for item in filtered_data if item.get('date', '').split(' ')[0] >= date_from]
        
        if date_to:
            filtered_data = [item for item in filtered_data if item.get('date', '').split(' ')[0] <= date_to]
        
        # Filter by compliance
        if compliance is not None:
            filtered_data = [item for item in filtered_data if item.get('compliance') == compliance]
        
        # Filter by vehicle type
        if vehicle_type:
            filtered_data = [item for item in filtered_data if item.get('vehicle_type') == vehicle_type]
        
        # Filter by weather condition
        if weather_condition:
            filtered_data = [item for item in filtered_data if item.get('weather_condition') == weather_condition]
        
        # Apply limit
        filtered_data = filtered_data[:limit]
        
        return {
            "status": "success",
            "table": "tracking_results",
            "count": len(filtered_data),
            "limit": limit,
            "filters_applied": {
                "date_from": date_from,
                "date_to": date_to,
                "compliance": compliance,
                "vehicle_type": vehicle_type,
                "weather_condition": weather_condition
            },
            "data": filtered_data
        }
        
    except Exception as e:
        print(f"[ERROR] Failed to fetch filtered tracking data: {e}")
        return {
            "status": "error",
            "error": str(e),
            "data": []
        }

@app.get("/vehicle-counts/filter/")
async def get_filtered_vehicle_counts(
    limit: int = 100,
    date_from: str = None,
    date_to: str = None,
    vehicle_type: str = None
):
    """Get filtered vehicle counts data from database"""
    try:
        # Get all vehicle counts first
        vehicle_counts = supabase_manager.get_vehicle_counts(limit=1000)
        
        # Apply filters
        filtered_data = vehicle_counts
        
        # Filter by date range
        if date_from:
            filtered_data = [item for item in filtered_data if item.get('date', '').split(' ')[0] >= date_from]
        
        if date_to:
            filtered_data = [item for item in filtered_data if item.get('date', '').split(' ')[0] <= date_to]
        
        # Filter by vehicle type
        if vehicle_type:
            filtered_data = [item for item in filtered_data if item.get('vehicle_type') == vehicle_type]
        
        # Apply limit
        filtered_data = filtered_data[:limit]
        
        return {
            "status": "success",
            "table": "vehicle_counts",
            "count": len(filtered_data),
            "limit": limit,
            "filters_applied": {
                "date_from": date_from,
                "date_to": date_to,
                "vehicle_type": vehicle_type
            },
            "data": filtered_data
        }
        
    except Exception as e:
        print(f"[ERROR] Failed to fetch filtered vehicle counts: {e}")
        return {
            "status": "error",
            "error": str(e),
            "data": []
        }

@app.get("/")
async def root():
    """Root endpoint to test CORS"""
    return {"message": "SynerX API is running!", "status": "ok"}

@app.get("/status/")
async def get_processing_status():
    """Check if processing is currently active"""
    try:
        is_shutdown_requested = shutdown_manager.check_shutdown()
        processing_time = get_processing_time()
        return {
            "processing_active": not is_shutdown_requested,
            "shutdown_requested": is_shutdown_requested,
            "processing_time": processing_time
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}



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

@app.get("/stream-status/")
async def get_stream_status():
    """Get current streaming status"""
    try:
        connection_count = video_streamer.get_connection_count()
        return {
            "streaming_active": video_streamer.streaming_active,
            "active_connections": connection_count,
            "status": "active" if video_streamer.streaming_active else "inactive"
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
