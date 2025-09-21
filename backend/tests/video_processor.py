import cv2
import time
import sys
import os
import torch
import numpy as np
from ultralytics import YOLO
import supervision as sv

# Add the parent directory to the path so we can import from backend root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.config import Config
from utils.data_manager import DataManager
from utils.heatmap import HeatMapGenerator
from utils.view_transformer import ViewTransformer
from utils.vehicle_tracker import VehicleTracker
from utils.correlation_analysis import run_correlation_analysis
from utils.shutdown_manager import shutdown_manager
from utils.device_manager import DeviceManager
from utils.annotation_manager import AnnotationManager
from utils.display_manager import DisplayManager
from utils.vehicle_processor import VehicleProcessor
from utils.blur_utils import load_blur_model, blur_frame   # 🔹 NEW IMPORT


class VideoProcessor:
    """Main video processing class that orchestrates all components"""
    
    def __init__(self, video_path=Config.VIDEO_PATH, output_video_path=Config.OUTPUT_VIDEO_PATH, mode="local"):
        self.video_path = video_path
        self.output_video_path = output_video_path
        self.mode = mode
        
        # Initialize managers
        self.device_manager = DeviceManager()
        self.annotation_manager = AnnotationManager()
        self.display_manager = DisplayManager()
        
        # Initialize components
        self.video_info = None
        self.first_frame = None
        self.heat_map = None
        self.vehicle_tracker = None
        self.data_manager = None
        self.model = None
        self.tracker = None
        self.polygon_zone = None
        self.stop_zone = None
        self.transformer = None
        self.vehicle_processor = None
        self.blur_model = None   # 🔹 NEW VARIABLE
        
        # Processing variables
        self.frame_idx = 0
        self.start_time = time.time()
        self.frame_gen = None
        self.frame_skip = Config.DISPLAY_FRAME_SKIP if mode == "local" else 1
    
    def initialize(self):
        """Initialize all components for video processing"""
        print(f"[INFO] Running in {self.mode.upper()} mode")
        if self.mode == "local":
            print("[INFO] Local mode: Saving to CSV files only")
        elif self.mode == "api":
            print("[INFO] API mode: Saving to database only")
        
        # Setup device
        device = self.device_manager.get_device()
        print(f"[INFO] Using {self.device_manager.get_gpu_info()}")
        
        # Initialize video info
        self.video_info = sv.VideoInfo.from_video_path(self.video_path)
        self.video_info.fps = Config.TARGET_FPS
        
        # Get first frame for heat map overlay
        self._load_first_frame()
        
        # Initialize components
        self._initialize_components(device)
        
        # Setup zones and transformer
        self._setup_zones_and_transformer()
        
        # Initialize vehicle processor
        self.vehicle_processor = VehicleProcessor(self.vehicle_tracker, self.data_manager, self.mode)
        self.vehicle_processor.initialize_data()
        self.vehicle_processor.load_existing_counts()
        self.vehicle_processor.setup_tracker_offset()
        
        # Print initialization info
        self._print_initialization_info()
        
        # Setup frame generator
        self.frame_gen = sv.get_video_frames_generator(source_path=self.video_path)
        
        print(f"[INFO] Frame skip: {self.frame_skip} (for better responsiveness in local mode)")
    
    def _load_first_frame(self):
        """Load the first frame for heat map overlay"""
        cap0 = cv2.VideoCapture(self.video_path)
        ok, self.first_frame = cap0.read()
        cap0.release()
        if not ok:
            raise RuntimeError("Could not read first frame")
    
    def _initialize_components(self, device):
        """Initialize all processing components"""
        self.heat_map = HeatMapGenerator(self.video_info.resolution_wh)
        self.vehicle_tracker = VehicleTracker()
        self.data_manager = DataManager()
        
        # Setup model and tracking with device selection
        self.model = YOLO(Config.MODEL_PATH)
        self.model.to(device)
        self.model.fuse()
        self.tracker = sv.ByteTrack(frame_rate=self.video_info.fps)
        
        # 🔹 Load blur model once
        self.blur_model = load_blur_model(Config.MODEL_PATH)
        
        print(f"[INFO] Model loaded on {device.upper()}")
    
    def _setup_zones_and_transformer(self):
        """Setup detection zones and view transformer"""
        self.polygon_zone = sv.PolygonZone(polygon=Config.SOURCE_POLYGON)
        self.stop_zone = sv.PolygonZone(polygon=Config.STOP_ZONE_POLYGON)
        self.transformer = ViewTransformer(Config.SOURCE_POLYGON, (Config.TARGET_WIDTH, Config.TARGET_HEIGHT))
    
    def _print_initialization_info(self):
        """Print initialization information"""
        print(f"[INFO] Loaded {len(self.vehicle_processor.stop_zone_history_dict)} existing tracking records")
        print(f"[INFO] Loaded {len(self.vehicle_processor.counted_ids)} previously counted vehicles")
        print(f"[INFO] Loaded {len(self.vehicle_tracker.stationary_vehicles)} previously stationary vehicles")
        print(f"[INFO] Current vehicle counts: {dict(self.vehicle_processor.vehicle_type_counter)}")
    
    def process_video(self):
        """Main video processing loop"""
        try:
            with sv.VideoSink(self.output_video_path, self.video_info) as sink:
                for frame in self.frame_gen:
                    # Check for shutdown request
                    if shutdown_manager.check_shutdown():
                        print(f"[INFO] Shutdown requested at frame {self.frame_idx}. Stopping gracefully...")
                        break
                    
                    self.frame_idx += 1
                    
                    # Skip frames for better performance in local mode
                    if self.frame_idx % self.frame_skip != 0:
                        continue
                    
                    # Process frame
                    if not self._process_frame(frame, sink):
                        break
                    
                    # Check for shutdown after processing each frame
                    if shutdown_manager.check_shutdown():
                        print(f"[INFO] Shutdown requested at frame {self.frame_idx}. Stopping gracefully...")
                        break
        
        except KeyboardInterrupt:
            print(f"\n[INFO] Keyboard interrupt received at frame {self.frame_idx}. Stopping gracefully...")
        except Exception as e:
            print(f"[ERROR] {e}")
        finally:
            self._finalize_processing()
    
    def _process_frame(self, frame, sink):
        """Process a single frame"""
        # 🔹 Apply blurring first
        frame = blur_frame(frame, self.blur_model)
        
        # Detection and tracking
        detections = self._perform_detection_and_tracking(frame)
        
        # Apply tracker ID offset for global uniqueness
        detections.tracker_id = [tid + self.vehicle_processor.tracker_id_offset for tid in detections.tracker_id]
        
        # Get anchor points
        anchor_pts = detections.get_anchors_coordinates(anchor=sv.Position.BOTTOM_CENTER)
        anchor_pts = anchor_pts + np.array([0, Config.ANCHOR_Y_OFFSET])
        
        # Update class consistency
        self.vehicle_tracker.update_class_consistency(detections)
        
        # Transform points for distance calculation
        transformed_pts = self.transformer.transform(anchor_pts).astype(float)
        
        # Process detections
        top_labels, bottom_labels, csv_update_needed = self.vehicle_processor.process_detections(
            detections, anchor_pts, transformed_pts
        )
        
        # Save tracking data if needed
        if csv_update_needed:
            self.vehicle_processor.save_tracking_data(self.frame_idx)
        
        # Annotate frame
        annotated = self.annotation_manager.annotate_frame(frame, detections, top_labels, bottom_labels)
        
        # Draw additional elements
        self.annotation_manager.draw_anchor_points(annotated, anchor_pts)
        self.annotation_manager.draw_stop_zone(annotated)
        
        # Output frame
        sink.write_frame(annotated)
        
        # Handle display
        if not self.display_manager.handle_display(annotated, self.frame_idx):
            return False
        
        # Update FPS display
        self.display_manager.update_fps_display(self.frame_idx)
        
        return True
    
    def _perform_detection_and_tracking(self, frame):
        """Perform object detection and tracking on frame"""
        # Detection with GPU memory error handling
        def detect():
            result = self.model(frame, verbose=False)[0]
            return result
        
        result = self.device_manager.handle_gpu_memory_error(detect)
        
        # Process detections
        detections = sv.Detections.from_ultralytics(result)
        detections = detections[detections.confidence > Config.DETECTION_CONFIDENCE]
        detections = detections[self.polygon_zone.trigger(detections)].with_nms(threshold=Config.NMS_THRESHOLD)
        
        detections = self.vehicle_tracker.merge_overlapping_detections(detections)
        detections = self.tracker.update_with_detections(detections)
        
        # Heat map accumulation
        self.heat_map.accumulate(detections)
        
        return detections
    
    def _finalize_processing(self):
        """Finalize processing and cleanup"""
        print(f"[INFO] Finalizing processing at frame {self.frame_idx}...")
        
        # Save final tracking data
        if self.mode == "local":
            self.data_manager.update_tracking_file(self.vehicle_processor.stop_zone_history_dict, self.mode)
            print("[INFO] Local mode: Final tracking data saved to CSV files")
        else:
            if self.vehicle_processor.changed_records:
                print(f"[INFO] Saving {len(self.vehicle_processor.changed_records)} remaining changed records to database...")
                from clients.supabase_client import supabase_manager
                for track_id_str, data in self.vehicle_processor.changed_records.items():
                    supabase_manager.save_tracking_data(data)
            print("[INFO] API mode: Final tracking data saved to database")
        
        # Save heat maps
        self.heat_map.save_heat_maps(self.first_frame)
        
        # Print final statistics
        self._print_final_statistics()
        
        # Cleanup
        self.device_manager.clear_gpu_memory()
        self.display_manager.cleanup()
        
        if shutdown_manager.check_shutdown():
            print("[INFO] Processing stopped by user request.")
        else:
            print("[INFO] Tracking and counting completed successfully.")
    
    def _print_final_statistics(self):
        """Print final processing statistics"""
        end_time = time.time()
        total_time = end_time - self.start_time
        avg_fps = self.frame_idx / total_time if total_time > 0 else 0
        
        print(f"[INFO] Total Time: {total_time:.2f}s, Frames: {self.frame_idx}, Avg FPS: {avg_fps:.2f}")
    
    def get_session_data(self):
        """Get session data for return"""
        return self.vehicle_processor.get_session_data()

def main(video_path=Config.VIDEO_PATH, output_video_path=Config.OUTPUT_VIDEO_PATH, mode="local"):
    """Main processing function"""
    processor = VideoProcessor(video_path, output_video_path, mode)
    processor.initialize()
    processor.process_video()
    return processor.get_session_data()

if __name__ == "__main__":
    main()
