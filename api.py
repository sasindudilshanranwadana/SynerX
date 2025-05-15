from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import requests
import os
from blur_core import process_video
from supabase import create_client
from pathlib import Path

# Load Supabase credentials from environment
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "processed")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# FastAPI app setup
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/process")
async def process_video_from_url(request: Request):
    data = await request.json()
    video_url = data.get("video_url")
    upload_id = data.get("upload_id", "default")

    if not video_url:
        return {"status": "failed", "error": "Missing video_url"}

    try:
        # 1. Download video
        os.makedirs("./asset", exist_ok=True)
        local_input = f"./asset/{upload_id}.mp4"
        response = requests.get(video_url, stream=True)
        with open(local_input, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        # 2. Run your model
        process_video(local_input)

        # 3. Upload results to Supabase
        public_urls = upload_results_to_supabase(upload_id)

        # 4. Update DB
        supabase.from_("video_uploads").update({
            "status": "completed",
            "result_video_url": public_urls.get("video"),
            "result_csv_url": public_urls.get("csv")
        }).eq("id", upload_id).execute()

        return {"status": "completed", "urls": public_urls}

    except Exception as e:
        print("Processing error:", str(e))
        supabase.from_("video_uploads").update({
            "status": "failed",
            "error": str(e)
        }).eq("id", upload_id).execute()
        return {"status": "failed", "error": str(e)}


def upload_results_to_supabase(upload_id: str) -> dict:
    public_urls = {}
    output_files = {
        "video": f"./asset/{upload_id}_processed.mp4",
        "csv": f"./asset/{upload_id}_tracking.csv"
    }

    for key, local_path in output_files.items():
        if Path(local_path).exists():
            remote_path = f"{upload_id}/{Path(local_path).name}"
            with open(local_path, "rb") as f:
                supabase.storage.from_(SUPABASE_BUCKET).upload(remote_path, f, {"content-type": get_mime_type(local_path)})
            public_url = supabase.storage.from_(SUPABASE_BUCKET).get_public_url(remote_path).public_url
            public_urls[key] = public_url

    return public_urls


def get_mime_type(filename: str) -> str:
    if filename.endswith(".mp4"):
        return "video/mp4"
    elif filename.endswith(".csv"):
        return "text/csv"
    return "application/octet-stream"
