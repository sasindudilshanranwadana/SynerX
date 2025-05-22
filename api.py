from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
import shutil
import os
import tempfile
import uuid
import requests
import traceback
from pathlib import Path

from main import main, OUTPUT_CSV_PATH, COUNT_CSV_PATH
from blur_core import process_video as blur_plates_yolo

import logging
logging.basicConfig(level=logging.INFO)

# Setup
OUTPUT_DIR = Path("processed")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI()

# ✅ CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for specific frontend domain if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/videos", StaticFiles(directory=OUTPUT_DIR), name="videos")

# ✅ Input model
class VideoInput(BaseModel):
    upload_id: str
    video_url: str

# ✅ Upload & process endpoint
@app.post("/upload-video", include_in_schema=True)
async def upload_video_from_url(data: VideoInput):
    try:
        # 1. Download video
        response = requests.get(data.video_url, stream=True)
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to download video from Supabase URL.")
        
        suffix = ".mp4"
        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        for chunk in response.iter_content(chunk_size=8192):
            tmp_file.write(chunk)
        tmp_file.close()
        raw_path = Path(tmp_file.name)

        # 2. Blur
        blur_path = OUTPUT_DIR / f"{uuid.uuid4().hex}_blur{suffix}"
        await run_in_threadpool(
            blur_plates_yolo,
            video_path=str(raw_path),
            output_video=str(blur_path),
            save_frames=False,
            stride=1,
        )

        # 3. Analytics
        analytic_path = OUTPUT_DIR / f"{uuid.uuid4().hex}_out{suffix}"
        await run_in_threadpool(
            main,
            str(blur_path),
            str(analytic_path)
        )

        # 4. Read results safely
        if not OUTPUT_CSV_PATH.exists() or not COUNT_CSV_PATH.exists():
            raise HTTPException(status_code=500, detail="Result CSV files not found")

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
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ✅ Get CSV results
@app.get("/get-results/")
async def get_results():
    if not OUTPUT_CSV_PATH.exists() or not COUNT_CSV_PATH.exists():
        return JSONResponse(content={"error": "No results available. Process a video first."})

    with open(OUTPUT_CSV_PATH, "r") as csvfile:
        tracking_results = csvfile.read()
    with open(COUNT_CSV_PATH, "r") as countfile:
        count_results = countfile.read()

    return JSONResponse(content={"tracking_results": tracking_results, "vehicle_counts": count_results})


# ✅ Direct blur only (optional tool)
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
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
