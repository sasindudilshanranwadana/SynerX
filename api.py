from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

import shutil, os, tempfile, uuid, requests
from pathlib import Path

from main import main, OUTPUT_CSV_PATH, COUNT_CSV_PATH
from blur_core import process_video as blur_plates_yolo

# === Output storage ===
OUTPUT_DIR = Path("processed")
OUTPUT_DIR.mkdir(exist_ok=True)

app = FastAPI()

# === CORS fix ===
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, replace with your frontend domain(s)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Static file serving ===
app.mount("/videos", StaticFiles(directory=OUTPUT_DIR), name="videos")

# === Input schema for old (Supabase) endpoint ===
class VideoInput(BaseModel):
    upload_id: str
    video_url: str

# === NEW: Main video file upload endpoint ===
@app.post("/upload-video/")
async def upload_video(file: UploadFile = File(...)):
    try:
        # 1. Save uploaded file to disk
        file_id = uuid.uuid4().hex
        suffix = Path(file.filename).suffix or ".mp4"
        raw_path = OUTPUT_DIR / f"{file_id}_raw{suffix}"

        with open(raw_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 2. Plate blurring
        blur_path = OUTPUT_DIR / f"{file_id}_blur{suffix}"
        await run_in_threadpool(blur_plates_yolo, str(raw_path), str(blur_path), save_frames=False, stride=1)

        # 3. Analytics
        analytic_path = OUTPUT_DIR / f"{file_id}_out{suffix}"
        await run_in_threadpool(main, str(blur_path), str(analytic_path))

        # 4. Read CSV results
        with open(OUTPUT_CSV_PATH) as f:
            tracking_csv = f.read()
        with open(COUNT_CSV_PATH) as f:
            counts_csv = f.read()

        return {
            "status": "done",
            "blurred_video": f"/videos/{blur_path.name}",
            "analytic_video": f"/videos/{analytic_path.name}",
            "tracking": tracking_csv,
            "vehicle_counts": counts_csv
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# === (Optional) Existing: URL-to-video pipeline endpoint ===
@app.post("/upload-video")
async def upload_video_from_url(data: VideoInput):
    try:
        # 1. Download from public URL
        response = requests.get(data.video_url, stream=True)
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to download video")

        suffix = ".mp4"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_in:
            for chunk in response.iter_content(chunk_size=8192):
                tmp_in.write(chunk)
        raw_path = Path(tmp_in.name)

        # 2. Plate blurring
        blur_path = OUTPUT_DIR / f"{uuid.uuid4().hex}_blur{suffix}"
        await run_in_threadpool(blur_plates_yolo, str(raw_path), str(blur_path), save_frames=False, stride=1)

        # 3. Analytics
        analytic_path = OUTPUT_DIR / f"{uuid.uuid4().hex}_out{suffix}"
        await run_in_threadpool(main, str(blur_path), str(analytic_path))

        # 4. Read CSV results
        with open(OUTPUT_CSV_PATH) as f:
            tracking_csv = f.read()
        with open(COUNT_CSV_PATH) as f:
            counts_csv = f.read()

        return {
            "status": "done",
            "blurred_video": f"/videos/{blur_path.name}",
            "analytic_video": f"/videos/{analytic_path.name}",
            "tracking": tracking_csv,
            "vehicle_counts": counts_csv
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# === Test route ===
@app.get("/")
async def root():
    return {"message": "Backend is up and running!"}
