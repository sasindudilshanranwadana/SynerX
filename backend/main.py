import cv2
import numpy as np
import time
from collections import Counter
from ultralytics import YOLO
import supervision as sv
from datetime import datetime
import signal
import sys
import threading

from config.config import Config
from utils.csv_manager import CSVManager
from utils.heatmap import HeatMapGenerator
from utils.view_transformer import ViewTransformer
from utils.vehicle_tracker import VehicleTracker
from utils.correlation_analysis import run_correlation_analysis
from supabase_client import supabase_manager

# Global flag for graceful shutdown
shutdown_requested = False
shutdown_lock = threading.Lock()

def signal_handler(signum, frame):
    """Handle interrupt signals gracefully"""
    global shutdown_requested
    with shutdown_lock:
        shutdown_requested = True
    print(f"\n[INFO] Received signal {signum}. Shutting down gracefully...")

def check_shutdown():
    """Check if shutdown has been requested"""
    global shutdown_requested
    with shutdown_lock:
        return shutdown_requested

def set_shutdown_flag():
    """Set the shutdown flag (called from API)"""
    global shutdown_requested
    with shutdown_lock:
        shutdown_requested = True

def reset_shutdown_flag():
    """Reset the shutdown flag"""
    global shutdown_requested
    with shutdown_lock:
        shutdown_requested = False

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
    global shutdown_requested
    
    # Setup signal handlers for graceful shutdown (only in main thread)
    try:
        signal.signal(signal.SIGINT, signal_handler)   # Ctrl+C
        signal.signal(signal.SIGTERM, signal_handler)  # Termination signal
        print("[INFO] Press Ctrl+C to stop processing gracefully")
    except ValueError:
        # Signal handling only works in main thread, skip in worker threads
        print("[INFO] Running in worker thread - signal handling disabled")
    
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
    
    # Load existing count data for current date from DATABASE (not CSV)
    current_date = datetime.now().strftime("%Y-%m-%d")
    try:
        # Get current counts from database
        db_vehicle_counts = supabase_manager.get_vehicle_counts(limit=1000)
        for row in db_vehicle_counts:
            if row.get('date') and row.get('vehicle_type') and row.get('count'):
                # Check if it's from today
                row_date = row['date'].split(' ')[0] if ' ' in row['date'] else row['date'].split('T')[0]
                if row_date == current_date:
                    vehicle_type = row['vehicle_type']
                    count = int(row['count'])
                    vehicle_type_counter[vehicle_type] = count  # Set to current total
        print(f"[INFO] Loaded existing counts from database: {dict(vehicle_type_counter)}")
    except Exception as e:
        print(f"[WARNING] Failed to load counts from database, using CSV fallback: {e}")
        # Fallback to CSV
        existing_count_data = csv_manager.read_existing_count_data()
        if current_date in existing_count_data:
            vehicle_type_counter.update(existing_count_data[current_date])
            print(f"[INFO] Continuing count from CSV fallback: {dict(vehicle_type_counter)}")
    
    tracker_types = {}
    
    # Load existing stationary vehicles
    for track_id, data in stop_zone_history_dict.items():
        if data.get('status') == 'stationary':
            vehicle_tracker.stationary_vehicles.add(int(track_id))
    
    # Restore tracker_id offset logic for global unique IDs
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
                # Check for shutdown request
                if check_shutdown():
                    print(f"[INFO] Shutdown requested at frame {frame_idx}. Stopping gracefully...")
                    break
                
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
                
                # Apply tracker ID offset for global uniqueness
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
                            print(f"[DEBUG] New vehicle counted: track_id={track_id}, type={vehicle_type}")
                            vehicle_type_counter[vehicle_type] += 1
                            counted_ids.add(track_id)
                            print(f"[DEBUG] Vehicle counter updated: {dict(vehicle_type_counter)}")
                            # Update CSV immediately when vehicle is counted
                            csv_manager.update_count_file(vehicle_type_counter)
                            print(f"[DEBUG] Vehicle count saved to database for {vehicle_type}: {vehicle_type_counter[vehicle_type]}")
                        
                        # Record entry time
                        if track_id not in vehicle_tracker.entry_times:
                            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                            vehicle_tracker.entry_times[track_id] = time.time()
                            print(f"[DEBUG] Vehicle {track_id} ({vehicle_type}) entered stop zone at {current_time}")
                            
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
                                    reaction_time = round(time.time() - vehicle_tracker.entry_times[track_id], 2)
                                    vehicle_tracker.reaction_times[track_id] = reaction_time
                                    print(f"[DEBUG] Vehicle {track_id} ({vehicle_type}) became stationary after {reaction_time}s")
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
                        print(f"[DEBUG] Vehicle {track_id} ({vehicle_type}) status changed: {previous_status} -> {current_status}")
                        if current_status == "stationary" or track_id not in vehicle_tracker.stationary_vehicles:
                            record_key = (track_id, current_status)
                            if record_key not in vehicle_tracker.written_records:
                                vehicle_tracker.written_records.add(record_key)
                                csv_update_needed = True
                                
                                if current_status == "stationary":
                                    vehicle_tracker.stationary_vehicles.add(track_id)
                                    print(f"[DEBUG] Vehicle {track_id} added to stationary vehicles list")
                    
                    vehicle_tracker.status_cache[track_id] = current_status
                    
                    # Prepare labels
                    top_labels.append(f"{vehicle_type} {current_status}" if current_status != "moving" else vehicle_type)
                    bottom_labels.append(f"#{track_id}")
                    
                    # Update history dictionary ONLY for vehicles that have entered the stop zone
                    if track_id in vehicle_tracker.entry_times:
                        # Only update if this is a new entry or status has changed
                        current_record = {
                            "tracker_id": track_id,
                            "vehicle_type": vehicle_type,
                            "status": current_status,
                            "compliance": compliance,
                            "reaction_time": vehicle_tracker.reaction_times.get(track_id),
                            "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        }
                        
                        # Check if this is a new record or if status has changed
                        existing_record = stop_zone_history_dict.get(str(track_id))
                        should_update = False
                        
                        if existing_record is None:
                            # New vehicle in stop zone
                            should_update = True
                            print(f"[DEBUG] New vehicle in stop zone: track_id={track_id}, type={vehicle_type}")
                        elif (existing_record.get('status') != current_status or 
                              existing_record.get('compliance') != compliance or
                              existing_record.get('reaction_time') != vehicle_tracker.reaction_times.get(track_id)):
                            # Status has changed
                            should_update = True
                            print(f"[DEBUG] Status changed for vehicle: track_id={track_id}, status={existing_record.get('status')} -> {current_status}")
                        
                        if should_update:
                            stop_zone_history_dict[str(track_id)] = current_record
                            csv_update_needed = True
                
                # Update CSV files if needed
                if csv_update_needed:
                    print(f"[DEBUG] Updating tracking data to database at frame {frame_idx}")
                    if csv_manager.update_tracking_file(stop_zone_history_dict):
                        print(f"[INFO] Tracking data updated at frame {frame_idx}")
                        # Log what was updated
                        for track_id_str, data in stop_zone_history_dict.items():
                            if data.get('status') in ['stationary', 'entered']:
                                print(f"[DEBUG] Saved to DB: track_id={data.get('tracker_id')}, type={data.get('vehicle_type')}, status={data.get('status')}, compliance={data.get('compliance')}")
                    # Reset the flag to prevent duplicate saves
                    csv_update_needed = False
                
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
                # cv2.imshow("Tracking with Stop", annotated)  # Commented out for headless/server use
                
                # Update FPS display
                if frame_idx % Config.FPS_UPDATE_INTERVAL == 0:
                    now = time.time()
                    fps = Config.FPS_UPDATE_INTERVAL / (now - prev_fps_time)
                    prev_fps_time = now
                    print(f"[INFO] FPS: {fps:.2f}")
                
                # Check for shutdown more frequently (every 10 frames)
                if frame_idx % 10 == 0 and check_shutdown():
                    print(f"[INFO] Shutdown requested at frame {frame_idx}. Stopping gracefully...")
                    break
                
                # Check for keyboard interrupt (for local testing)
                # if cv2.waitKey(1) & 0xFF == ord('q'):
                #     print("[INFO] 'q' pressed. Stopping gracefully...")
                #     break
    
    except KeyboardInterrupt:
        print(f"\n[INFO] Keyboard interrupt received at frame {frame_idx}. Stopping gracefully...")
    except Exception as e:
        print(f"[ERROR] {e}")
    finally:
        # Final cleanup
        print(f"[INFO] Finalizing processing at frame {frame_idx}...")
        csv_manager.update_tracking_file(stop_zone_history_dict)
        csv_manager.update_count_file(vehicle_type_counter)
        heat_map.save_heat_maps(first_frame)
        
        end_time = time.time()
        total_time = end_time - start_time
        avg_fps = frame_idx / total_time if total_time > 0 else 0
        
        print(f"[INFO] Total Time: {total_time:.2f}s, Frames: {frame_idx}, Avg FPS: {avg_fps:.2f}")
        cv2.destroyAllWindows()
        
        if check_shutdown():
            print("[INFO] Processing stopped by user request.")
        else:
            print("[INFO] Tracking and counting completed successfully.")

if __name__ == "__main__":
    main()
