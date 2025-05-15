from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.concurrency import run_in_threadpool
from pathlib import Path
import shutil
import tempfile
import uuid
import os
import requests

from main import main, OUTPUT_CSV_PATH, COUNT_CSV_PATH, VIDEO_PATH, OUTPUT_VIDEO_PATH
from blur_core import blur_plates_yolo

# Supabase client
from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

OUTPUT_DIR = Path("processed")
OUTPUT_DIR.mkdir(exist_ok=True)

app = FastAPI()
app.mount("/videos", StaticFiles(directory=OUTPUT_DIR), name="videos")

def upload_to_supabase(local_path: Path, remote_path: str) -> str:
    with open(local_path, "rb") as f:
        supabase.storage.from_("processed").upload(remote_path, f, file_options={"content-type": "video/mp4", "upsert": True})
    public_url = supabase.storage.from_("processed").get_public_url(remote_path)
    return public_url

@app.post("/upload-video/")
async def upload_video(
    file: UploadFile = File(...),
    stride: int = 1,
    save_frames: bool = False
):
    suffix = Path(file.filename).suffix or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_in:
        shutil.copyfileobj(file.file, tmp_in)
        raw_path = Path(tmp_in.name)

    blur_path = OUTPUT_DIR / f"{uuid.uuid4().hex}_blur{suffix}"
    await run_in_threadpool(
        blur_plates_yolo,
        video_path=str(raw_path),
        output_video=str(blur_path),
        save_frames=save_frames,
        stride=max(1, stride),
    )

    analytic_path = OUTPUT_DIR / f"{uuid.uuid4().hex}_out{suffix}"
    await run_in_threadpool(
        main,
        str(blur_path),
        str(analytic_path)
    )

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

@app.get("/get-results/")
async def get_results():
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
    suffix = Path(file.filename).suffix or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_in:
        shutil.copyfileobj(file.file, tmp_in)
        in_path = Path(tmp_in.name)

    out_name = f"{uuid.uuid4().hex}{suffix}"
    out_path = OUTPUT_DIR / out_name

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

    return {
        "status": "done",
        "video_url": f"/videos/{out_name}"
    }

@app.post("/process")
async def process_from_url(request: Request):
    body = await request.json()
    video_url = body.get("video_url")
    video_id = body.get("video_id")

    if not video_url or not video_id:
        raise HTTPException(status_code=400, detail="Missing video_url or video_id")

    suffix = ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
        response = requests.get(video_url, stream=True)
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to download video")
        for chunk in response.iter_content(chunk_size=8192):
            tmp_file.write(chunk)
        raw_path = Path(tmp_file.name)

    blur_path = OUTPUT_DIR / f"{uuid.uuid4().hex}_blur{suffix}"
    analytic_path = OUTPUT_DIR / f"{uuid.uuid4().hex}_out{suffix}"

    blur_plates_yolo(str(raw_path), str(blur_path), save_frames=False, stride=1)
    main(str(blur_path), str(analytic_path))

    try:
        with open(OUTPUT_CSV_PATH) as f1, open(COUNT_CSV_PATH) as f2:
            # Upload processed video
            remote_path = f"results/{analytic_path.name}"
            supabase_url = upload_to_supabase(analytic_path, remote_path)

            return {
                "status": "done",
                "supabase_video_url": supabase_url,
                "tracking_results": f1.read(),
                "vehicle_counts": f2.read()
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSV read error: {e}")
