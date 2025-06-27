from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import shutil
from pathlib import Path
import os, tempfile, uuid
from config.config import Config
from main import main, set_shutdown_flag, reset_shutdown_flag, check_shutdown
from blur_core import blur_license_plates
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from supabase_client import supabase_manager

from fastapi.concurrency import run_in_threadpool

from fastapi.responses import StreamingResponse
import api_plots as plot
import time
import signal
import threading

# Add middleware for larger uploads
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Global shutdown flag for graceful termination
api_shutdown_requested = False
api_shutdown_lock = threading.Lock()

def signal_handler(signum, frame):
    """Handle interrupt signals gracefully"""
    global api_shutdown_requested
    with api_shutdown_lock:
        api_shutdown_requested = True
    # Also set the main module's shutdown flag
    set_shutdown_flag()
    print(f"\n[API] Received signal {signum}. Shutting down gracefully...")

# Set up signal handlers for the main process
signal.signal(signal.SIGINT, signal_handler)   # Ctrl+C
signal.signal(signal.SIGTERM, signal_handler)  # Termination signal

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

from ultralytics import YOLO
MODEL_PATH = 'models/best.pt' # Ensure this path is correct relative to where you run api.py
print(f" ✅Loading Blur model from '{MODEL_PATH}'...")
model = YOLO(MODEL_PATH)
print("✅ Model loaded successfully.\n")

app = FastAPI()
app.add_middleware(LimitUploadSizeMiddleware, max_upload_size=1024*1024*1024)  # 1GB limit
app.mount("/videos", StaticFiles(directory=OUTPUT_DIR), name="videos")

def check_api_shutdown():
    """Check if API shutdown has been requested"""
    global api_shutdown_requested
    with api_shutdown_lock:
        return api_shutdown_requested

@app.post("/upload-video/")
async def upload_video(
    file: UploadFile = File(...)
):
    # Reset shutdown flag for this request
    reset_shutdown_flag()
    
    start_time = time.time()
    print("[UPLOAD] Step 1: File received")
    
    # 1. save raw upload locally (temporary)
    suffix = Path(file.filename).suffix or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_in:
        shutil.copyfileobj(file.file, tmp_in)
        raw_path = Path(tmp_in.name)
    print(f"[UPLOAD] Step 2: File saved to {raw_path}")

    # 2. run analytics using main.py (skip blurring)
    analytic_path = OUTPUT_DIR / f"{uuid.uuid4().hex}_out{suffix}"
    print(f"[UPLOAD] Step 3: Running analytics to {analytic_path}")
    
    try:
        await run_in_threadpool(
            main,                   # your analytics
            str(raw_path),          # input video (original)
            str(analytic_path)      # processed output
        )
        print(f"[UPLOAD] Step 4: Analytics done: {analytic_path}")
    except KeyboardInterrupt:
        print("[UPLOAD] Processing interrupted by user (Ctrl+C)")
        # Clean up temporary files
        try:
            os.unlink(raw_path)
            if os.path.exists(analytic_path):
                os.unlink(analytic_path)
        except Exception as e:
            print(f"[WARNING] Failed to clean up files after interrupt: {e}")
        raise HTTPException(status_code=499, detail="Processing interrupted by user")
    except Exception as e:
        print(f"[ERROR] Processing failed: {e}")
        # Clean up temporary files
        try:
            os.unlink(raw_path)
            if os.path.exists(analytic_path):
                os.unlink(analytic_path)
        except Exception as cleanup_error:
            print(f"[WARNING] Failed to clean up files after error: {cleanup_error}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

    # 3. Upload ONLY the processed video to Supabase storage
    processed_video_url = None
    try:
        processed_filename = f"processed_{uuid.uuid4().hex}{suffix}"
        print("[UPLOAD] Step 5: Uploading processed video to Supabase...")
        processed_video_url = supabase_manager.upload_video_to_storage(
            str(analytic_path), 
            file_name=processed_filename
        )
        print(f"[UPLOAD] Step 6: Processed video uploaded: {processed_video_url}")
    except Exception as e:
        print(f"[WARNING] Failed to upload processed video to Supabase: {e}")

    # 4. Get data from Supabase
    tracking_data = []
    vehicle_counts = []
    print("[UPLOAD] Step 7: Fetching analytics data from Supabase...")
    try:
        tracking_data = supabase_manager.get_tracking_data(limit=1000)
        vehicle_counts = supabase_manager.get_vehicle_counts(limit=1000)
        print(f"[UPLOAD] Step 8: Got {len(tracking_data)} tracking records and {len(vehicle_counts)} vehicle counts.")
    except Exception as e:
        print(f"[WARNING] Failed to retrieve data from Supabase: {e}")
        # Fallback to CSV files
        if os.path.exists(OUTPUT_CSV_PATH):
            with open(OUTPUT_CSV_PATH) as f:
                tracking_data = f.read()
        if os.path.exists(COUNT_CSV_PATH):
            with open(COUNT_CSV_PATH) as f:
                vehicle_counts = f.read()

    # 5. Calculate processing statistics
    processing_time = time.time() - start_time
    total_vehicles = len(tracking_data) if isinstance(tracking_data, list) else 0
    compliance_count = sum(1 for item in tracking_data if isinstance(item, dict) and item.get('compliance') == 1)
    compliance_rate = (compliance_count / total_vehicles * 100) if total_vehicles > 0 else 0
    print(f"[UPLOAD] Step 9: Processing stats calculated. Time: {processing_time:.2f}s, Vehicles: {total_vehicles}, Compliance: {compliance_rate:.2f}%")

    # 6. Clean up temporary files
    try:
        os.unlink(raw_path)
        os.unlink(analytic_path)
        print("[UPLOAD] Step 10: Temporary files cleaned up.")
    except Exception as e:
        print(f"[WARNING] Failed to clean up temporary files: {e}")

    print("[UPLOAD] Step 11: Returning response.")
    return {
        "status": "done",
        "processed_video_url": processed_video_url,
        "tracking_data": tracking_data,
        "vehicle_counts": vehicle_counts,
        "processing_stats": {
            "total_vehicles": total_vehicles,
            "compliance_rate": compliance_rate,
            "processing_time": processing_time
        }
    }

@app.get("/get-results/")
async def get_results():
    # Return results from Supabase
    try:
        tracking_data = supabase_manager.get_tracking_data(limit=1000)
        vehicle_counts = supabase_manager.get_vehicle_counts(limit=1000)
        
        return JSONResponse(content={
            "tracking_results": tracking_data, 
            "vehicle_counts": vehicle_counts
        })
    except Exception as e:
        print(f"[ERROR] Failed to retrieve data from Supabase: {e}")
        # Fallback to CSV files
        if not os.path.exists(OUTPUT_CSV_PATH) or not os.path.exists(COUNT_CSV_PATH):
            return JSONResponse(content={"error": "No results available. Process a video first."})

        with open(OUTPUT_CSV_PATH, "r") as csvfile:
            tracking_results = csvfile.read()
        with open(COUNT_CSV_PATH, "r") as countfile:
            count_results = countfile.read()

        return JSONResponse(content={"tracking_results": tracking_results, "vehicle_counts": count_results})

@app.post("/blur/")
async def blur_video(
    file: UploadFile = File(...)
):
    # Reset shutdown flag for this request
    reset_shutdown_flag()
    
    # 1) stash upload in a temp file
    suffix = Path(file.filename).suffix or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_in:
        shutil.copyfileobj(file.file, tmp_in)
        in_path = Path(tmp_in.name)

    # 2) choose a unique name for the output
    out_name = f"{uuid.uuid4().hex}{suffix}"
    out_path = OUTPUT_DIR / out_name

    # 3) run the heavy work off-thread
    try:
        await run_in_threadpool(
            blur_license_plates,
            video_path=str(in_path),
            output_path=str(out_path),
            model=model, # Pass the loaded model
        )
    except KeyboardInterrupt:
        print("[BLUR] Processing interrupted by user (Ctrl+C)")
        # Clean up temporary files
        try:
            os.unlink(in_path)
            if os.path.exists(out_path):
                os.unlink(out_path)
        except Exception as e:
            print(f"[WARNING] Failed to clean up files after interrupt: {e}")
        raise HTTPException(status_code=499, detail="Processing interrupted by user")
    except Exception as e:
        print(f"[ERROR] Blur processing failed: {e}")
        # Clean up temporary files
        try:
            os.unlink(in_path)
            if os.path.exists(out_path):
                os.unlink(out_path)
        except Exception as cleanup_error:
            print(f"[WARNING] Failed to clean up files after error: {cleanup_error}")
        raise HTTPException(status_code=500, detail=str(e))

    # 4) Upload to Supabase storage
    video_url = None
    try:
        video_url = supabase_manager.upload_video_to_storage(
            str(out_path), 
            file_name=f"blurred_{uuid.uuid4().hex}{suffix}"
        )
        print(f"[INFO] Blurred video uploaded to Supabase: {video_url}")
    except Exception as e:
        print(f"[WARNING] Failed to upload blurred video to Supabase: {e}")
        # Fallback to local file
        video_url = f"/videos/{out_name}"

    # 5) Clean up temporary files
    try:
        os.unlink(in_path)
        os.unlink(out_path)
    except Exception as e:
        print(f"[WARNING] Failed to clean up temporary files: {e}")

    # 4) respond with a JSON pointer, not the file contents
    return {
        "status": "done",
        "video_url": video_url
    }

@app.get("/plot/status_by_type")
def get_status_by_type():
    buf = plot.plot_status_by_type()
    return StreamingResponse(buf, media_type="image/png")

@app.get("/plot/compliance_pie")
def get_compliance_pie():
    buf = plot.plot_compliance_pie()
    return StreamingResponse(buf, media_type="image/png")

@app.get("/plot/reaction_time_hist")
def get_reaction_time_hist():
    buf = plot.plot_reaction_time_hist()
    return StreamingResponse(buf, media_type="image/png")

@app.get("/plot/vehicle_count")
def get_vehicle_count():
    buf = plot.plot_vehicle_count()
    return StreamingResponse(buf, media_type="image/png")

@app.get("/test-db/")
async def test_database():
    """Test endpoint to check database connectivity and current data"""
    try:
        # Test vehicle_counts table
        print("[TEST] Testing vehicle_counts table...")
        supabase_manager.test_vehicle_counts_table()
        
        # Get current data
        tracking_data = supabase_manager.get_tracking_data(limit=5)
        vehicle_counts = supabase_manager.get_vehicle_counts(limit=5)
        
        return {
            "status": "success",
            "tracking_data_count": len(tracking_data),
            "vehicle_counts_count": len(vehicle_counts),
            "tracking_data": tracking_data,
            "vehicle_counts": vehicle_counts
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

@app.post("/shutdown/")
async def shutdown_processing():
    """Stop any ongoing video processing"""
    try:
        set_shutdown_flag()
        print("[API] Shutdown requested via HTTP endpoint")
        return {"status": "shutdown_requested", "message": "Processing will stop gracefully"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.get("/status/")
async def get_processing_status():
    """Check if processing is currently active"""
    try:
        is_shutdown_requested = check_shutdown()
        return {
            "processing_active": not is_shutdown_requested,
            "shutdown_requested": is_shutdown_requested
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}
