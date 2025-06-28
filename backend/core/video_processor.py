import cv2
import numpy as np
import time
from collections import Counter
from ultralytics import YOLO
import supervision as sv
from datetime import datetime
import sys
import threading
import os

# Add the parent directory to the path so we can import from backend root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.config import Config
from utils.data_manager import DataManager
from utils.heatmap import HeatMapGenerator
from utils.view_transformer import ViewTransformer
from utils.vehicle_tracker import VehicleTracker
from utils.correlation_analysis import run_correlation_analysis
from utils.supabase_manager import supabase_manager

# Global flag for graceful shutdown
shutdown_requested = False
shutdown_lock = threading.Lock()

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

def main(video_path=Config.VIDEO_PATH, output_video_path=Config.OUTPUT_VIDEO_PATH, mode="local"):
    """Main processing function
    
    Args:
        video_path: Path to input video
        output_video_path: Path to output video
        mode: "local" for CSV-only development, "api" for database-only API mode
    
    Returns:
        dict: Session data containing tracking_data and vehicle_counts for API mode
    """
    global shutdown_requested
    
    print(f"[INFO] Running in {mode.upper()} mode")
    if mode == "local":
        print("[INFO] Local mode: Saving to CSV files only")
    elif mode == "api":
        print("[INFO] API mode: Saving to database only")
    
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
    data_manager = DataManager()
    
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
    
    # Initialize CSV files and load existing data based on mode
    if mode == "local":
        # Local mode: Use CSV files
        data_manager.initialize_csv_files()
        stop_zone_history_dict = data_manager.read_existing_data()
        print("[INFO] Local mode: Using CSV files for data storage")
    else:
        # API mode: Use database - only get highest tracker_id for continuation
        data_manager.initialize_csv_files()  # Still initialize CSV for backup
        stop_zone_history_dict = {}  # Don't load all existing data
        print("[INFO] API mode: Using database for data storage")
    
    # Initialize tracking variables
    counted_ids = set()
    vehicle_type_counter = Counter()
    changed_records = {}  # Track only new/changed records for API mode
    
    # Track which tracker_ids were processed in this session (for API mode)
    session_tracker_ids = set()
    session_vehicle_counts = Counter()
    
    # Track session data for both modes
    session_tracking_data = []
    session_vehicle_counts_formatted = []
    
    # Load existing count data based on mode
    current_date = datetime.now().strftime("%Y-%m-%d")
    if mode == "local":
        # Local mode: Load from CSV
        try:
            existing_count_data = data_manager.read_existing_count_data()
            if current_date in existing_count_data:
                # Load existing counts for today
                vehicle_type_counter.update(existing_count_data[current_date])
                print(f"[INFO] Loaded existing counts for today: {dict(vehicle_type_counter)}")
            else:
                # If no data for today, start fresh
                print(f"[INFO] No existing counts for today, starting fresh")
        except Exception as e:
            print(f"[WARNING] Failed to load counts from CSV: {e}")
    else:
        # API mode: Load from database
        try:
            db_vehicle_counts = supabase_manager.get_vehicle_counts(limit=1000)
            for row in db_vehicle_counts:
                if row.get('date') and row.get('vehicle_type') and row.get('count'):
                    row_date = row['date'].split(' ')[0] if ' ' in row['date'] else row['date'].split('T')[0]
                    if row_date == current_date:
                        vehicle_type = row['vehicle_type']
                        count = int(row['count'])
                        vehicle_type_counter[vehicle_type] = count
            print(f"[INFO] Loaded counts from database: {dict(vehicle_type_counter)}")
        except Exception as e:
            print(f"[WARNING] Failed to load counts from database: {e}")
    
    tracker_types = {}
    
    # Get highest tracker_id for continuation (API mode only)
    if mode == "api":
        # Use the new method that gets the next available tracker_id
        next_tracker_id = data_manager.get_next_tracker_id()
        tracker_id_offset = next_tracker_id - 1  # Offset should be one less than the next ID
        if next_tracker_id > 1:
            print(f"[INFO] Continuing from tracker ID: {next_tracker_id}")
        else:
            print(f"[INFO] Starting fresh with tracker ID: {next_tracker_id}")
    else:
        # Local mode: Load existing stationary vehicles and mark existing vehicles as counted
        for track_id, data in stop_zone_history_dict.items():
            if data.get('status') == 'stationary':
                vehicle_tracker.stationary_vehicles.add(int(track_id))
            # Mark existing vehicles as already counted
            if data.get('tracker_id'):
                counted_ids.add(int(data.get('tracker_id')))
        
        # Restore tracker_id offset logic for global unique IDs
        max_track_id = max((int(tid) for tid in stop_zone_history_dict.keys() if tid.isdigit()), default=0)
        tracker_id_offset = max_track_id
        if max_track_id > 0:
            print(f"[INFO] Continuing from tracker ID: {tracker_id_offset + 1}")
    
    print(f"[INFO] Loaded {len(stop_zone_history_dict)} existing tracking records")
    print(f"[INFO] Loaded {len(counted_ids)} previously counted vehicles")
    print(f"[INFO] Loaded {len(vehicle_tracker.stationary_vehicles)} previously stationary vehicles")
    print(f"[INFO] Current vehicle counts: {dict(vehicle_type_counter)}")
    
    # Processing variables
    frame_idx = 0
    start_time = time.time()
    prev_fps_time = start_time
    frame_gen = sv.get_video_frames_generator(source_path=video_path)
    
    # Performance optimization for local mode
    frame_skip = Config.DISPLAY_FRAME_SKIP if mode == "local" else 1  # Use config for frame skipping
    print(f"[INFO] Frame skip: {frame_skip} (for better responsiveness in local mode)")
    
    try:
        with sv.VideoSink(output_video_path, video_info) as sink:
            for frame in frame_gen:
                # Check for shutdown request
                if check_shutdown():
                    print(f"[INFO] Shutdown requested at frame {frame_idx}. Stopping gracefully...")
                    break
                
                frame_idx += 1
                
                # Skip frames for better performance in local mode
                if frame_idx % frame_skip != 0:
                    continue
                
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
                            print(f"[DEBUG] Before increment: {vehicle_type} = {vehicle_type_counter[vehicle_type]}")
                            vehicle_type_counter[vehicle_type] += 1
                            counted_ids.add(track_id)
                            
                            # Track session data for both modes
                            session_tracker_ids.add(track_id)
                            session_vehicle_counts[vehicle_type] += 1
                            
                            print(f"[DEBUG] After increment: {vehicle_type} = {vehicle_type_counter[vehicle_type]}")
                            print(f"[DEBUG] Total counted vehicles: {len(counted_ids)}")
                            
                            # Update vehicle counts in real-time
                            if mode == "local":
                                # Local mode: Update CSV counts immediately
                                data_manager.update_count_file(vehicle_type_counter, mode)
                                print(f"[INFO] Vehicle counts updated in real-time: {dict(vehicle_type_counter)}")
                            else:
                                # API mode: Update database counts immediately
                                current_date = datetime.now().strftime("%Y-%m-%d")
                                supabase_manager.save_vehicle_count(vehicle_type, vehicle_type_counter[vehicle_type], current_date)
                                print(f"[INFO] Vehicle count updated in database: {vehicle_type} = {vehicle_type_counter[vehicle_type]}")
                            
                            # Don't save tracking data immediately - save at the end to prevent multiple saves
                        
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
                            # Update both the existing data cache and the changed records
                            stop_zone_history_dict[str(track_id)] = current_record
                            # Track changed records for both modes
                            changed_records[str(track_id)] = current_record
                            csv_update_needed = True
                            print(f"[DEBUG] Added/updated vehicle {track_id} in changed records. Changed records: {len(changed_records)}")
                
                # Update CSV files if needed
                if csv_update_needed:
                    print(f"[DEBUG] Updating tracking data at frame {frame_idx}")
                    
                    if mode == "local":
                        # Local mode: Save to CSV
                        if data_manager.update_tracking_file(stop_zone_history_dict, mode):
                            print(f"[INFO] Tracking data saved to CSV at frame {frame_idx}")
                    else:
                        # API mode: Save only new/changed records to database
                        for track_id_str, data in changed_records.items():
                            print(f"[DEBUG] Saving new/changed to DB: track_id={data.get('tracker_id')}, type={data.get('vehicle_type')}, status={data.get('status')}")
                            supabase_manager.save_tracking_data(data)
                        
                        if changed_records:
                            print(f"[INFO] Saved {len(changed_records)} new/changed records to database")
                            # Clear changed records after saving
                            changed_records.clear()
                    
                    # Reset the flag to prevent duplicate saves
                    csv_update_needed = False
                
                # Check for shutdown after processing each frame
                if check_shutdown():
                    print(f"[INFO] Shutdown requested at frame {frame_idx}. Stopping gracefully...")
                    break
                
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
                if mode == "local" and Config.ENABLE_DISPLAY:
                    # Resize frame for display if too large
                    display_frame = annotated.copy()
                    height, width = display_frame.shape[:2]
                    if width > Config.MAX_DISPLAY_WIDTH:  # Use config for max width
                        scale = Config.MAX_DISPLAY_WIDTH / width
                        new_width = int(width * scale)
                        new_height = int(height * scale)
                        display_frame = cv2.resize(display_frame, (new_width, new_height))
                    
                    cv2.imshow("Tracking with Stop", display_frame)
                    
                    # Handle keyboard input and window events
                    key = cv2.waitKey(Config.DISPLAY_WAIT_KEY_DELAY) & 0xFF
                    if key == ord('q'):
                        print("[INFO] 'q' pressed. Stopping gracefully...")
                        break
                    elif key == ord('p'):
                        print("[INFO] 'p' pressed. Pausing... Press any key to continue...")
                        cv2.waitKey(0)
                    elif key == ord('s'):
                        print("[INFO] 's' pressed. Saving current frame...")
                        cv2.imwrite(f"debug_frame_{frame_idx}.jpg", annotated)
                    elif key == ord('h'):
                        print("[INFO] 'h' pressed. Displaying help...")
                        print("Controls: q=quit, p=pause, s=save frame, h=help")
                        cv2.waitKey(2000)  # Show help for 2 seconds
                
                # Update FPS display
                if frame_idx % Config.FPS_UPDATE_INTERVAL == 0:
                    now = time.time()
                    fps = Config.FPS_UPDATE_INTERVAL / (now - prev_fps_time)
                    prev_fps_time = now
                    print(f"[INFO] FPS: {fps:.2f}")
                
                # Check for shutdown every frame for better responsiveness
                if check_shutdown():
                    print(f"[INFO] Shutdown requested at frame {frame_idx}. Stopping gracefully...")
                    break
    
    except KeyboardInterrupt:
        print(f"\n[INFO] Keyboard interrupt received at frame {frame_idx}. Stopping gracefully...")
    except Exception as e:
        print(f"[ERROR] {e}")
    finally:
        # Final cleanup
        print(f"[INFO] Finalizing processing at frame {frame_idx}...")
        
        if mode == "local":
            # Local mode: Save to CSV only
            data_manager.update_tracking_file(stop_zone_history_dict, mode)
            # Vehicle counts are already saved in real-time, no need to save again
            print("[INFO] Local mode: Final tracking data saved to CSV files")
        else:
            # API mode: Save remaining changed records to database only
            if changed_records:
                print(f"[INFO] Saving {len(changed_records)} remaining changed records to database...")
                for track_id_str, data in changed_records.items():
                    supabase_manager.save_tracking_data(data)
            
            # Vehicle counts are already saved in real-time, no need to save again
            print("[INFO] API mode: Final tracking data saved to database")
        
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

        # Prepare session data for both modes
        session_data = {}
        if mode == "api":
            # API mode: Get tracking data only for session tracker_ids from database
            session_tracking_data = []
            try:
                if session_tracker_ids:
                    # Get tracking data from database for session tracker_ids only
                    for tracker_id in session_tracker_ids:
                        result = supabase_manager.client.table("tracking_results") \
                            .select("*") \
                            .eq("tracker_id", tracker_id) \
                            .execute()
                        if result.data:
                            session_tracking_data.extend(result.data)
                    
                    print(f"[INFO] Session tracking data: {len(session_tracking_data)} records for tracker_ids: {list(session_tracker_ids)}")
                else:
                    print("[INFO] No session tracking data (no vehicles processed)")
            except Exception as e:
                print(f"[WARNING] Failed to get session tracking data: {e}")
            
            # Format vehicle counts for session
            session_vehicle_counts_formatted = []
            current_date = datetime.now().strftime("%Y-%m-%d")
            for vehicle_type, count in session_vehicle_counts.items():
                session_vehicle_counts_formatted.append({
                    "vehicle_type": vehicle_type,
                    "count": count,
                    "date": current_date
                })
            
            session_data = {
                "tracking_data": session_tracking_data,
                "vehicle_counts": session_vehicle_counts_formatted
            }
            print(f"[INFO] Session vehicle counts: {dict(session_vehicle_counts)}")
        else:
            # Local mode: Get tracking data from CSV for session tracker_ids
            session_tracking_data = []
            try:
                if session_tracker_ids:
                    # Read from CSV and filter for session tracker_ids
                    csv_data = data_manager.read_existing_data()
                    for track_id_str, data in csv_data.items():
                        if data.get('tracker_id') in session_tracker_ids:
                            # Convert CSV data format to match database format
                            session_record = {
                                "tracker_id": data.get('tracker_id'),
                                "vehicle_type": data.get('vehicle_type'),
                                "status": data.get('status'),
                                "compliance": data.get('compliance'),
                                "reaction_time": data.get('reaction_time'),
                                "date": data.get('date'),
                                "created_at": data.get('date'),  # Use date as created_at for CSV
                                "updated_at": data.get('date')   # Use date as updated_at for CSV
                            }
                            session_tracking_data.append(session_record)
                    
                    print(f"[INFO] Session tracking data: {len(session_tracking_data)} records for tracker_ids: {list(session_tracker_ids)}")
                else:
                    print("[INFO] No session tracking data (no vehicles processed)")
            except Exception as e:
                print(f"[WARNING] Failed to get session tracking data from CSV: {e}")
            
            # Format vehicle counts for session
            session_vehicle_counts_formatted = []
            current_date = datetime.now().strftime("%Y-%m-%d")
            for vehicle_type, count in session_vehicle_counts.items():
                session_vehicle_counts_formatted.append({
                    "vehicle_type": vehicle_type,
                    "count": count,
                    "date": current_date
                })
            
            session_data = {
                "tracking_data": session_tracking_data,
                "vehicle_counts": session_vehicle_counts_formatted
            }
            print(f"[INFO] Session vehicle counts: {dict(session_vehicle_counts)}")

        return session_data

if __name__ == "__main__":
    main()
