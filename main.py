import cv2
import numpy as np
import time
from collections import defaultdict, Counter, deque
from ultralytics import YOLO
import supervision as sv
import csv
import os
from datetime import datetime  # Add import for datetime


from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import requests
import shutil
from supabase import create_client

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
   allow_origins=["https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3--5173--local-credentialless.webcontainer-api.io"],
  # Or specify your frontend URL for security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

from fastapi.responses import JSONResponse

@app.post("/")
async def trigger_processing(req: Request):
    try:
        data = await req.json()
        upload_id = data.get("upload_id")
        video_url = data.get("video_url")

        print(f"📦 Received request: upload_id={upload_id}, video_url={video_url}")

        if not upload_id or not video_url:
            print("❌ Missing required fields.")
            return JSONResponse(status_code=400, content={"error": "Missing upload_id or video_url"})

        # Update DB status to 'processing'
        supabase.table("video_uploads").update({
            "status": "processing",
            "progress": 0
        }).eq("id", upload_id).execute()

        # Download the video
        os.makedirs("asset", exist_ok=True)
        input_path = f"./asset/{upload_id}_input.mp4"
        response = requests.get(video_url, stream=True)

        if response.status_code != 200:
            print("❌ Failed to download video.")
            raise Exception("Failed to download video")

        with open(input_path, "wb") as f:
            shutil.copyfileobj(response.raw, f)

        # Run processing
        print("🚀 Starting video processing...")
        output_video_path, output_csv_path = main(input_path, upload_id)

        # Upload processed results
        with open(output_video_path, "rb") as f:
            supabase.storage.from_("processed").upload(f"{upload_id}/processed.mp4", f, {
                "content-type": "video/mp4", "upsert": True
            })

        with open(output_csv_path, "rb") as f:
            supabase.storage.from_("processed").upload(f"{upload_id}/tracking.csv", f, {
                "content-type": "text/csv", "upsert": True
            })

        result_video_url = supabase.storage.from_("processed").get_public_url(f"{upload_id}/processed.mp4").data["publicUrl"]
        result_csv_url = supabase.storage.from_("processed").get_public_url(f"{upload_id}/tracking.csv").data["publicUrl"]

        supabase.table("video_uploads").update({
            "status": "completed",
            "progress": 100,
            "result_video_url": result_video_url,
            "result_csv_url": result_csv_url
        }).eq("id", upload_id).execute()

        print("✅ Processing complete. Returning URLs.")
        return JSONResponse(status_code=200, content={
            "success": True,
            "video_url": result_video_url,
            "csv_url": result_csv_url
        })

    except Exception as e:
        print(f"❌ Error in / route: {str(e)}")
        supabase.table("video_uploads").update({
            "status": "failed",
            "error": str(e)
        }).eq("id", upload_id).execute()

        return JSONResponse(status_code=500, content={"error": str(e)})


# ---------- CONFIGURATION ---------- #

VIDEO_PATH = './asset/videoplayback.mp4'
OUTPUT_VIDEO_PATH = './asset/TrackingWithStopResult.mp4'
OUTPUT_CSV_PATH = './asset/tracking_results.csv'
COUNT_CSV_PATH = './asset/vehicle_count.csv'
MODEL_PATH = 'yolo11n.pt'

SOURCE_POLYGON = np.array([
    (422, 10),   # Top-left
    (594, 16),   # Top-right
    (801, 665),  # Bottom-right
    (535, 649)   # Bottom-left
])

STOP_ZONE_POLYGON = np.array([(507, 199), (681, 209), (751, 555), (484, 541)])
TARGET_WIDTH, TARGET_HEIGHT = 50, 130
VELOCITY_THRESHOLD = 0.5 # Adjusted for normalized space (tune this value)
FRAME_BUFFER = 20

CLASS_NAMES = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck"
}

# Distance-based classification thresholds
# Y-coordinate threshold for correcting misclassified vehicles
DISTANCE_THRESHOLD = 300  # Adjust based on frame height

# ---------- CLASSES ---------- #

class ViewTransformer:
    def __init__(self, source: np.ndarray, target_size: tuple[int, int]):
        target = np.array([
            [0, 0],
            [target_size[0] - 1, 0],
            [target_size[0] - 1, target_size[1] - 1],
            [0, target_size[1] - 1]
        ], dtype=np.float32)
        self.m = cv2.getPerspectiveTransform(source.astype(np.float32), target)

    def transform(self, points: np.ndarray) -> np.ndarray:
        if points.size == 0:
            return points
        return cv2.perspectiveTransform(points.reshape(-1, 1, 2).astype(np.float32), self.m).reshape(-1, 2)

# ---------- HELPERS ---------- #

def point_inside_polygon(point, polygon):
    return cv2.pointPolygonTest(polygon.astype(np.float32), tuple(map(float, point)), False) >= 0

def initialize_csv(filepath, fieldnames, mode='a'):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    csvfile = open(filepath, mode=mode, newline='')
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    if mode == 'w':
        writer.writeheader()
    return csvfile, writer

def read_csv_to_dict(filepath):
    data = {}
    if os.path.exists(filepath):
        with open(filepath, mode='r', newline='') as file:
            reader = csv.DictReader(file)
            for row in reader:
                tracker_id = row['tracker_id']
                data[tracker_id] = row
    return data

def update_csv_files(output_path, count_path, history_dict, vehicle_counter):
    """Update CSV files with current tracking data"""
    try:
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")  # Get current date and time
        
        with open(output_path, 'w', newline='') as csv_update_file:
            update_writer = csv.DictWriter(csv_update_file, 
                fieldnames=["tracker_id", "vehicle_type", "status", "compliance", "reaction_time", "date"])
            update_writer.writeheader()
            for tid, data in history_dict.items():
                # Add date field to each record
                data_with_date = data.copy()
                if "date" not in data_with_date:
                    data_with_date["date"] = current_time
                update_writer.writerow(data_with_date)

        with open(count_path, 'w', newline='') as count_update_file:
            count_update_writer = csv.DictWriter(count_update_file, fieldnames=["vehicle_type", "count", "date"])
            count_update_writer.writeheader()
            for v_type, count in vehicle_counter.items():
                count_update_writer.writerow({
                    "vehicle_type": v_type, 
                    "count": count,
                    "date": current_time
                })
                
        return True
    except Exception as e:
        print(f"[WARNING] Failed to update CSV files: {e}")
        return False

def correct_vehicle_type(class_id, y_position, confidence=None):
    """
    Correct vehicle classification based on position in the frame
    Args:
        class_id: detected class ID
        y_position: y-coordinate of the vehicle in the frame
        confidence: detection confidence (optional)
    Returns:
        corrected class_id
    """
    # If the detected vehicle is a truck and it's close to the camera (higher y value)
    if class_id == 7 and y_position > DISTANCE_THRESHOLD:
        # More likely to be a car when close to the camera
        return 2  # Car class ID
    
    # If needed, add more corrections here
    return class_id  # Return original class if no correction needed

# ---------- MAIN ---------- #

def main(video_path, upload_id):
    output_video_path = f"./asset/{upload_id}_processed.mp4"
    global OUTPUT_CSV_PATH, COUNT_CSV_PATH
    OUTPUT_CSV_PATH = f"./asset/{upload_id}_tracking.csv"
    COUNT_CSV_PATH = f"./asset/{upload_id}_vehicle_count.csv"
    video_info = sv.VideoInfo.from_video_path(video_path)


    # ---------- HEAT-MAP INITIALISATION ----------
    W, H = video_info.resolution_wh
    heat_raw = np.zeros((H, W), dtype=np.float32)

    cap0 = cv2.VideoCapture(video_path)
    ok, first_frame = cap0.read()       # keep this!
    cap0.release()
    if not ok:
        raise RuntimeError("could not read first frame")

    KERNEL = cv2.getGaussianKernel(25, 7)
    KERNEL = (KERNEL @ KERNEL.T).astype(np.float32)
    kH, kW = KERNEL.shape
    # --------------------------------------------

    model = YOLO(MODEL_PATH)
    model.fuse()
    tracker = sv.ByteTrack(frame_rate=video_info.fps)
    frame_gen = sv.get_video_frames_generator(source_path=video_path)

    thickness = 1
    text_scale = 0.4
    annotators = {
        'box': sv.BoxAnnotator(thickness=thickness),
        'trace': sv.TraceAnnotator(thickness=thickness, trace_length=video_info.fps * 2, position=sv.Position.BOTTOM_CENTER),
        'label_top': sv.LabelAnnotator(text_scale=text_scale, text_thickness=1, text_position=sv.Position.TOP_LEFT),
        'label_bottom': sv.LabelAnnotator(text_scale=text_scale, text_thickness=1, text_position=sv.Position.BOTTOM_CENTER)
    }

    polygon_zone = sv.PolygonZone(polygon=SOURCE_POLYGON)
    stop_zone = sv.PolygonZone(polygon=STOP_ZONE_POLYGON)
    transformer = ViewTransformer(SOURCE_POLYGON, (TARGET_WIDTH, TARGET_HEIGHT))

    tracker_types = {}
    position_history = defaultdict(lambda: deque(maxlen=FRAME_BUFFER))
    status_cache = {}
    compliance_set = set()
    stop_zone_history = {}
    counted_ids = set()
    vehicle_type_counter = Counter()
    entry_times = {}
    reaction_times = {}
    
    # Track which vehicle records have been written to CSV
    written_records = set()  # Set of (tracker_id, status) tuples
    
    # New set to track vehicles that have been marked as stationary
    stationary_vehicles = set()
    
    stop_zone_history_dict = read_csv_to_dict(OUTPUT_CSV_PATH)
    
    # Check for previously marked stationary vehicles in existing CSV
    for track_id, data in stop_zone_history_dict.items():
        if data.get('status') == 'stationary':
            stationary_vehicles.add(int(track_id))
    
    # We'll handle file operations directly when needed
    if not os.path.exists(OUTPUT_CSV_PATH) or os.path.getsize(OUTPUT_CSV_PATH) == 0:
        with open(OUTPUT_CSV_PATH, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=["tracker_id", "vehicle_type", "status", "compliance", "reaction_time", "date"])
            writer.writeheader()
            
    if not os.path.exists(COUNT_CSV_PATH) or os.path.getsize(COUNT_CSV_PATH) == 0:
        with open(COUNT_CSV_PATH, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=["vehicle_type", "count", "date"])
            writer.writeheader()

    max_track_id = 0
    for tid in stop_zone_history_dict.keys():
        try:
            tid_int = int(tid)
            max_track_id = max(max_track_id, tid_int)
        except ValueError:
            continue

    tracker_id_offset = max_track_id
    if max_track_id > 0:
        print(f"[INFO] Continuing from tracker ID: {tracker_id_offset + 1}")

    frame_idx = 0
    start_time = time.time()
    prev_fps_time = start_time

    try:
        with sv.VideoSink(output_video_path, video_info) as sink:
            for frame in frame_gen:
                frame_idx += 1
                result = model(frame, verbose=False)[0]
                detections = sv.Detections.from_ultralytics(result)
                detections = detections[detections.confidence > 0.3]
                detections = detections[polygon_zone.trigger(detections)].with_nms(threshold=0.6)
                detections = tracker.update_with_detections(detections)

                # ---------- HEAT-MAP ACCUMULATION ----------
                for (x1, y1, x2, y2), conf in zip(detections.xyxy, detections.confidence):
                    cx, cy = int((x1 + x2) / 2), int((y1 + y2) / 2)   # bbox centre

                    # roi in heat_raw (clip at edges)
                    x0, x1p = max(0, cx - kW // 2), min(W, cx + kW // 2 + 1)
                    y0, y1p = max(0, cy - kH // 2), min(H, cy + kH // 2 + 1)

                    kx0, ky0 = x0 - (cx - kW // 2), y0 - (cy - kH // 2)
                    kx1, ky1 = kx0 + (x1p - x0),    ky0 + (y1p - y0)

                    heat_raw[y0:y1p, x0:x1p] += KERNEL[ky0:ky1, kx0:kx1] * conf
                # -------------------------------------------

                # Shift track IDs by offset
                detections.tracker_id = [tid + tracker_id_offset for tid in detections.tracker_id]

                anchor_pts = detections.get_anchors_coordinates(anchor=sv.Position.BOTTOM_CENTER)
                
                # Apply distance-based classification correction
                corrected_class_ids = []
                for i, (pt, class_id) in enumerate(zip(anchor_pts, detections.class_id)):
                    # Get y-coordinate (higher y = closer to camera)
                    y_pos = pt[1]
                    # Apply correction based on distance
                    corrected_class_id = correct_vehicle_type(class_id, y_pos, detections.confidence[i])
                    corrected_class_ids.append(corrected_class_id)
                
                # Update class IDs with corrections
                detections.class_id = np.array(corrected_class_ids)
                
                transformed_pts = transformer.transform(anchor_pts).astype(float)

                top_labels, bottom_labels = [], []
                csv_update_needed = False

                for track_id, orig_pt, trans_pt, class_id in zip(
                    detections.tracker_id, anchor_pts, transformed_pts, detections.class_id
                ):
                    vehicle_type = CLASS_NAMES.get(class_id, "unknown")
                    # Update tracker type with corrected classification
                    tracker_types[track_id] = vehicle_type
                    
                    previous_status = status_cache.get(track_id, "")
                    
                    # Default to moving status, which may be overridden below
                    current_status = "moving"
                    compliance = 0

                    position_history[track_id].append(trans_pt)

                    if point_inside_polygon(orig_pt, STOP_ZONE_POLYGON):
                        if track_id not in counted_ids:
                            vehicle_type_counter[vehicle_type] += 1
                            counted_ids.add(track_id)

                        # First time in stop zone - record entry
                        if track_id not in entry_times:
                            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                            entry_times[track_id] = time.time()
                            stop_zone_history[track_id] = {
                                "vehicle_type": vehicle_type,
                                "status": "entered",
                                "compliance": 0,
                                "reaction_time": 0,
                                "date": current_time
                            }
                            
                            # Update CSV when vehicle first enters stop zone
                            record_key = (track_id, "entered")
                            if record_key not in written_records:
                                written_records.add(record_key)
                                csv_update_needed = True

                        if len(position_history[track_id]) >= FRAME_BUFFER:
                            displacements = np.array([
                                np.linalg.norm(position_history[track_id][i] - position_history[track_id][i - 1])
                                for i in range(1, len(position_history[track_id]))
                            ])
                            weights = np.linspace(1, 2, len(displacements))
                            avg_velocity = np.average(displacements, weights=weights)

                            if avg_velocity < VELOCITY_THRESHOLD:
                                current_status, compliance = "stationary", 1
                                compliance_set.add(track_id)

                                if track_id not in reaction_times:
                                    reaction_times[track_id] = round(time.time() - entry_times[track_id], 2)
                    else:
                        position_history[track_id].clear()
                        if track_id in entry_times and track_id not in reaction_times:
                            reaction_times[track_id] = None
                    
                    # If the vehicle is already marked as stationary, maintain that status
                    # regardless of its current movement state
                    if track_id in stationary_vehicles:
                        current_status = "stationary"
                        compliance = 1
                    
                    # Detect status change and update CSV if needed
                    if previous_status != current_status and previous_status != "":
                        # Only update the CSV if:
                        # 1. We're upgrading to "stationary" status, OR
                        # 2. The vehicle hasn't been marked as stationary before
                        if current_status == "stationary" or track_id not in stationary_vehicles:
                            record_key = (track_id, current_status)
                            if record_key not in written_records:
                                written_records.add(record_key)
                                csv_update_needed = True
                                
                                # If we're marking it as stationary for the first time,
                                # add it to our stationary vehicles set
                                if current_status == "stationary":
                                    stationary_vehicles.add(track_id)
                    
                    status_cache[track_id] = current_status
                    
                    # Display the status label - always show the actual/current status for visual feedback
                    top_labels.append(f"{vehicle_type} {current_status}" if current_status != "moving" else vehicle_type)
                    bottom_labels.append(f"#{track_id}")

                    if track_id in stop_zone_history:
                        stop_zone_history_dict[str(track_id)] = {
                            "tracker_id": track_id,
                            "vehicle_type": vehicle_type,
                            "status": current_status,
                            "compliance": compliance,
                            "reaction_time": reaction_times.get(track_id),
                            "date": stop_zone_history[track_id].get("date", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
                        }

                # Update CSV files if needed (entry or status change occurred)
                if csv_update_needed:
                    update_success = update_csv_files(
                        OUTPUT_CSV_PATH, 
                        COUNT_CSV_PATH, 
                        stop_zone_history_dict, 
                        vehicle_type_counter
                    )
                    if update_success:
                        print(f"[INFO] CSV files updated at frame {frame_idx}")

                top_labels += [""] * (len(detections) - len(top_labels))
                bottom_labels += [""] * (len(detections) - len(bottom_labels))

                annotated = annotators['trace'].annotate(scene=frame.copy(), detections=detections)
                annotated = annotators['box'].annotate(annotated, detections)
                annotated = annotators['label_top'].annotate(annotated, detections, top_labels)
                annotated = annotators['label_bottom'].annotate(annotated, detections, bottom_labels)

                cv2.polylines(annotated, [STOP_ZONE_POLYGON], True, (0, 255, 255), 2)
                
                # Add a visualization line for the distance threshold
                cv2.line(annotated, (0, DISTANCE_THRESHOLD), (annotated.shape[1], DISTANCE_THRESHOLD), (0, 255, 0), 1)
                cv2.putText(annotated, "Classification Correction Line", (10, DISTANCE_THRESHOLD - 10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
                
                sink.write_frame(annotated)
                #cv2.imshow("Tracking with Stop", annotated)

                if frame_idx % 30 == 0:
                    now = time.time()
                    fps = 30 / (now - prev_fps_time)
                    prev_fps_time = now
                    print(f"[INFO] FPS: {fps:.2f}")

                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

    except Exception as e:
        print(f"[ERROR] {e}")
    finally:
        # Make sure to write final updates to CSV
        update_csv_files(OUTPUT_CSV_PATH, COUNT_CSV_PATH, stop_zone_history_dict, vehicle_type_counter)
        
        end_time = time.time()
        total_time = end_time - start_time
        avg_fps = frame_idx / total_time
        # ---------- HEAT-MAP WRITE-OUT ----------
        heat_norm  = cv2.normalize(heat_raw, None, 0, 255, cv2.NORM_MINMAX)
        heat_color = cv2.applyColorMap(heat_norm.astype(np.uint8), cv2.COLORMAP_JET)
        cv2.imwrite("./asset/heatmap.png", heat_color)

        # blend only if we really have first_frame
        if first_frame is not None and first_frame.size:
            overlay = cv2.addWeighted(first_frame, 0.55, heat_color, 0.45, 0)
            cv2.imwrite("./asset/heatmap_overlay.png", overlay)
        print("[INFO] Heat-map images saved ➜ asset/heatmap*.png")
        print(f"[INFO] Total Time: {total_time:.2f}s, Frames: {frame_idx}, Avg FPS: {avg_fps:.2f}")
        #cv2.destroyAllWindows()
        print("[INFO] Tracking and counting completed successfully.")

 

