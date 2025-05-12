from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import shutil
import uuid
import os
import requests
from main import main, OUTPUT_CSV_PATH, COUNT_CSV_PATH

app = FastAPI()

@app.post("/process")
async def process_video(request: Request):
    data = await request.json()
    video_url = data.get("video_url")
    video_id = data.get("video_id")

    if not video_url or not video_id:
        return JSONResponse(content={"error": "Missing video_url or video_id"}, status_code=400)

    video_filename = f"{uuid.uuid4().hex}.mp4"
    with requests.get(video_url, stream=True) as r:
        with open(video_filename, 'wb') as f:
            shutil.copyfileobj(r.raw, f)

    output_filename = f"output_{uuid.uuid4().hex}.mp4"
    main(video_filename, output_filename)

    with open(OUTPUT_CSV_PATH, 'r') as f1, open(COUNT_CSV_PATH, 'r') as f2:
        tracking_data = f1.read()
        count_data = f2.read()

    return {
        "video_id": video_id,
        "status": "processed",
        "tracking_results": tracking_data,
        "vehicle_counts": count_data
    }
