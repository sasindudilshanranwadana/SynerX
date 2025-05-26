import cv2
import glob
import os
from ultralytics import YOLO

# ========== CONFIGURATION ==========
MODEL_PATH = 'model/best.pt'
INPUT_DIR = 'videos'
OUTPUT_DIR = 'output'
BLUR_KERNEL_SIZE = (23, 23)
BLUR_SIGMA = 30
BOX_COLOR = (0, 255, 255)      # Yellow (BGR)
BOX_BORDER_COLOR = (0, 0, 0)   # Black
BOX_THICKNESS = 2
BOX_BORDER_THICKNESS = 4

# ========== LOAD MODEL ==========
print(f" ✅Loading YOLOv8 model from '{MODEL_PATH}'...")
model = YOLO(MODEL_PATH)
print("✅ Model loaded successfully.\n")

# ========== CREATE OUTPUT FOLDER ==========
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ========== FUNCTION TO PROCESS EACH VIDEO ==========
def blur_license_plates(video_path, output_path, model):
    print(f"🎬 Starting video: {os.path.basename(video_path)}")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"❌ Error: Cannot open {video_path}")
        return

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    frame_count = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frame_count += 1

        results = model(frame)[0]

        for det in results.boxes:
            x1, y1, x2, y2 = map(int, det.xyxy[0])

            # Blur the detected region
            roi = frame[y1:y2, x1:x2]
            if roi.size > 0:
                blurred_roi = cv2.GaussianBlur(roi, BLUR_KERNEL_SIZE, BLUR_SIGMA)
                frame[y1:y2, x1:x2] = blurred_roi

            # Draw black border (thicker)
            cv2.rectangle(frame, (x1, y1), (x2, y2), BOX_BORDER_COLOR, BOX_BORDER_THICKNESS)

            # Draw yellow rectangle on top
            cv2.rectangle(frame, (x1, y1), (x2, y2), BOX_COLOR, BOX_THICKNESS)

        out.write(frame)

    cap.release()
    out.release()
    print(f"✅ Finished: {video_path} -> {output_path} ({frame_count} frames processed)\n")

# ========== PROCESS ALL VIDEOS ==========
def process_all_videos(input_folder, output_folder, model):
    video_files = glob.glob(os.path.join(input_folder, '*.mp4'))

    if not video_files:
        print("⚠️ No MP4 files found in 'videos' directory.")
        return

    print(f"🔍 Found {len(video_files)} video(s) in '{input_folder}'...\n")

    for video_file in video_files:
        base_name = os.path.basename(video_file)
        output_file = os.path.join(output_folder, f"blurred_{base_name}")
        blur_license_plates(video_file, output_file, model)

    print("✅ All videos processed successfully.")

# ========== MAIN ==========
if __name__ == "__main__":
    process_all_videos(INPUT_DIR, OUTPUT_DIR, model)
