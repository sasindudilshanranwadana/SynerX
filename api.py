from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
import shutil
import os
from main import main, OUTPUT_CSV_PATH, COUNT_CSV_PATH, VIDEO_PATH, OUTPUT_VIDEO_PATH

app = FastAPI()

@app.post("/upload-video/")
async def upload_video(file: UploadFile = File(...)):
    # Save the uploaded video
    with open(VIDEO_PATH, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Process the video
    result = main(VIDEO_PATH, OUTPUT_VIDEO_PATH)
    return JSONResponse(content={"Video": "Video processed successfully."})

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
