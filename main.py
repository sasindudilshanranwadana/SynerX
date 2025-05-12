
import cv2
import numpy as np
import time
from collections import defaultdict, Counter, deque
from ultralytics import YOLO
import supervision as sv
import csv
import os
from datetime import datetime

# ---------- CONFIGURATION ---------- #
OUTPUT_CSV_PATH = './asset/tracking_results.csv'
COUNT_CSV_PATH = './asset/vehicle_count.csv'
SOURCE_POLYGON = np.array([
    (422, 10),
    (594, 16),
    (801, 665),
    (535, 649)
])
STOP_ZONE_POLYGON = np.array([
    (507, 199),
    (681, 209),
    (751, 555),
    (484, 541)
])
TARGET_WIDTH, TARGET_HEIGHT = 50, 130
VELOCITY_THRESHOLD = 0.5
FRAME_BUFFER = 20
CLASS_NAMES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
DISTANCE_THRESHOLD = 300

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

def point_inside_polygon(point, polygon):
    return cv2.pointPolygonTest(polygon.astype(np.float32), tuple(map(float, point)), False) >= 0

def correct_vehicle_type(class_id, y_position):
    if class_id == 7 and y_position > DISTANCE_THRESHOLD:
        return 2
    return class_id

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
    try:
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(output_path, 'w', newline='') as csv_out:
            writer = csv.DictWriter(csv_out, fieldnames=["tracker_id", "vehicle_type", "status", "compliance", "reaction_time", "date"])
            writer.writeheader()
            for tid, data in history_dict.items():
                data_with_date = data.copy()
                data_with_date["date"] = data_with_date.get("date", current_time)
                writer.writerow(data_with_date)
        with open(count_path, 'w', newline='') as count_out:
            writer = csv.DictWriter(count_out, fieldnames=["vehicle_type", "count", "date"])
            writer.writeheader()
            for v_type, count in vehicle_counter.items():
                writer.writerow({"vehicle_type": v_type, "count": count, "date": current_time})
        return True
    except Exception as e:
        print(f"[WARNING] Failed to update CSV files: {e}")
        return False

# ---------- MAIN ENTRY ---------- #
def main(input_video_path='./asset/video.mp4', output_video_path='./asset/output.mp4', model_name='yolov8n.pt'):
    video_info = sv.VideoInfo.from_video_path(video_path=input_video_path)
    video_info.fps = 30

    model = YOLO(model_name)
    model.fuse()

    tracker = sv.ByteTrack(frame_rate=video_info.fps)
    frame_gen = sv.get_video_frames_generator(source_path=input_video_path)
    transformer = ViewTransformer(SOURCE_POLYGON, (TARGET_WIDTH, TARGET_HEIGHT))

    annotators = {
        'box': sv.BoxAnnotator(thickness=1),
        'trace': sv.TraceAnnotator(thickness=1, trace_length=video_info.fps * 2, position=sv.Position.BOTTOM_CENTER),
        'label_top': sv.LabelAnnotator(text_scale=0.4, text_thickness=1, text_position=sv.Position.TOP_LEFT),
        'label_bottom': sv.LabelAnnotator(text_scale=0.4, text_thickness=1, text_position=sv.Position.BOTTOM_CENTER)
    }

    tracker_types = {}
    position_history = defaultdict(lambda: deque(maxlen=FRAME_BUFFER))
    status_cache = {}
    compliance_set = set()
    stationary_vehicles = set()
    stop_zone_history = {}
    counted_ids = set()
    vehicle_type_counter = Counter()
    entry_times = {}
    reaction_times = {}

    os.makedirs(os.path.dirname(OUTPUT_CSV_PATH), exist_ok=True)
    os.makedirs(os.path.dirname(COUNT_CSV_PATH), exist_ok=True)
    stop_zone_history_dict = read_csv_to_dict(OUTPUT_CSV_PATH)
    for track_id, data in stop_zone_history_dict.items():
        if data.get("status") == "stationary":
            stationary_vehicles.add(int(track_id))

    written_records = set()
    tracker_id_offset = max([int(tid) for tid in stop_zone_history_dict.keys()] + [0])

    try:
        with sv.VideoSink(output_video_path, video_info) as sink:
            for frame in frame_gen:
                result = model(frame, verbose=False)[0]
                detections = sv.Detections.from_ultralytics(result)
                detections = detections[detections.confidence > 0.3]
                detections = detections[sv.PolygonZone(polygon=SOURCE_POLYGON).trigger(detections)].with_nms(threshold=0.6)
                detections = tracker.update_with_detections(detections)
                detections.tracker_id = [tid + tracker_id_offset for tid in detections.tracker_id]

                anchor_pts = detections.get_anchors_coordinates(anchor=sv.Position.BOTTOM_CENTER)
                detections.class_id = np.array([correct_vehicle_type(cid, pt[1]) for pt, cid in zip(anchor_pts, detections.class_id)])
                transformed_pts = transformer.transform(anchor_pts).astype(float)

                top_labels, bottom_labels = [], []
                csv_update_needed = False

                for tid, orig_pt, trans_pt, cid in zip(detections.tracker_id, anchor_pts, transformed_pts, detections.class_id):
                    vehicle_type = CLASS_NAMES.get(cid, "unknown")
                    tracker_types[tid] = vehicle_type
                    previous_status = status_cache.get(tid, "")
                    current_status, compliance = "moving", 0
                    position_history[tid].append(trans_pt)

                    if point_inside_polygon(orig_pt, STOP_ZONE_POLYGON):
                        if tid not in counted_ids:
                            vehicle_type_counter[vehicle_type] += 1
                            counted_ids.add(tid)

                        if tid not in entry_times:
                            entry_times[tid] = time.time()
                            stop_zone_history[tid] = {
                                "vehicle_type": vehicle_type,
                                "status": "entered",
                                "compliance": 0,
                                "reaction_time": 0,
                                "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                            }
                            written_records.add((tid, "entered"))
                            csv_update_needed = True

                        if len(position_history[tid]) >= FRAME_BUFFER:
                            displacements = np.array([
                                np.linalg.norm(position_history[tid][i] - position_history[tid][i - 1])
                                for i in range(1, len(position_history[tid]))
                            ])
                            avg_velocity = np.average(displacements, weights=np.linspace(1, 2, len(displacements)))
                            if avg_velocity < VELOCITY_THRESHOLD:
                                current_status, compliance = "stationary", 1
                                compliance_set.add(tid)
                                if tid not in reaction_times:
                                    reaction_times[tid] = round(time.time() - entry_times[tid], 2)
                    else:
                        position_history[tid].clear()
                        if tid in entry_times and tid not in reaction_times:
                            reaction_times[tid] = None

                    if tid in stationary_vehicles:
                        current_status, compliance = "stationary", 1

                    if previous_status != current_status and previous_status != "":
                        if current_status == "stationary" or tid not in stationary_vehicles:
                            record_key = (tid, current_status)
                            if record_key not in written_records:
                                written_records.add(record_key)
                                csv_update_needed = True
                                if current_status == "stationary":
                                    stationary_vehicles.add(tid)

                    status_cache[tid] = current_status
                    top_labels.append(f"{vehicle_type} {current_status}" if current_status != "moving" else vehicle_type)
                    bottom_labels.append(f"#{tid}")

                    stop_zone_history_dict[str(tid)] = {
                        "tracker_id": tid,
                        "vehicle_type": vehicle_type,
                        "status": current_status,
                        "compliance": compliance,
                        "reaction_time": reaction_times.get(tid),
                        "date": stop_zone_history[tid].get("date", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
                    }

                if csv_update_needed:
                    update_csv_files(OUTPUT_CSV_PATH, COUNT_CSV_PATH, stop_zone_history_dict, vehicle_type_counter)

                annotated = annotators['trace'].annotate(scene=frame.copy(), detections=detections)
                annotated = annotators['box'].annotate(annotated, detections)
                annotated = annotators['label_top'].annotate(annotated, detections, top_labels)
                annotated = annotators['label_bottom'].annotate(annotated, detections, bottom_labels)
                cv2.polylines(annotated, [STOP_ZONE_POLYGON], True, (0, 255, 255), 2)
                sink.write_frame(annotated)

    except Exception as e:
        print(f"[ERROR] {e}")
    finally:
        update_csv_files(OUTPUT_CSV_PATH, COUNT_CSV_PATH, stop_zone_history_dict, vehicle_type_counter)
        print("[INFO] Processing completed.")
