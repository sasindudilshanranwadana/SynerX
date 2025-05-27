import cv2
import numpy as np
import time
from collections import defaultdict, Counter, deque
from ultralytics import YOLO
import supervision as sv
import csv
import os
from datetime import datetime  # Add import for datetime

# ---------- CONFIGURATION ---------- #
# These parameters can be adjusted to fine-tune the system performance

# File Paths
VIDEO_PATH = './asset/videoplayback.mp4'                    # Input video file path
OUTPUT_VIDEO_PATH = './asset/TrackingWithStopResult.mp4'    # Output annotated video path
OUTPUT_CSV_PATH = './asset/tracking_results.csv'            # Tracking results CSV output
COUNT_CSV_PATH = './asset/vehicle_count.csv'                # Vehicle count CSV output
MODEL_PATH = 'yolo11n.pt'                                   # YOLO model file path

# Detection Zone - Polygon coordinates for the area to monitor
SOURCE_POLYGON = np.array([
    (422, 10),   # Top-left
    (594, 16),   # Top-right
    (801, 665),  # Bottom-right
    (535, 649)   # Bottom-left
])

# Stop Zone - Polygon coordinates where vehicles should stop
STOP_ZONE_POLYGON = np.array([(507, 199), (681, 209), (751, 555), (484, 541)])

# Perspective Transform Settings
TARGET_WIDTH, TARGET_HEIGHT = 50, 130                       # Target dimensions for bird's eye view (affects distance calculations)

# Detection & Tracking Thresholds
DETECTION_CONFIDENCE = 0.3                                   # Minimum confidence for object detection (0.0-1.0)
NMS_THRESHOLD = 0.3                                    # Non-Maximum Suppression threshold (0.0-1.0)
VELOCITY_THRESHOLD = 0.6                                    # Velocity threshold to determine if vehicle is stationary (tune this value)
FRAME_BUFFER = 10                                           # Number of frames to analyze for velocity calculation


# Classification Settings
CLASS_NAMES = {                                             # Vehicle class mappings
    2: "car",
    3: "motorcycle", 
    5: "bus",
    7: "truck"
}

# Distance-based Classification Correction
DISTANCE_THRESHOLD = 300                                    # Y-coordinate threshold for correcting misclassified vehicles (adjust based on frame height)

# Video Processing Settings
TARGET_FPS = 25                                           # Target FPS for video processing
FPS_UPDATE_INTERVAL = 30                                   # Frames between FPS updates in console

# Annotation Settings
ANNOTATION_THICKNESS = 1                                   # Thickness of bounding boxes and traces
TEXT_SCALE = 0.4                                          # Scale of text labels
TEXT_THICKNESS = 1                                        # Thickness of text
TRACE_LENGTH_SECONDS = 2                                  # Length of vehicle traces in seconds

# Color Settings (BGR format)
STOP_ZONE_COLOR = (0, 255, 255)                          # Yellow color for stop zone outline
THRESHOLD_LINE_COLOR = (0, 255, 0)                       # Green color for classification threshold line
STOP_ZONE_LINE_THICKNESS = 2                             # Thickness of stop zone outline
THRESHOLD_LINE_THICKNESS = 1                             # Thickness of classification threshold line

# Anchor Point Visualization
# Anchor Point Settings
ANCHOR_Y_OFFSET = 0                                       # Offset to move anchor point up (negative values move up, positive move down)
SHOW_ANCHOR_POINTS = True                                 # Whether to show anchor points on video
ANCHOR_POINT_COLOR = (255, 0, 255)                      # Magenta color for anchor points
ANCHOR_POINT_RADIUS = 5                                 # Radius of anchor point circles
ANCHOR_POINT_THICKNESS = -1                             # Thickness (-1 for filled circle)

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
    # If the detected vehicle is a truck and it's close to the camera (higher y value)
    if class_id == 7 and y_position > DISTANCE_THRESHOLD:
        # More likely to be a car when close to the camera
        return 2  # Car class ID
    
    # If needed, add more corrections here
    return class_id  # Return original class if no correction needed

# ---------- MAIN ---------- #

def main():
    video_info = sv.VideoInfo.from_video_path(video_path=VIDEO_PATH)
    video_info.fps = TARGET_FPS

    model = YOLO(MODEL_PATH)
    model.fuse()
    tracker = sv.ByteTrack(frame_rate=video_info.fps)
    frame_gen = sv.get_video_frames_generator(source_path=VIDEO_PATH)

    annotators = {
        'box': sv.BoxAnnotator(thickness=ANNOTATION_THICKNESS),
        'trace': sv.TraceAnnotator(
            thickness=ANNOTATION_THICKNESS, 
            trace_length=video_info.fps * TRACE_LENGTH_SECONDS, 
            position=sv.Position.BOTTOM_CENTER
        ),
        'label_top': sv.LabelAnnotator(
            text_scale=TEXT_SCALE, 
            text_thickness=TEXT_THICKNESS, 
            text_position=sv.Position.TOP_LEFT
        ),
        'label_bottom': sv.LabelAnnotator(
            text_scale=TEXT_SCALE, 
            text_thickness=TEXT_THICKNESS, 
            text_position=sv.Position.BOTTOM_CENTER
        )
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
    
    written_records = set()  # Set of (tracker_id, status) tuples
    
    stationary_vehicles = set()
    
    stop_zone_history_dict = read_csv_to_dict(OUTPUT_CSV_PATH)
    
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
        with sv.VideoSink(OUTPUT_VIDEO_PATH, video_info) as sink:
            for frame in frame_gen:
                frame_idx += 1
                result = model(frame, verbose=False)[0]
                detections = sv.Detections.from_ultralytics(result)
                detections = detections[detections.confidence > DETECTION_CONFIDENCE]
                detections = detections[polygon_zone.trigger(detections)].with_nms(threshold=NMS_THRESHOLD)
                detections = tracker.update_with_detections(detections)

                detections.tracker_id = [tid + tracker_id_offset for tid in detections.tracker_id]

                anchor_pts = detections.get_anchors_coordinates(anchor=sv.Position.BOTTOM_CENTER)
                
                # Apply anchor offset to move the core point up
                anchor_pts = anchor_pts + np.array([0, ANCHOR_Y_OFFSET])
                
                corrected_class_ids = []
                for i, (pt, class_id) in enumerate(zip(anchor_pts, detections.class_id)):
                    y_pos = pt[1]
                    corrected_class_id = correct_vehicle_type(class_id, y_pos, detections.confidence[i])
                    corrected_class_ids.append(corrected_class_id)
                
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

                # Draw anchor points if enabled
                if SHOW_ANCHOR_POINTS:
                    for anchor_pt in anchor_pts:
                        cv2.circle(annotated, 
                                 (int(anchor_pt[0]), int(anchor_pt[1])), 
                                 ANCHOR_POINT_RADIUS, 
                                 ANCHOR_POINT_COLOR, 
                                 ANCHOR_POINT_THICKNESS)

                cv2.polylines(annotated, [STOP_ZONE_POLYGON], True, STOP_ZONE_COLOR, STOP_ZONE_LINE_THICKNESS)
                
                # Add a visualization line for the distance threshold
                cv2.line(annotated, (0, DISTANCE_THRESHOLD), (annotated.shape[1], DISTANCE_THRESHOLD), THRESHOLD_LINE_COLOR, THRESHOLD_LINE_THICKNESS)
                cv2.putText(annotated, "Classification Correction Line", (10, DISTANCE_THRESHOLD - 10), 
                            cv2.FONT_HERSHEY_SIMPLEX, TEXT_SCALE, THRESHOLD_LINE_COLOR, TEXT_THICKNESS)
                
                sink.write_frame(annotated)
                cv2.imshow("Tracking with Stop", annotated)

                if frame_idx % FPS_UPDATE_INTERVAL == 0:
                    now = time.time()
                    fps = FPS_UPDATE_INTERVAL / (now - prev_fps_time)
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
        print(f"[INFO] Total Time: {total_time:.2f}s, Frames: {frame_idx}, Avg FPS: {avg_fps:.2f}")
        cv2.destroyAllWindows()
        print("[INFO] Tracking and counting completed successfully.")

if __name__ == "__main__":
    main()
