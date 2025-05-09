from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import shutil
import os
from main import main, OUTPUT_CSV_PATH, COUNT_CSV_PATH, VIDEO_PATH, OUTPUT_VIDEO_PATH
import videosample

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

@app.post("/blur")
async def run_videosample(file: UploadFile = File(...)):
    try:
        # Define paths for saving and processing the uploaded file
        uploaded_video_path = f"temp_{file.filename}"
        processed_video_path = f"processed_{file.filename}"
        
        # Save the uploaded video
        with open(uploaded_video_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Call the process_video function from videosample
        result = videosample.process_video(
            video_path=uploaded_video_path,
            output_video=processed_video_path
        )

        # Clean up the uploaded video
        os.remove(uploaded_video_path)

        # Return the result along with the processed video path
        return {
            "message": result["message"],
            "processed_video": processed_video_path
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
