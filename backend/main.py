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

# Enhanced graceful shutdown handler - now handled by shutdown_manager
shutdown_manager.setup_signal_handlers()

# Add cleanup handlers for graceful shutdown
def cleanup_video_streamer():
    """Cleanup video streamer on shutdown"""
    try:
        if hasattr(video_streamer, 'stop_streaming'):
            video_streamer.stop_streaming()
        print("✅ Video streamer cleaned up")
    except Exception as e:
        print(f"⚠️ Video streamer cleanup failed: {e}")

def cleanup_temp_files():
    """Cleanup temporary files on shutdown"""
    try:
        # Clean up any temporary files in processed directory
        import glob
        temp_files = glob.glob(str(OUTPUT_DIR / "*.tmp"))
        for temp_file in temp_files:
            try:
                os.unlink(temp_file)
                print(f"✅ Cleaned up temp file: {temp_file}")
            except:
                pass
    except Exception as e:
        print(f"⚠️ Temp file cleanup failed: {e}")

# Register cleanup handlers
shutdown_manager.add_cleanup_handler(cleanup_video_streamer)
shutdown_manager.add_cleanup_handler(cleanup_temp_files)

def check_api_shutdown():
    """Check if API shutdown has been requested"""
    global api_shutdown_requested
    with api_shutdown_lock:
        return api_shutdown_requested

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

    # 2. run analytics using main.py
    analytic_path = OUTPUT_DIR / f"{uuid.uuid4().hex}_out{suffix}"
    print(f"[UPLOAD] Step 3: Running analytics to {analytic_path}")
    
    session_data = None
    try:
        session_data = await run_in_threadpool(
            main,                   # your analytics
            str(raw_path),          # input video (original)
            str(analytic_path),     # processed output
            "api"                   # API mode - save to database only
        )
        print(f"[UPLOAD] Step 4: Analytics done: {analytic_path}")
    except KeyboardInterrupt:
        processing_time = get_processing_time()
        print(f"[UPLOAD] Processing interrupted by user (Ctrl+C) after {processing_time:.2f} seconds")
        # Clean up temporary files
        try:
            os.unlink(raw_path)
            if os.path.exists(analytic_path):
                os.unlink(analytic_path)
        except Exception as e:
            print(f"[WARNING] Failed to clean up files after interrupt: {e}")
        raise HTTPException(status_code=499, detail=f"Processing interrupted by user after {processing_time:.2f} seconds")
    except Exception as e:
        processing_time = get_processing_time()
        print(f"[ERROR] Processing failed after {processing_time:.2f} seconds: {e}")
        # Clean up temporary files
        try:
            os.unlink(raw_path)
            if os.path.exists(analytic_path):
                os.unlink(analytic_path)
        except Exception as cleanup_error:
            print(f"[WARNING] Failed to clean up files after error: {cleanup_error}")
        raise HTTPException(status_code=500, detail=f"Processing failed after {processing_time:.2f} seconds: {str(e)}")

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

    # 4. Use session data from video processing
    tracking_data = []
    vehicle_counts = []
    print("[UPLOAD] Step 7: Using session data from video processing...")
    
    if session_data:
        tracking_data = session_data.get("tracking_data", [])
        vehicle_counts = session_data.get("vehicle_counts", [])
        print(f"[UPLOAD] Step 8: Got {len(tracking_data)} session tracking records and {len(vehicle_counts)} session vehicle counts.")
    else:
        print("[UPLOAD] Step 8: No session data available, using fallback...")
        # Fallback to getting all data from database
        try:
            tracking_data = supabase_manager.get_tracking_data(limit=1000)
            vehicle_counts = supabase_manager.get_vehicle_counts(limit=1000)
            print(f"[UPLOAD] Step 8: Fallback - Got {len(tracking_data)} tracking records and {len(vehicle_counts)} vehicle counts.")
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
    total_processing_time = get_processing_time()
    
    # Use session data for statistics
    if session_data:
        session_tracking_data = session_data.get("tracking_data", [])
        session_vehicle_counts = session_data.get("vehicle_counts", [])
        total_vehicles = len(session_tracking_data)
        compliance_count = sum(1 for item in session_tracking_data if isinstance(item, dict) and item.get('compliance') == 1)
        compliance_rate = (compliance_count / total_vehicles * 100) if total_vehicles > 0 else 0
        print(f"[UPLOAD] Step 9: Session processing stats calculated. Time: {processing_time:.2f}s, Total Time: {total_processing_time:.2f}s, Vehicles: {total_vehicles}, Compliance: {compliance_rate:.2f}%")
    else:
        # Fallback to all data
        total_vehicles = len(tracking_data) if isinstance(tracking_data, list) else 0
        compliance_count = sum(1 for item in tracking_data if isinstance(item, dict) and item.get('compliance') == 1)
        compliance_rate = (compliance_count / total_vehicles * 100) if total_vehicles > 0 else 0
        print(f"[UPLOAD] Step 9: Processing stats calculated. Time: {processing_time:.2f}s, Total Time: {total_processing_time:.2f}s, Vehicles: {total_vehicles}, Compliance: {compliance_rate:.2f}%")

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
            "processing_time": processing_time,
            "total_processing_time": total_processing_time
        }
    }

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
    """Stop any ongoing video processing gracefully"""
    try:
        processing_time = get_processing_time()
        shutdown_manager.set_shutdown_flag()
        print(f"[API] Graceful shutdown requested via HTTP endpoint after {processing_time:.2f} seconds of processing")
        return {
            "status": "shutdown_requested", 
            "message": "Processing will stop gracefully",
            "processing_time": processing_time
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.post("/force-shutdown/")
async def force_shutdown():
    """Force shutdown - kill all processes immediately"""
    try:
        processing_time = get_processing_time()
        print(f"[API] Force shutdown requested via HTTP endpoint after {processing_time:.2f} seconds of processing")
        
        # Run force shutdown in a separate thread to avoid blocking
        import threading
        def force_shutdown_async():
            time.sleep(0.5)  # Small delay to allow response to be sent
            shutdown_manager.force_shutdown()
        
        threading.Thread(target=force_shutdown_async, daemon=True).start()
        
        return {
            "status": "force_shutdown_requested", 
            "message": "All processes will be forcefully terminated",
            "processing_time": processing_time
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
