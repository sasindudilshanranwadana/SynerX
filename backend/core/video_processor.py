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
from typing import Callable, Optional

class VideoProcessor:
    """Main video processing class that orchestrates all components with video-based schema"""
    
    def __init__(self, video_path=Config.VIDEO_PATH, output_video_path=Config.OUTPUT_VIDEO_PATH, mode="api", video_id: int = None, progress_callback: Optional[Callable[[int, Optional[int]], None]] = None, total_frames: Optional[int] = None):
        self.video_path = video_path
        self.output_video_path = output_video_path
        self.mode = mode  # Kept for compatibility but always uses database
        self.video_id = video_id  # New: video ID for linking data to database
        self.progress_callback = progress_callback
        self.total_frames = total_frames
        
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
        # self.plate_model = None  # TEMPORARILY DISABLED
        self.tracker = None
        self.polygon_zone = None
        self.stop_zone = None
        self.transformer = None
        self.vehicle_processor = None
        
        # Processing variables
        self.frame_idx = 0
        self.start_time = time.time()
        self.frame_gen = None
        self.frame_skip = 1  # Always process all frames for API mode
    
    def initialize(self):
        """Initialize all components for video processing with video-based schema"""
        print(f"[INFO] Running in database mode with video_id: {self.video_id}")
        print("[INFO] Database mode: Saving to database only with video linking")
        
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
        
        # Initialize vehicle processor with video_id
        self.vehicle_processor = VehicleProcessor(self.vehicle_tracker, self.data_manager, self.mode, self.video_id)
        self.vehicle_processor.initialize_data()
        self.vehicle_processor.load_existing_counts()
        self.vehicle_processor.setup_tracker_offset()
        
        # Print initialization info
        self._print_initialization_info()
        
        # Setup frame generator
        self.frame_gen = sv.get_video_frames_generator(source_path=self.video_path)
        
        # Video streaming will start automatically when first WebSocket client connects
        # No need to start it here for better performance
        
        print(f"[INFO] Frame skip: {self.frame_skip} (for optimal responsiveness)")
        print(f"[INFO] Processing frame skip: {Config.PROCESSING_FRAME_SKIP} (for better performance)")
    
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

        # TEMPORARILY DISABLED - License plate model for performance
        # self.plate_model = YOLO(Config.LICENSE_PLATE_MODEL_PATH)
        # self.plate_model.to(device)
        # self.plate_model.fuse()
        
        print(f"[INFO] Models loaded on {device.upper()}")
    
    def _setup_zones_and_transformer(self):
        """Setup detection zones and view transformer"""
        self.polygon_zone = sv.PolygonZone(polygon=Config.SOURCE_POLYGON)
        self.stop_zone = sv.PolygonZone(polygon=Config.STOP_ZONE_POLYGON)
        self.transformer = ViewTransformer(Config.SOURCE_POLYGON, (Config.TARGET_WIDTH, Config.TARGET_HEIGHT))
    
    def _print_initialization_info(self):
        """Print initialization information"""
        print(f"[INFO] Loaded {len(self.vehicle_processor.stop_zone_history_dict)} existing tracking records for video {self.video_id}")
        print(f"[INFO] Loaded {len(self.vehicle_processor.counted_ids)} previously counted vehicles for video {self.video_id}")
        print(f"[INFO] Loaded {len(self.vehicle_tracker.stationary_vehicles)} previously stationary vehicles for video {self.video_id}")
        print(f"[INFO] Current vehicle counts for video {self.video_id}: {dict(self.vehicle_processor.vehicle_type_counter)}")
    
    def blur_license_plates(self, frame):
        """
        Finds and blurs license plates using a dedicated YOLO model.
        This is the accurate method for high-angle footage.
        TEMPORARILY DISABLED FOR PERFORMANCE
        """
        # TEMPORARILY DISABLED - Return frame as-is for better performance
        return frame


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
                    # Progress callback (cap processing to 80%)
                    try:
                        if self.progress_callback:
                            self.progress_callback(self.frame_idx, self.total_frames)
                    except Exception:
                        pass
                    
                    # Skip frames for better performance
                    if self.frame_idx % self.frame_skip != 0:
                        continue
                    
                    # Additional frame skipping for processing performance
                    if self.frame_idx % Config.PROCESSING_FRAME_SKIP != 0:
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
        # Detection and tracking
        detections = self._perform_detection_and_tracking(frame)

        # License plate blurring is temporarily disabled for performance
        processed_frame = frame.copy()
        
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
        top_labels, bottom_labels = self.vehicle_processor.process_detections(
            detections, anchor_pts, transformed_pts
        )
        
        # Data is now collected during processing and saved at the end
        # No need to save during processing for better performance
        
        # Annotate frame
        annotated = self.annotation_manager.annotate_frame(processed_frame, detections, top_labels, bottom_labels)
        
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
        
        # Version-compatible boolean indexing for confidence filtering
        confidence_mask = detections.confidence > Config.DETECTION_CONFIDENCE
        if len(confidence_mask) > 0:
            detections = detections[confidence_mask]
        
        # Version-compatible boolean indexing for polygon zone filtering
        if len(detections) > 0:
            zone_mask = self.polygon_zone.trigger(detections)
            if len(zone_mask) > 0:
                detections = detections[zone_mask].with_nms(threshold=Config.NMS_THRESHOLD)
            else:
                # Create empty detections if no detections in zone
                detections = sv.Detections.empty()
        else:
            # Create empty detections if no detections after confidence filtering
            detections = sv.Detections.empty()
        
        detections = self.vehicle_tracker.merge_overlapping_detections(detections)
        detections = self.tracker.update_with_detections(detections)
        
        # Heat map accumulation
        self.heat_map.accumulate(detections)
        
        return detections
    
    def _finalize_processing(self):
        """Finalize processing and cleanup with video stats update"""
        print(f"[INFO] Finalizing processing at frame {self.frame_idx} for video {self.video_id}...")
        
        # Check if there's any data to save (regardless of cancellation)
        has_tracking_data = len(self.vehicle_processor.changed_records) > 0
        has_vehicle_counts = len(self.vehicle_processor.vehicle_type_counter) > 0
        has_any_data = has_tracking_data or has_vehicle_counts
        
        if has_any_data:
            # There's data to save, save it regardless of cancellation
            print(f"[INFO] Found data to save: {len(self.vehicle_processor.changed_records)} tracking records, {len(self.vehicle_processor.vehicle_type_counter)} vehicle counts for video {self.video_id}")
            self.vehicle_processor.save_all_data_at_end()
            
            # Save heat maps
            self.heat_map.save_heat_maps(self.first_frame)
            
            # Update video statistics in database
            self._update_video_stats()
            
            # Print final statistics
            self._print_final_statistics()
            
            if shutdown_manager.check_shutdown():
                print(f"[INFO] Processing was interrupted but saved partial data for video {self.video_id}.")
            else:
                print(f"[INFO] Tracking and counting completed successfully for video {self.video_id}.")
        else:
            # No data to save
            if shutdown_manager.check_shutdown():
                print(f"[INFO] Processing was cancelled for video {self.video_id}. No data to save.")
            else:
                print(f"[INFO] Processing completed for video {self.video_id} but no data was collected.")
        
        # Cleanup (always do this regardless of cancellation)
        self.device_manager.clear_gpu_memory()
        # Stop streaming only if it's active (when clients were connected)
        if self.display_manager.streaming_active:
            self.display_manager.stop_streaming()
        self.display_manager.cleanup()
    
    def _update_video_stats(self):
        """Update video processing statistics in database - now handled in main.py"""
        # This method is kept for compatibility but video stats are now updated in main.py
        # after the data is saved to ensure accurate statistics
        pass
    
    def _print_final_statistics(self):
        """Print final processing statistics"""
        end_time = time.time()
        total_time = end_time - self.start_time
        avg_fps = self.frame_idx / total_time if total_time > 0 else 0
        
        print(f"[INFO] Video {self.video_id} - Total Time: {total_time:.2f}s, Frames: {self.frame_idx}, Avg FPS: {avg_fps:.2f}")
    
    def get_session_data(self):
        """Get session data for return with video_id filtering"""
        return self.vehicle_processor.get_session_data()

def main(video_path=Config.VIDEO_PATH, output_video_path=Config.OUTPUT_VIDEO_PATH, mode="api", video_id: int = None):
    """Main processing function with video-based schema
    
    Args:
        video_path: Path to input video
        output_video_path: Path to output video
        mode: Always "api" for database-only mode
        video_id: Video ID for linking data to database
    
    Returns:
        dict: Session data containing tracking_data and vehicle_counts
    """
    processor = VideoProcessor(video_path, output_video_path, mode, video_id)
    processor.initialize()
    processor.process_video()
    return processor.get_session_data()

if __name__ == "__main__":
    main()
