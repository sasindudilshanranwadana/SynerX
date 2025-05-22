from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import shutil
from pathlib import Path
import os, tempfile, uuid
from pydantic import BaseModel
import requests
from fastapi.middleware.cors import CORSMiddleware
from main import main, OUTPUT_CSV_PATH, COUNT_CSV_PATH
from blur_core import process_video as blur_plates_yolo
from fastapi.staticfiles import StaticFiles
from fastapi.concurrency import run_in_threadpool

# Setup
OUTPUT_DIR = Path("processed")
OUTPUT_DIR.mkdir(exist_ok=True)

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with frontend domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve processed videos
app.mount("/videos", StaticFiles(directory=OUTPUT_DIR), name="videos")

# Request model
class VideoInput(BaseModel):
    upload_id: str
    video_url: str

# Health check route
@app.get("/")
async def root():
    return {"message": "API is running."}

@app.post("/upload-video", include_in_schema=True)
async def upload_video_from_url(data: VideoInput):
    try:
        print(f"[DEBUG] Received request: upload_id={data.upload_id}, video_url={data.video_url}")

        # Step 1: Download video from URL
        response = requests.get(data.video_url, stream=True)
        if response.status_code != 200:
            print("[ERROR] Failed to download video from URL.")
            raise HTTPException(status_code=400, detail="Failed to download video.")

        suffix = ".mp4"
        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        for chunk in response.iter_content(chunk_size=8192):
            tmp_file.write(chunk)
        tmp_file.close()
        raw_path = Path(tmp_file.name)
        print(f"[INFO] Downloaded video to: {raw_path}")

        # Step 2: Blur license plates
        blur_path = OUTPUT_DIR / f"{uuid.uuid4().hex}_blur{suffix}"
        print(f"[INFO] Blurring video to: {blur_path}")
        await run_in_threadpool(
            blur_plates_yolo,
            video_path=str(raw_path),
            output_video=str(blur_path),
            save_frames=False,
            stride=1,
        )

        # Step 3: Run analytics
        analytic_path = OUTPUT_DIR / f"{uuid.uuid4().hex}_out{suffix}"
        print(f"[INFO] Running analytics on: {blur_path}")
        await run_in_threadpool(main, str(blur_path), str(analytic_path))

        # Step 4: Read CSV results
        with open(OUTPUT_CSV_PATH) as f:
            tracking_csv = f.read()
        with open(COUNT_CSV_PATH) as f:
            counts_csv = f.read()

        print(f"[SUCCESS] Processing completed.")

        return {
            "status": "done",
            "blurred_video": f"/videos/{blur_path.name}",
            "analytic_video": f"/videos/{analytic_path.name}",
            "tracking": tracking_csv,
            "vehicle_counts": counts_csv
        }

    except Exception as e:
        print("[ERROR] Exception in /upload-video")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Get previous CSV results
@app.get("/get-results/")
async def get_results():
    if not os.path.exists(OUTPUT_CSV_PATH) or not os.path.exists(COUNT_CSV_PATH):
        return JSONResponse(content={"error": "No results available."})

    with open(OUTPUT_CSV_PATH, "r") as f:
        tracking_results = f.read()
    with open(COUNT_CSV_PATH, "r") as f:
        count_results = f.read()

    return JSONResponse(content={
        "tracking_results": tracking_results,
        "vehicle_counts": count_results
    })

# Blur endpoint for direct uploads
@app.post("/blur/")
async def blur_video(
    file: UploadFile = File(...),
    stride: int = 1,
    save_frames: bool = False
):
    try:
        suffix = Path(file.filename).suffix or ".mp4"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_in:
            shutil.copyfileobj(file.file, tmp_in)
            in_path = Path(tmp_in.name)

        out_name = f"{uuid.uuid4().hex}{suffix}"
        out_path = OUTPUT_DIR / out_name

        await run_in_threadpool(
            blur_plates_yolo,
            video_path=str(in_path),
            output_video=str(out_path),
            save_frames=save_frames,
            stride=max(1, stride),
        )

        return {
            "status": "done",
            "video_url": f"/videos/{out_name}"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
