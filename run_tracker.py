import os
import requests
from supabase import create_client
from blur_core import blur_plates_yolo
from main import main
import shutil
import cv2
import numpy as np

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("🔍 Checking for pending videos...")

video = supabase.table("video_uploads").select("*").eq("status", "pending").limit(1).execute()

if not video.data:
    print("🟡 No pending videos found.")
    exit()

video_id = video.data[0]["id"]
file_name = video.data[0]["file_name"]
base_name = os.path.splitext(file_name)[0]
public_url = f"{SUPABASE_URL}/storage/v1/object/public/videos/{file_name}"

print(f"🎬 Found video: {file_name}")
supabase.table("video_uploads").update({"status": "processing"}).eq("id", video_id).execute()

input_path = "input.mp4"
print("⬇️ Downloading video...")
with open(input_path, "wb") as f:
    f.write(requests.get(public_url).content)

# 1. Blur plates
blurred_path = f"asset/{base_name}_blurred.mp4"
print("🌀 Blurring license plates...")
blur_plates_yolo(video_path=input_path, output_video=blurred_path)

# 2. Tracking + blur only
output_blur_only = f"asset/{base_name}_tracking_blur.mp4"
print("🎯 Running tracking model...")
main(blurred_path, output_blur_only)

# 3. Heatmap-only video
frame = cv2.imread("asset/heatmap_overlay.png")
if frame is not None:
    h, w, _ = frame.shape
    print("🔥 Generating heatmap-only video...")
    heatmap_vid = cv2.VideoWriter(f"asset/{base_name}_heatmap_only.mp4", cv2.VideoWriter_fourcc(*'mp4v'), 10, (w, h))
    for _ in range(100):
        heatmap_vid.write(frame)
    heatmap_vid.release()

# 4. Combined tracking + blur + heatmap overlay
overlay_img = cv2.imread("asset/heatmap_overlay.png")
if overlay_img is not None:
    print("🎞️ Generating tracking+heatmap overlay video...")
    cap = cv2.VideoCapture(output_blur_only)
    w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    out_combined = cv2.VideoWriter(f"asset/{base_name}_tracking_blur_heatmap.mp4", cv2.VideoWriter_fourcc(*'mp4v'), fps, (w, h))
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        overlay_resized = cv2.resize(overlay_img, (w, h))
        combined = cv2.addWeighted(frame, 0.6, overlay_resized, 0.4, 0)
        out_combined.write(combined)
    cap.release()
    out_combined.release()

def upload(path, target, mime):
    print(f"📤 Uploading {target}...")
    with open(path, "rb") as f:
        supabase.storage().from_("videos").upload(target, f, {"content-type": mime})

folder = f"processed/{video_id}"
upload(output_blur_only, f"{folder}/{base_name}_tracking_blur.mp4", "video/mp4")
upload(f"asset/{base_name}_tracking_blur_heatmap.mp4", f"{folder}/{base_name}_tracking_blur_heatmap.mp4", "video/mp4")
upload(f"asset/{base_name}_heatmap_only.mp4", f"{folder}/{base_name}_heatmap_only.mp4", "video/mp4")
upload("asset/tracking_results.csv", f"{folder}/tracking_results.csv", "text/csv")
upload("asset/vehicle_count.csv", f"{folder}/vehicle_count.csv", "text/csv")

supabase.table("video_uploads").update({"status": "completed", "progress": 100}).eq("id", video_id).execute()
print("✅ Processing complete and results uploaded.")

# Optional cleanup
paths_to_delete = [
    input_path,
    blurred_path,
    output_blur_only,
    f"asset/{base_name}_tracking_blur_heatmap.mp4",
    f"asset/{base_name}_heatmap_only.mp4",
    "asset/tracking_results.csv",
    "asset/vehicle_count.csv",
    "asset/heatmap.png",
    "asset/heatmap_overlay.png"
]

for p in paths_to_delete:
    try:
        os.remove(p)
    except FileNotFoundError:
        pass

print("🧹 Cleanup done.")
