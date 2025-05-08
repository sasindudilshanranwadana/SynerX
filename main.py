import cv2
import numpy as np
from collections import defaultdict, Counter
from ultralytics import YOLO
import supervision as sv
import csv
import os

# ---------- CONFIGURATION ---------- #

VIDEO_PATH = './asset/videoplayback.mp4'
OUTPUT_VIDEO_PATH = './asset/TrackingWithStopResult.mp4'
OUTPUT_CSV_PATH = './asset/tracking_results.csv'
COUNT_CSV_PATH = './asset/vehicle_count.csv'
MODEL_PATH = 'yolo11n.pt'

SOURCE_POLYGON = np.array([(422, 10), (535, 649), (801, 665), (594, 16)])
STOP_ZONE_POLYGON = np.array([(540, 307), (735, 310), (746, 557), (490, 555)])
TARGET_WIDTH, TARGET_HEIGHT = 5, 130

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

# ---------- HELPERS ---------- #

def point_inside_polygon(point, polygon):
    return cv2.pointPolygonTest(polygon.astype(np.float32), tuple(map(float, point)), False) >= 0

def initialize_csv(filepath, fieldnames):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    csvfile = open(filepath, mode='w', newline='')
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    writer.writeheader()
    return csvfile, writer

# ---------- MAIN PIPELINE ---------- #

def main(video_path=VIDEO_PATH, output_video_path=OUTPUT_VIDEO_PATH):
    video_info = sv.VideoInfo.from_video_path(video_path)
    video_info.fps = 25

    model = YOLO(MODEL_PATH)
    tracker = sv.ByteTrack(frame_rate=video_info.fps, track_activation_threshold=0.3)
    frame_gen = sv.get_video_frames_generator(source_path=video_path)

    # Annotators
    thickness = sv.calculate_optimal_line_thickness(video_info.resolution_wh)
    text_scale = sv.calculate_optimal_text_scale(video_info.resolution_wh)
    annotators = {
        'box': sv.BoxAnnotator(thickness=thickness),
        'trace': sv.TraceAnnotator(thickness=thickness, trace_length=video_info.fps * 2, position=sv.Position.BOTTOM_CENTER),
        'label_top': sv.LabelAnnotator(text_scale=text_scale, text_thickness=thickness, text_position=sv.Position.TOP_LEFT),
        'label_bottom': sv.LabelAnnotator(text_scale=text_scale, text_thickness=thickness, text_position=sv.Position.BOTTOM_CENTER)
    }

    polygon_zone = sv.PolygonZone(polygon=SOURCE_POLYGON)
    stop_zone = sv.PolygonZone(polygon=STOP_ZONE_POLYGON)
    transformer = ViewTransformer(SOURCE_POLYGON, (TARGET_WIDTH, TARGET_HEIGHT))

    tracker_types = {}
    stopped_frames = defaultdict(int)
    status_cache = {}
    compliance_set = set()
    stop_zone_history = {}
    counted_ids = set()
    vehicle_type_counter = Counter()

    csvfile, writer = initialize_csv(OUTPUT_CSV_PATH, ["tracker_id", "vehicle_type", "status", "compliance"])
    count_csvfile, count_writer = initialize_csv(COUNT_CSV_PATH, ["vehicle_type", "count"])

    try:
        with sv.VideoSink(output_video_path, video_info) as sink:
            for frame in frame_gen:
                result = model(frame)[0]
                detections = sv.Detections.from_ultralytics(result)
                detections = detections[detections.confidence > 0.3]
                detections = detections[polygon_zone.trigger(detections)].with_nms(threshold=0.6)
                detections = tracker.update_with_detections(detections)

                anchor_pts = detections.get_anchors_coordinates(anchor=sv.Position.BOTTOM_CENTER)
                transformed_pts = transformer.transform(anchor_pts).astype(int)

                top_labels, bottom_labels = [], []

                for track_id, orig_pt, _, class_id in zip(detections.tracker_id, anchor_pts, transformed_pts, detections.class_id):
                    vehicle_type = tracker_types.setdefault(track_id, CLASS_NAMES.get(class_id, "unknown"))
                    status = "moving"
                    compliance = 0

                    if point_inside_polygon(orig_pt, STOP_ZONE_POLYGON):
                        if track_id not in counted_ids:
                            vehicle_type_counter[vehicle_type] += 1
                            counted_ids.add(track_id)

                        stopped_frames[track_id] += 1

                        if stopped_frames[track_id] > video_info.fps * 2:
                            status, compliance = "stopped", 1
                            compliance_set.add(track_id)
                        elif stopped_frames[track_id] > video_info.fps * 1.5:
                            status, compliance = "slow down", 1

                        stop_zone_history[track_id] = {
                            "vehicle_type": vehicle_type,
                            "status": status,
                            "compliance": compliance
                        }
                    else:
                        stopped_frames[track_id] = 0
                        if track_id not in compliance_set:
                            status = "moving"

                    if status_cache.get(track_id) != status:
                        status_cache[track_id] = status

                    top_labels.append(f"{vehicle_type} {status}" if status != "moving" else vehicle_type)
                    bottom_labels.append(f"#{track_id}")

                # Update tracking status CSV
                csvfile.seek(0)
                csvfile.truncate()
                writer.writeheader()
                for tid, data in stop_zone_history.items():
                    writer.writerow({"tracker_id": tid, **data})
                csvfile.flush()

                # Update count CSV
                count_csvfile.seek(0)
                count_csvfile.truncate()
                count_writer.writeheader()
                for v_type, count in vehicle_type_counter.items():
                    count_writer.writerow({"vehicle_type": v_type, "count": count})
                count_csvfile.flush()

                # Padding labels
                top_labels += [""] * (len(detections) - len(top_labels))
                bottom_labels += [""] * (len(detections) - len(bottom_labels))

                # Annotate and display
                annotated = annotators['trace'].annotate(scene=frame.copy(), detections=detections)
                annotated = annotators['box'].annotate(annotated, detections)
                annotated = annotators['label_top'].annotate(annotated, detections, top_labels)
                annotated = annotators['label_bottom'].annotate(annotated, detections, bottom_labels)

                cv2.polylines(annotated, [STOP_ZONE_POLYGON], True, (0, 255, 255), 2)
                sink.write_frame(annotated)
                cv2.imshow("Tracking with Stop", annotated)

                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

    except Exception as e:
        print(f"[ERROR] {e}")
    finally:
        csvfile.close()
        count_csvfile.close()
        cv2.destroyAllWindows()
        print("[INFO] Tracking and counting completed successfully.")

# ---------- ENTRY POINT ---------- #
if __name__ == "__main__":
    main()
