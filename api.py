from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import shutil
from pathlib import Path
import os, tempfile, uuid
from pydantic import BaseModel
import requests
from fastapi.middleware.cors import CORSMiddleware
from main import main, OUTPUT_CSV_PATH, COUNT_CSV_PATH, VIDEO_PATH, OUTPUT_VIDEO_PATH
from blur_core import process_video as blur_plates_yolo
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from fastapi.concurrency import run_in_threadpool

OUTPUT_DIR = Path("processed")
OUTPUT_DIR.mkdir(exist_ok=True)

app = FastAPI()

# ✅ Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You can restrict this to your frontend domain later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/videos", StaticFiles(directory=OUTPUT_DIR), name="videos")

class VideoInput(BaseModel):
    upload_id: str
    video_url: str

@app.post("/upload-video" , include_in_schema=True)
async def upload_video_from_url(data: VideoInput):
    try:
        # 1. Download video from Supabase public URL
        response = requests.get(data.video_url, stream=True)
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to download video from Supabase URL.")

        suffix = ".mp4"
        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        for chunk in response.iter_content(chunk_size=8192):
            tmp_file.write(chunk)
        tmp_file.close()
        raw_path = Path(tmp_file.name)

        # 2. Blur it into processed/
        blur_path = OUTPUT_DIR / f"{uuid.uuid4().hex}_blur{suffix}"
        await run_in_threadpool(
            blur_plates_yolo,
            video_path=str(raw_path),
            output_video=str(blur_path),
            save_frames=False,
            stride=1,
        )

        # 3. Run analytics into another file
        analytic_path = OUTPUT_DIR / f"{uuid.uuid4().hex}_out{suffix}"
        await run_in_threadpool(
            main,
            str(blur_path),
            str(analytic_path)
        )

        # 4. Read CSVs
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


@app.get("/get-results/")
async def get_results():
    # Return results from the CSV files
    if not os.path.exists(OUTPUT_CSV_PATH) or not os.path.exists(COUNT_CSV_PATH):
        return JSONResponse(content={"error": "No results available. Process a video first."})

    with open(OUTPUT_CSV_PATH, "r") as csvfile:
        tracking_results = csvfile.read()
    with open(COUNT_CSV_PATH, "r") as countfile:
        count_results = countfile.read()

    return JSONResponse(content={"tracking_results": tracking_results, "vehicle_counts": count_results})

@app.post("/blur/")
async def blur_video(
    file: UploadFile = File(...),
    stride: int = 1,
    save_frames: bool = False
):
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
            blur_plates_yolo,
            video_path=str(in_path),
            output_video=str(out_path),
            save_frames=save_frames,
            stride=max(1, stride),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # 4) respond with a JSON pointer, not the file contents
    return {
        "status": "done",
        "video_url": f"/videos/{out_name}"
    }
