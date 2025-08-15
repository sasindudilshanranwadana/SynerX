import cv2
import numpy as np
from collections import defaultdict, Counter
from ultralytics import YOLO
import supervision as sv
import csv
import os
from threading import Thread
import time
import queue
import sys
from functools import lru_cache

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

STOP_ZONE_POLYGON = np.array([(509, 203), (705, 189), (784, 700), (461, 690)])
TARGET_WIDTH, TARGET_HEIGHT = 50, 130
VELOCITY_THRESHOLD = 3.0  # Pixels per frame for stationary detection
FRAME_BUFFER = 10  # Number of frames to track position history
PROCESS_EVERY_N_FRAMES = 2  # Process every Nth frame to reduce computational load
BATCH_SIZE = 4  # Number of frames to process in batch

CLASS_NAMES = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck"
}

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

class CSVWriterThread(Thread):
    def __init__(self, filepath, fieldnames):
        Thread.__init__(self)
        self.daemon = True
        self.filepath = filepath
        self.fieldnames = fieldnames
        self.queue = queue.Queue()
        self.running = True
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
    def run(self):
        with open(self.filepath, mode='w', newline='') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=self.fieldnames)
            writer.writeheader()
            
            while self.running or not self.queue.empty():
                try:
                    data = self.queue.get(timeout=1.0)
                    if isinstance(data, list):
                        writer.writerows(data)
                    else:
                        writer.writerow(data)
                    csvfile.flush()
                    self.queue.task_done()
                except queue.Empty:
                    continue
                
    def write(self, data):
        self.queue.put(data)
        
    def stop(self):
        self.running = False
        self.join()

# ---------- HELPERS ---------- #

@lru_cache(maxsize=1024)
def point_inside_polygon(point, polygon_tuple):
    point_tuple = (float(point[0]), float(point[1]))
    return cv2.pointPolygonTest(
        np.array(polygon_tuple, dtype=np.float32),
        point_tuple,
        False
    ) >= 0

def polygon_to_tuple(polygon):
    # Ensure polygon is converted to a hashable tuple of tuples
    return tuple(map(tuple, polygon))

def initialize_csv_writer(filepath, fieldnames):
    writer = CSVWriterThread(filepath, fieldnames)
    writer.start()
    return writer

# ---------- MAIN PIPELINE ---------- #

def main():
    video_info = sv.VideoInfo.from_video_path(video_path=VIDEO_PATH)
    video_info.fps = 30

    # Load model without forcing half precision to avoid dtype issues
    model = YOLO(MODEL_PATH)
    # Remove the problematic half-precision conversion
    # if hasattr(model, 'model') and hasattr(model.model, 'half'):
    #     model.model.half()  # FP16 for faster inference

    tracker = sv.ByteTrack(frame_rate=video_info.fps, track_activation_threshold=0.35)
    capture = cv2.VideoCapture(VIDEO_PATH)
    
    if not capture.isOpened():
        print(f"Error: Could not open video {VIDEO_PATH}")
        sys.exit(1)

    # Precompute polygon tuples for faster lookup
    stop_zone_tuple = polygon_to_tuple(STOP_ZONE_POLYGON)

    # Annotators
    thickness = sv.calculate_optimal_line_thickness(video_info.resolution_wh)
    text_scale = sv.calculate_optimal_text_scale(video_info.resolution_wh)
    annotators = {
        'box': sv.BoxAnnotator(thickness=thickness),
        'trace': sv.TraceAnnotator(thickness=thickness, trace_length=video_info.fps, position=sv.Position.BOTTOM_CENTER),
        'label_top': sv.LabelAnnotator(text_scale=text_scale, text_thickness=thickness, text_position=sv.Position.TOP_LEFT),
        'label_bottom': sv.LabelAnnotator(text_scale=text_scale, text_thickness=thickness, text_position=sv.Position.BOTTOM_CENTER)
    }

    polygon_zone = sv.PolygonZone(polygon=SOURCE_POLYGON)
    stop_zone = sv.PolygonZone(polygon=STOP_ZONE_POLYGON)
    transformer = ViewTransformer(SOURCE_POLYGON, (TARGET_WIDTH, TARGET_HEIGHT))

    tracker_types = {}
    position_history = defaultdict(lambda: np.zeros((FRAME_BUFFER, 2), dtype=np.float32))
    position_index = defaultdict(int)
    status_cache = {}
    compliance_set = set()
    stop_zone_history = {}
    counted_ids = set()
    vehicle_type_counter = Counter()

    # Initialize CSV writers in separate threads
    tracking_writer = initialize_csv_writer(OUTPUT_CSV_PATH, ["tracker_id", "vehicle_type", "status", "compliance"])
    count_writer = initialize_csv_writer(COUNT_CSV_PATH, ["vehicle_type", "count"])

    try:
        with sv.VideoSink(OUTPUT_VIDEO_PATH, video_info) as sink:
            frame_count = 0
            batch_frames = []
            batch_count = 0
            
            while True:
                ret, frame = capture.read()
                if not ret:
                    break
                    
                frame_count += 1
                batch_frames.append(frame)
                batch_count += 1
                
                # Skip frames to reduce computational load
                if frame_count % PROCESS_EVERY_N_FRAMES != 0 and frame_count > 1:
                    if len(batch_frames) >= BATCH_SIZE:
                        batch_frames.pop(0)  # Keep batch size constant
                    sink.write_frame(batch_frames[-1])  # Write the most recent frame
                    continue
                
                # Process frames in batch when we have enough
                if batch_count < BATCH_SIZE and frame_count > 1:
                    continue
                
                # Reset batch counter and perform batch inference
                batch_count = 0
                if len(batch_frames) > 1:
                    # Add device='cpu' if GPU is causing issues
                    results = model(batch_frames, stream=True)
                else:
                    results = model([batch_frames[0]], stream=True)
                
                # Process each result
                for i, (curr_frame, result) in enumerate(zip(batch_frames, results)):
                    detections = sv.Detections.from_ultralytics(result)
                    
                    # Filter by confidence and zone before NMS for better performance
                    detections = detections[detections.confidence > 0.35]
                    detections = detections[polygon_zone.trigger(detections)].with_nms(threshold=0.5)
                    detections = tracker.update_with_detections(detections)

                    anchor_pts = detections.get_anchors_coordinates(anchor=sv.Position.BOTTOM_CENTER)
                    top_labels, bottom_labels = [], []
                    csv_updates = []
                    
                    for track_id, orig_pt, class_id in zip(
                        detections.tracker_id, anchor_pts, detections.class_id
                    ):
                        vehicle_type = tracker_types.setdefault(track_id, CLASS_NAMES.get(class_id, "unknown"))
                        status = "moving"
                        compliance = 0

                        # Update position history using circular buffer
                        idx = position_index[track_id] % FRAME_BUFFER
                        position_history[track_id][idx] = orig_pt
                        position_index[track_id] += 1

                        if point_inside_polygon(orig_pt, stop_zone_tuple):
                            if track_id not in counted_ids:
                                vehicle_type_counter[vehicle_type] += 1
                                counted_ids.add(track_id)

                            # Calculate velocity only if we have enough history
                            if position_index[track_id] >= FRAME_BUFFER:
                                # Get recent positions
                                positions = position_history[track_id]
                                # Efficient displacement calculation using numpy
                                displacements = np.linalg.norm(positions[1:] - positions[:-1], axis=1)
                                avg_velocity = np.mean(displacements) if displacements.size > 0 else 0
                                
                                if avg_velocity < VELOCITY_THRESHOLD:
                                    status, compliance = "stationary", 1
                                    compliance_set.add(track_id)

                            stop_zone_history[track_id] = {
                                "vehicle_type": vehicle_type,
                                "status": status,
                                "compliance": compliance
                            }
                            csv_updates.append({"tracker_id": track_id, **stop_zone_history[track_id]})
                        else:
                            # Clear position history more efficiently
                            position_index[track_id] = 0
                            if track_id not in compliance_set:
                                status = "moving"

                        if status_cache.get(track_id) != status:
                            status_cache[track_id] = status

                        top_labels.append(f"{vehicle_type} {status}" if status != "moving" else vehicle_type)
                        bottom_labels.append(f"#{track_id}")

                    # Update tracking status CSV in batch
                    if csv_updates:
                        tracking_writer.write(csv_updates)

                    # Update count CSV only when counts change
                    count_updates = [{"vehicle_type": v_type, "count": count} for v_type, count in vehicle_type_counter.items()]
                    if count_updates:
                        count_writer.queue.put(count_updates)

                    # Padding labels (only if needed)
                    if len(top_labels) < len(detections):
                        top_labels += [""] * (len(detections) - len(top_labels))
                        bottom_labels += [""] * (len(detections) - len(bottom_labels))

                    # Annotate and display
                    annotated = curr_frame.copy()
                    if len(detections) > 0:
                        annotated = annotators['trace'].annotate(scene=annotated, detections=detections)
                        annotated = annotators['box'].annotate(annotated, detections)
                        annotated = annotators['label_top'].annotate(annotated, detections, top_labels)
                        annotated = annotators['label_bottom'].annotate(annotated, detections, bottom_labels)

                    # Draw stop zone
                    cv2.polylines(annotated, [STOP_ZONE_POLYGON], True, (0, 255, 255), 2)
                    sink.write_frame(annotated)
                    
                    # Show frame (can be optimized to show less frequently if needed)
                    cv2.imshow("Tracking with Stop", annotated)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        raise KeyboardInterrupt

                # Clear batch frames after processing
                batch_frames = []

    except KeyboardInterrupt:
        print("[INFO] Processing interrupted by user")
    except Exception as e:
        print(f"[ERROR] {e}")
    finally:
        # Properly clean up resources
        tracking_writer.stop()
        count_writer.stop()
        capture.release()
        cv2.destroyAllWindows()
        print("[INFO] Tracking and counting completed successfully.")

# ---------- ENTRY POINT ---------- #
if __name__ == "__main__":
    main()
