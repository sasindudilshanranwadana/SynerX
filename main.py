import cv2
import numpy as np
import time
from collections import defaultdict, Counter, deque
from ultralytics import YOLO
import supervision as sv
import csv
import os
from datetime import datetime

class Config:
    """Configuration class to centralize all settings"""
    # File Paths
    VIDEO_PATH = './asset/videoplayback.mp4'
    OUTPUT_VIDEO_PATH = './asset/TrackingWithStopResult.mp4'
    OUTPUT_CSV_PATH = './asset/tracking_results.csv'
    COUNT_CSV_PATH = './asset/vehicle_count.csv'
    MODEL_PATH = './models/yolo12s.pt'
    
    # Detection Zones
    SOURCE_POLYGON = np.array([(422, 10), (594, 16), (801, 665), (535, 649)])
    STOP_ZONE_POLYGON = np.array([(507, 199), (681, 209), (751, 555), (484, 541)])
    
    # Thresholds
    TARGET_WIDTH, TARGET_HEIGHT = 50, 130
    DETECTION_CONFIDENCE = 0.3
    NMS_THRESHOLD = 0.3
    VELOCITY_THRESHOLD = 0.6
    FRAME_BUFFER = 10
    DETECTION_OVERLAP_THRESHOLD = 0.5
    CLASS_CONFIDENCE_THRESHOLD = 0.7
    CLASS_HISTORY_FRAMES = 10
    
    # Video Settings
    TARGET_FPS = 25
    FPS_UPDATE_INTERVAL = 30
    
    # Visual Settings
    ANNOTATION_THICKNESS = 1
    TEXT_SCALE = 0.4
    TEXT_THICKNESS = 1
    TRACE_LENGTH_SECONDS = 2
    STOP_ZONE_COLOR = (0, 255, 255)
    STOP_ZONE_LINE_THICKNESS = 2
    ANCHOR_Y_OFFSET = 0
    SHOW_ANCHOR_POINTS = True
    ANCHOR_POINT_COLOR = (255, 0, 255)
    ANCHOR_POINT_RADIUS = 5
    ANCHOR_POINT_THICKNESS = -1
    
    # Vehicle Classes
    CLASS_NAMES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}

class ViewTransformer:
    def __init__(self, source: np.ndarray, target_size: tuple[int, int]):
        target = np.array([
            [0, 0], [target_size[0] - 1, 0],
            [target_size[0] - 1, target_size[1] - 1], [0, target_size[1] - 1]
        ], dtype=np.float32)
        self.m = cv2.getPerspectiveTransform(source.astype(np.float32), target)

    def transform(self, points: np.ndarray) -> np.ndarray:
        if points.size == 0:
            return points
        return cv2.perspectiveTransform(
            points.reshape(-1, 1, 2).astype(np.float32), self.m
        ).reshape(-1, 2)

class CSVManager:
    """Handles all CSV file operations"""
    
    @staticmethod
    def initialize_csv_files():
        """Initialize CSV files with headers if they don't exist"""
        os.makedirs(os.path.dirname(Config.OUTPUT_CSV_PATH), exist_ok=True)
        
        tracking_fields = ["tracker_id", "vehicle_type", "status", "compliance", "reaction_time", "date"]
        count_fields = ["vehicle_type", "count", "date"]
        
        for path, fields in [(Config.OUTPUT_CSV_PATH, tracking_fields), (Config.COUNT_CSV_PATH, count_fields)]:
            if not os.path.exists(path) or os.path.getsize(path) == 0:
                with open(path, 'w', newline='') as f:
                    csv.DictWriter(f, fieldnames=fields).writeheader()
    
    @staticmethod
    def read_existing_data():
        """Read existing tracking data from CSV"""
        data = {}
        if os.path.exists(Config.OUTPUT_CSV_PATH):
            with open(Config.OUTPUT_CSV_PATH, 'r', newline='') as file:
                for row in csv.DictReader(file):
                    data[row['tracker_id']] = row
        return data
    
    @staticmethod
    def update_files(history_dict, vehicle_counter):
        """Update CSV files with current data"""
        try:
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            # Update tracking results
            with open(Config.OUTPUT_CSV_PATH, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=["tracker_id", "vehicle_type", "status", "compliance", "reaction_time", "date"])
                writer.writeheader()
                for tid, data in history_dict.items():
                    data_with_date = data.copy()
                    data_with_date.setdefault("date", current_time)
                    writer.writerow(data_with_date)
            
            # Update vehicle counts
            with open(Config.COUNT_CSV_PATH, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=["vehicle_type", "count", "date"])
                writer.writeheader()
                for v_type, count in vehicle_counter.items():
                    writer.writerow({"vehicle_type": v_type, "count": count, "date": current_time})
            
            return True
        except Exception as e:
            print(f"[WARNING] Failed to update CSV files: {e}")
            return False

class VehicleTracker:
    """Handles vehicle tracking logic"""
    
    def __init__(self):
        self.position_history = defaultdict(lambda: deque(maxlen=Config.FRAME_BUFFER))
        self.class_history = defaultdict(lambda: deque(maxlen=Config.CLASS_HISTORY_FRAMES))
        self.stable_class = {}
        self.status_cache = {}
        self.stationary_vehicles = set()
        self.entry_times = {}
        self.reaction_times = {}
        self.written_records = set()
    
    def calculate_iou(self, box1, box2):
        """Calculate Intersection over Union of two bounding boxes"""
        x1, y1, x2, y2 = box1
        x3, y3, x4, y4 = box2
        
        xi1, yi1 = max(x1, x3), max(y1, y3)
        xi2, yi2 = min(x2, x4), min(y2, y4)
        
        if xi2 <= xi1 or yi2 <= yi1:
            return 0.0
        
        intersection = (xi2 - xi1) * (yi2 - yi1)
        box1_area = (x2 - x1) * (y2 - y1)
        box2_area = (x4 - x3) * (y4 - y3)
        union = box1_area + box2_area - intersection
        
        return intersection / union if union > 0 else 0.0
    
    def merge_overlapping_detections(self, detections):
        """Merge overlapping detections to prevent duplicate tracker IDs"""
        if len(detections) <= 1:
            return detections
        
        boxes, classes, confidences = detections.xyxy, detections.class_id, detections.confidence
        merged_indices, used_indices = [], set()
        
        for i in range(len(boxes)):
            if i in used_indices:
                continue
            
            current_group = [i]
            used_indices.add(i)
            
            for j in range(i + 1, len(boxes)):
                if j in used_indices:
                    continue
                
                if self.calculate_iou(boxes[i], boxes[j]) > Config.DETECTION_OVERLAP_THRESHOLD:
                    current_group.append(j)
                    used_indices.add(j)
            
            merged_indices.append(current_group)
        
        # Create merged detections
        merged_boxes, merged_classes, merged_confidences = [], [], []
        
        for group in merged_indices:
            if len(group) == 1:
                idx = group[0]
                merged_boxes.append(boxes[idx])
                merged_classes.append(classes[idx])
                merged_confidences.append(confidences[idx])
            else:
                group_confidences = confidences[group]
                best_idx = np.argmax(group_confidences)
                weights = group_confidences / np.sum(group_confidences)
                avg_box = np.average(boxes[group], axis=0, weights=weights)
                
                merged_boxes.append(avg_box)
                merged_classes.append(classes[group[best_idx]])
                merged_confidences.append(group_confidences[best_idx])
        
        return sv.Detections(
            xyxy=np.array(merged_boxes),
            class_id=np.array(merged_classes),
            confidence=np.array(merged_confidences)
        )
    
    def update_class_consistency(self, detections):
        """Update vehicle class consistency"""
        for i, track_id in enumerate(detections.tracker_id):
            current_class = detections.class_id[i]
            self.class_history[track_id].append(current_class)
            
            if track_id in self.stable_class:
                detections.class_id[i] = self.stable_class[track_id]
            elif len(self.class_history[track_id]) >= 3:
                class_counts = Counter(self.class_history[track_id])
                most_common_class, most_common_count = class_counts.most_common(1)[0]
                confidence_ratio = most_common_count / len(self.class_history[track_id])
                
                if confidence_ratio >= Config.CLASS_CONFIDENCE_THRESHOLD:
                    self.stable_class[track_id] = most_common_class
                    detections.class_id[i] = most_common_class
                    print(f"[INFO] Vehicle #{track_id} class established as {Config.CLASS_NAMES.get(most_common_class, 'unknown')}")

class HeatMapGenerator:
    """Handles heat map generation"""
    
    def __init__(self, resolution_wh):
        self.W, self.H = resolution_wh
        self.heat_raw = np.zeros((self.H, self.W), dtype=np.float32)
        self.KERNEL = cv2.getGaussianKernel(25, 7)
        self.KERNEL = (self.KERNEL @ self.KERNEL.T).astype(np.float32)
        self.kH, self.kW = self.KERNEL.shape
    
    def accumulate(self, detections):
        """Accumulate detection data for heat map"""
        for (x1, y1, x2, y2), conf in zip(detections.xyxy, detections.confidence):
            cx, cy = int((x1 + x2) / 2), int((y1 + y2) / 2)
            
            x0, x1p = max(0, cx - self.kW // 2), min(self.W, cx + self.kW // 2 + 1)
            y0, y1p = max(0, cy - self.kH // 2), min(self.H, cy + self.kH // 2 + 1)
            
            kx0, ky0 = x0 - (cx - self.kW // 2), y0 - (cy - self.kH // 2)
            kx1, ky1 = kx0 + (x1p - x0), ky0 + (y1p - y0)

            self.heat_raw[y0:y1p, x0:x1p] += self.KERNEL[ky0:ky1, kx0:kx1] * conf
    
    def save_heat_maps(self, first_frame=None):
        """Save heat map images"""
        heat_norm = cv2.normalize(self.heat_raw, None, 0, 255, cv2.NORM_MINMAX)
        heat_color = cv2.applyColorMap(heat_norm.astype(np.uint8), cv2.COLORMAP_JET)
        cv2.imwrite("./asset/heatmap.png", heat_color)
        
        if first_frame is not None and first_frame.size:
            overlay = cv2.addWeighted(first_frame, 0.55, heat_color, 0.45, 0)
            cv2.imwrite("./asset/heatmap_overlay.png", overlay)
        
        print("[INFO] Heat-map images saved ➜ asset/heatmap*.png")

def point_inside_polygon(point, polygon):
    """Check if point is inside polygon"""
    return cv2.pointPolygonTest(polygon.astype(np.float32), tuple(map(float, point)), False) >= 0

def setup_annotators():
    """Setup supervision annotators"""
    return {
        'box': sv.BoxAnnotator(thickness=Config.ANNOTATION_THICKNESS),
        'trace': sv.TraceAnnotator(
            thickness=Config.ANNOTATION_THICKNESS,
            trace_length=Config.TARGET_FPS * Config.TRACE_LENGTH_SECONDS,
            position=sv.Position.BOTTOM_CENTER
        ),
        'label_top': sv.LabelAnnotator(
            text_scale=Config.TEXT_SCALE,
            text_thickness=Config.TEXT_THICKNESS,
            text_position=sv.Position.TOP_LEFT
        ),
        'label_bottom': sv.LabelAnnotator(
            text_scale=Config.TEXT_SCALE,
            text_thickness=Config.TEXT_THICKNESS,
            text_position=sv.Position.BOTTOM_CENTER
        )
    }

def main(video_path=Config.VIDEO_PATH, output_video_path=Config.OUTPUT_VIDEO_PATH):
    """Main processing function"""
    # Initialize components
    video_info = sv.VideoInfo.from_video_path(video_path)
    video_info.fps = Config.TARGET_FPS
    
    # Get first frame for heat map overlay
    cap0 = cv2.VideoCapture(video_path)
    ok, first_frame = cap0.read()
    cap0.release()
    if not ok:
        raise RuntimeError("Could not read first frame")
    
    # Initialize classes
    heat_map = HeatMapGenerator(video_info.resolution_wh)
    vehicle_tracker = VehicleTracker()
    csv_manager = CSVManager()
    
    # Setup model and tracking
    model = YOLO(Config.MODEL_PATH)
    model.fuse()
    tracker = sv.ByteTrack(frame_rate=video_info.fps)
    
    # Setup zones and transformer
    polygon_zone = sv.PolygonZone(polygon=Config.SOURCE_POLYGON)
    stop_zone = sv.PolygonZone(polygon=Config.STOP_ZONE_POLYGON)
    transformer = ViewTransformer(Config.SOURCE_POLYGON, (Config.TARGET_WIDTH, Config.TARGET_HEIGHT))
    
    # Setup annotators
    annotators = setup_annotators()
    
    # Initialize CSV files and load existing data
    csv_manager.initialize_csv_files()
    stop_zone_history_dict = csv_manager.read_existing_data()
    
    # Initialize tracking variables
    counted_ids = set()
    vehicle_type_counter = Counter()
    tracker_types = {}
    
    # Load existing stationary vehicles
    for track_id, data in stop_zone_history_dict.items():
        if data.get('status') == 'stationary':
            vehicle_tracker.stationary_vehicles.add(int(track_id))
    
    # Get tracker ID offset
    max_track_id = max((int(tid) for tid in stop_zone_history_dict.keys() if tid.isdigit()), default=0)
    tracker_id_offset = max_track_id
    if max_track_id > 0:
        print(f"[INFO] Continuing from tracker ID: {tracker_id_offset + 1}")
    
    # Processing variables
    frame_idx = 0
    start_time = time.time()
    prev_fps_time = start_time
    frame_gen = sv.get_video_frames_generator(source_path=video_path)
    
    try:
        with sv.VideoSink(output_video_path, video_info) as sink:
            for frame in frame_gen:
                frame_idx += 1
                
                # Detection and tracking
                result = model(frame, verbose=False)[0]
                detections = sv.Detections.from_ultralytics(result)
                detections = detections[detections.confidence > Config.DETECTION_CONFIDENCE]
                detections = detections[polygon_zone.trigger(detections)].with_nms(threshold=Config.NMS_THRESHOLD)
                
                detections = vehicle_tracker.merge_overlapping_detections(detections)
                detections = tracker.update_with_detections(detections)
                
                # Heat map accumulation
                heat_map.accumulate(detections)
                
                # Apply tracker ID offset
                detections.tracker_id = [tid + tracker_id_offset for tid in detections.tracker_id]
                
                # Get anchor points
                anchor_pts = detections.get_anchors_coordinates(anchor=sv.Position.BOTTOM_CENTER)
                anchor_pts = anchor_pts + np.array([0, Config.ANCHOR_Y_OFFSET])
                
                # Update class consistency
                vehicle_tracker.update_class_consistency(detections)
                
                # Transform points for distance calculation
                transformed_pts = transformer.transform(anchor_pts).astype(float)
                
                # Process each detection
                top_labels, bottom_labels = [], []
                csv_update_needed = False
                
                for track_id, orig_pt, trans_pt, class_id in zip(
                    detections.tracker_id, anchor_pts, transformed_pts, detections.class_id
                ):
                    vehicle_type = Config.CLASS_NAMES.get(class_id, "unknown")
                    tracker_types[track_id] = vehicle_type
                    
                    previous_status = vehicle_tracker.status_cache.get(track_id, "")
                    current_status = "moving"
                    compliance = 0
                    
                    vehicle_tracker.position_history[track_id].append(trans_pt)
                    
                    # Check if in stop zone
                    if point_inside_polygon(orig_pt, Config.STOP_ZONE_POLYGON):
                        # Count vehicle if first time in zone
                        if track_id not in counted_ids:
                            vehicle_type_counter[vehicle_type] += 1
                            counted_ids.add(track_id)
                        
                        # Record entry time
                        if track_id not in vehicle_tracker.entry_times:
                            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                            vehicle_tracker.entry_times[track_id] = time.time()
                            
                            record_key = (track_id, "entered")
                            if record_key not in vehicle_tracker.written_records:
                                vehicle_tracker.written_records.add(record_key)
                                csv_update_needed = True
                        
                        # Check if stationary
                        if len(vehicle_tracker.position_history[track_id]) >= Config.FRAME_BUFFER:
                            displacements = np.array([
                                np.linalg.norm(vehicle_tracker.position_history[track_id][i] - 
                                             vehicle_tracker.position_history[track_id][i - 1])
                                for i in range(1, len(vehicle_tracker.position_history[track_id]))
                            ])
                            weights = np.linspace(1, 2, len(displacements))
                            avg_velocity = np.average(displacements, weights=weights)
                            
                            if avg_velocity < Config.VELOCITY_THRESHOLD:
                                current_status, compliance = "stationary", 1
                                
                                if track_id not in vehicle_tracker.reaction_times:
                                    vehicle_tracker.reaction_times[track_id] = round(
                                        time.time() - vehicle_tracker.entry_times[track_id], 2
                                    )
                    else:
                        vehicle_tracker.position_history[track_id].clear()
                        if track_id in vehicle_tracker.entry_times and track_id not in vehicle_tracker.reaction_times:
                            vehicle_tracker.reaction_times[track_id] = None
                    
                    # Maintain stationary status once achieved
                    if track_id in vehicle_tracker.stationary_vehicles:
                        current_status = "stationary"
                        compliance = 1
                    
                    # Update CSV on status change
                    if previous_status != current_status and previous_status != "":
                        if current_status == "stationary" or track_id not in vehicle_tracker.stationary_vehicles:
                            record_key = (track_id, current_status)
                            if record_key not in vehicle_tracker.written_records:
                                vehicle_tracker.written_records.add(record_key)
                                csv_update_needed = True
                                
                                if current_status == "stationary":
                                    vehicle_tracker.stationary_vehicles.add(track_id)
                    
                    vehicle_tracker.status_cache[track_id] = current_status
                    
                    # Prepare labels
                    top_labels.append(f"{vehicle_type} {current_status}" if current_status != "moving" else vehicle_type)
                    bottom_labels.append(f"#{track_id}")
                    
                    # Update history dictionary
                    if track_id in vehicle_tracker.entry_times:
                        stop_zone_history_dict[str(track_id)] = {
                            "tracker_id": track_id,
                            "vehicle_type": vehicle_type,
                            "status": current_status,
                            "compliance": compliance,
                            "reaction_time": vehicle_tracker.reaction_times.get(track_id),
                            "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        }
                
                # Update CSV files if needed
                if csv_update_needed:
                    if csv_manager.update_files(stop_zone_history_dict, vehicle_type_counter):
                        print(f"[INFO] CSV files updated at frame {frame_idx}")
                
                # Ensure label lists match detection count
                top_labels += [""] * (len(detections) - len(top_labels))
                bottom_labels += [""] * (len(detections) - len(bottom_labels))
                
                # Annotate frame
                annotated = annotators['trace'].annotate(scene=frame.copy(), detections=detections)
                annotated = annotators['box'].annotate(annotated, detections)
                annotated = annotators['label_top'].annotate(annotated, detections, top_labels)
                annotated = annotators['label_bottom'].annotate(annotated, detections, bottom_labels)
                
                # Draw anchor points if enabled
                if Config.SHOW_ANCHOR_POINTS:
                    for anchor_pt in anchor_pts:
                        cv2.circle(annotated, 
                                 (int(anchor_pt[0]), int(anchor_pt[1])), 
                                 Config.ANCHOR_POINT_RADIUS, 
                                 Config.ANCHOR_POINT_COLOR, 
                                 Config.ANCHOR_POINT_THICKNESS)
                
                # Draw stop zone
                cv2.polylines(annotated, [Config.STOP_ZONE_POLYGON], True, 
                            Config.STOP_ZONE_COLOR, Config.STOP_ZONE_LINE_THICKNESS)
                
                # Output frame
                sink.write_frame(annotated)
                cv2.imshow("Tracking with Stop", annotated)
                
                # Update FPS display
                if frame_idx % Config.FPS_UPDATE_INTERVAL == 0:
                    now = time.time()
                    fps = Config.FPS_UPDATE_INTERVAL / (now - prev_fps_time)
                    prev_fps_time = now
                    print(f"[INFO] FPS: {fps:.2f}")
                
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
    
    except Exception as e:
        print(f"[ERROR] {e}")
    finally:
        # Final cleanup
        csv_manager.update_files(stop_zone_history_dict, vehicle_type_counter)
        heat_map.save_heat_maps(first_frame)
        
        end_time = time.time()
        total_time = end_time - start_time
        avg_fps = frame_idx / total_time
        
        print(f"[INFO] Total Time: {total_time:.2f}s, Frames: {frame_idx}, Avg FPS: {avg_fps:.2f}")
        cv2.destroyAllWindows()
        print("[INFO] Tracking and counting completed successfully.")

if __name__ == "__main__":
    main()
