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
from utils.video_streamer import video_streamer
from typing import Callable, Optional

class VideoProcessor:
    """Main video processing class that orchestrates all components with video-based schema"""
    
    def __init__(self, video_path=Config.VIDEO_PATH, output_video_path=Config.OUTPUT_VIDEO_PATH, mode="api", video_id: int = None, progress_callback: Optional[Callable[[int, Optional[int]], None]] = None, total_frames: Optional[int] = None, stream_url: str = None):
        self.video_path = video_path
        self.stream_url = stream_url  # New: stream URL for cloud processing
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
        self._last_detections = sv.Detections.empty()  # Store last detections for skipped frames
        
        # Tracking stability variables
        self._tracking_history = {}  # Store tracking history for smoothing
        self._stable_labels = {}  # Store stable labels to prevent flickering
        self._position_history = {}  # Store position history for tracking
        self._id_mapping = {}  # Map old IDs to new IDs for continuity
    
    def initialize(self):
        """Initialize all components for video processing with video-based schema"""
        print(f"[INFO] Running in database mode with video_id: {self.video_id}")
        print("[INFO] Database mode: Saving to database only with video linking")
        
        # Setup device
        device = self.device_manager.get_device()
        print(f"[INFO] Using {self.device_manager.get_gpu_info()}")
        
        # Initialize video info - handle both local files and stream URLs
        if self.stream_url:
            print(f"[INFO] 🌐 Processing from stream URL: {self.stream_url}")
            
            # TRUE STREAMING: Create signed URL for OpenCV streaming
            print(f"[INFO] 🚀 TRUE STREAMING: Creating signed URL for R2 stream...")
            try:
                from clients.r2_storage_client import R2StorageClient
                r2_client = R2StorageClient()
                
                # Extract filename from URL
                filename = self.stream_url.split('/')[-1]
                
                # Create signed URL that OpenCV can access (valid for 1 hour)
                import boto3
                signed_url = r2_client.s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': r2_client.bucket_name, 'Key': filename},
                    ExpiresIn=3600  # 1 hour
                )
                
                print(f"[INFO] ✅ Created signed URL for streaming")
                
                # Use OpenCV to get video info from signed URL
                cap = cv2.VideoCapture(signed_url)
                if not cap.isOpened():
                    raise RuntimeError("Could not open signed URL")
                
                # Get video properties directly from stream
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                fps = cap.get(cv2.CAP_PROP_FPS)
                total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                duration = total_frames / fps if fps > 0 else 0
                
                cap.release()
                
                # Create VideoInfo manually for streaming
                self.video_info = sv.VideoInfo(
                    width=width,
                    height=height,
                    fps=fps,
                    total_frames=total_frames
                )
                
                # Store signed URL for direct processing
                self.video_path = signed_url
                
                print(f"[INFO] ✅ TRUE STREAMING: {width}x{height} @ {fps}fps, {total_frames} frames, {duration:.1f}s")
                
            except Exception as e:
                print(f"[ERROR] Failed to stream from URL: {e}")
                # Fallback: download if streaming fails
                print(f"[INFO] Streaming failed, falling back to download...")
                try:
                    import tempfile
                    from clients.r2_storage_client import R2StorageClient
                    r2_client = R2StorageClient()
                    
                    # Extract filename from URL
                    filename = self.stream_url.split('/')[-1]
                    
                    # Create temporary file
                    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
                    temp_path = temp_file.name
                    temp_file.close()
                    
                    # Download using R2 client (with authentication)
                    print(f"[INFO] Downloading {filename} to {temp_path}...")
                    r2_client.s3_client.download_file(
                        r2_client.bucket_name,
                        filename,
                        temp_path
                    )
                    
                    print(f"[INFO] Video downloaded to: {temp_path}")
                    
                    # Use the downloaded file for processing
                    self.video_path = temp_path
                    self.video_info = sv.VideoInfo.from_video_path(self.video_path)
                    print(f"[INFO] Downloaded video info: {self.video_info.width}x{self.video_info.height} @ {self.video_info.fps}fps, {self.video_info.total_frames} frames")
                    
                except Exception as download_error:
                    print(f"[ERROR] Both streaming and download failed: {download_error}")
                    raise ValueError(f"Could not process video from stream URL: {self.stream_url}")
        else:
            self.video_info = sv.VideoInfo.from_video_path(self.video_path)
        
        # Set FPS to TARGET_FPS to prevent None values
        if Config.TARGET_FPS is not None:
            self.video_info.fps = Config.TARGET_FPS
            print(f"[INFO] FPS set to {Config.TARGET_FPS} (configured)")
        else:
            # Fallback to 30 if TARGET_FPS is None
            self.video_info.fps = 30.0
            print(f"[INFO] FPS set to 30.0 (fallback)")
        
        # Additional safety check
        if self.video_info.fps is None or self.video_info.fps <= 0:
            self.video_info.fps = 30.0
            print(f"[WARNING] FPS was invalid, set to 30.0")
        
        # Force output video to use the same FPS as input to prevent duration changes
        original_fps = self.video_info.fps
        print(f"[INFO] Output video will use FPS: {original_fps}")
        print(f"[INFO] Input video info: {self.video_info.width}x{self.video_info.height} @ {self.video_info.fps}fps, {self.video_info.total_frames} frames")
        if self.video_info.total_frames and self.video_info.fps:
            print(f"[INFO] Expected duration: {self.video_info.total_frames / self.video_info.fps:.2f} seconds")
        
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
        
        # Setup frame generator - TRUE STREAMING for URLs, normal for local files
        if self.stream_url:
            # Create a custom streaming frame generator
            self.frame_gen = self._create_streaming_frame_generator()
        else:
            # Use supervision's frame generator for local files
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
    
    def _create_streaming_frame_generator(self):
        """Create a true streaming frame generator that reads directly from signed URL"""
        def streaming_generator():
            # Use the signed URL (stored in self.video_path)
            cap = cv2.VideoCapture(self.video_path)
            if not cap.isOpened():
                raise RuntimeError(f"Could not open signed URL: {self.video_path}")
            
            frame_count = 0
            try:
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    
                    frame_count += 1
                    yield frame
                    
            finally:
                cap.release()
                print(f"[STREAMING] Processed {frame_count} frames directly from signed URL")
        
        return streaming_generator()
    
    def _initialize_components(self, device):
        """Initialize all processing components with performance optimizations"""
        self.heat_map = HeatMapGenerator(self.video_info.resolution_wh)
        self.vehicle_tracker = VehicleTracker()
        self.data_manager = DataManager()
        
        # Setup model and tracking with device selection and performance optimizations
        print(f"[INFO] Loading YOLO model: {Config.MODEL_PATH}")
        self.model = YOLO(Config.MODEL_PATH)
        self.model.to(device)
        self.model.fuse()
        
        # Performance optimizations
        if Config.ENABLE_FP16_PRECISION and device == "cuda":
            print("[INFO] Enabling FP16 precision for faster inference")
            self.model.half()
        
        if Config.ENABLE_MODEL_WARMUP:
            print("[INFO] Warming up model for optimal first inference")
            # Warmup with dummy input
            dummy_input = np.zeros((640, 640, 3), dtype=np.uint8)
            try:
                _ = self.model(dummy_input, verbose=False)
                print("[INFO] Model warmup completed")
            except Exception as e:
                print(f"[WARNING] Model warmup failed: {e}")
        
        # Initialize tracker with basic settings
        self.tracker = sv.ByteTrack(frame_rate=self.video_info.fps)

        # TEMPORARILY DISABLED - License plate model for performance
        # self.plate_model = YOLO(Config.LICENSE_PLATE_MODEL_PATH)
        # self.plate_model.to(device)
        # self.plate_model.fuse()
        
        print(f"[INFO] Models loaded on {device.upper()} with performance optimizations")
    
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
            # Use supervision VideoSink with streaming-compatible settings
            # CRITICAL: Force output FPS to match input FPS to prevent duration changes
            original_fps = self.video_info.fps
            print(f"[DEBUG] 🔍 Video info check: fps={original_fps}, total_frames={self.video_info.total_frames}, width={self.video_info.width}, height={self.video_info.height}")
            
            # Defensive check for None values
            if original_fps is None:
                print(f"[WARNING] ⚠️ FPS is None, setting to 30 as fallback")
                original_fps = 30.0
            if self.video_info.total_frames is None:
                print(f"[WARNING] ⚠️ total_frames is None, this may cause issues")
            
            output_video_info = sv.VideoInfo(
                width=self.video_info.width,
                height=self.video_info.height,
                fps=original_fps,  # CRITICAL: Use original FPS, not processing FPS
                total_frames=self.video_info.total_frames
            )
            print(f"[INFO] Creating output video with FPS: {output_video_info.fps} (original: {original_fps})")
            if self.video_info.total_frames and original_fps:
                print(f"[INFO] Expected output duration: {self.video_info.total_frames / original_fps:.2f} seconds")
            print(f"[INFO] GPU/CPU processing speed will NOT affect output video duration")
            
            # Validate FPS preservation
            if output_video_info.fps != original_fps:
                print(f"[WARNING] FPS mismatch detected! Output: {output_video_info.fps}, Original: {original_fps}")
                print(f"[WARNING] This may cause duration changes in the output video!")
            else:
                print(f"[INFO] ✅ FPS preservation confirmed: {output_video_info.fps} FPS")
            
            with sv.VideoSink(self.output_video_path, output_video_info) as sink:
                for frame in self.frame_gen:
                    # Check for shutdown request
                    if shutdown_manager.check_shutdown():
                        print(f"[INFO] Shutdown requested at frame {self.frame_idx}. Stopping gracefully...")
                        break
                    
                    self.frame_idx += 1
                    # Debug: Print every 100 frames
                    if self.frame_idx % 100 == 0:
                        print(f"[INFO] Processing frame {self.frame_idx}")
                    
                    # Debug: Check if we're processing too many frames
                    if self.video_info.total_frames and self.frame_idx > self.video_info.total_frames * 1.5:
                        print(f"[WARNING] Processing more frames than expected! Frame {self.frame_idx} vs total {self.video_info.total_frames}")
                        break
                    
                    # Progress callback (cap processing to 80%)
                    try:
                        if self.progress_callback:
                            self.progress_callback(self.frame_idx, self.total_frames)
                    except Exception:
                        pass
                    
                    # Skip frames for better performance (processing only, not output)
                    if self.frame_idx % self.frame_skip != 0:
                        continue
                    
                    # Additional frame skipping for processing performance (YOLO detection only)
                    should_process_detection = (self.frame_idx % Config.PROCESSING_FRAME_SKIP == 0)
                    
                    # Frame skipping for streaming to reduce bandwidth and improve quality
                    should_stream_frame = (self.frame_idx % getattr(Config, 'STREAMING_FRAME_SKIP', 3) == 0)
                    
                    # Process frame
                    if not self._process_frame(frame, sink, should_process_detection, should_stream_frame):
                        print(f"[ERROR] Frame processing failed at frame {self.frame_idx}")
                        break
                    
                    # Memory optimization - clear GPU memory periodically
                    if self.frame_idx % Config.MEMORY_CLEAR_INTERVAL == 0:
                        self.device_manager.clear_gpu_memory()
                        if self.frame_idx % (Config.MEMORY_CLEAR_INTERVAL * 5) == 0:
                            print(f"[INFO] Memory cleared at frame {self.frame_idx}")
                    
                    # Check for shutdown after processing each frame
                    if shutdown_manager.check_shutdown():
                        print(f"[INFO] Shutdown requested at frame {self.frame_idx}. Stopping gracefully...")
                        break
        
        except KeyboardInterrupt:
            print(f"\n[INFO] Keyboard interrupt received at frame {self.frame_idx}. Stopping gracefully...")
        except Exception as e:
            import traceback
            print(f"[ERROR] {e}")
            print(f"[ERROR] 🔍 FULL TRACEBACK:")
            traceback.print_exc()
        finally:
            # Post-process video for streaming compatibility
            self._make_video_streamable()
            self._finalize_processing()
    
    def _process_frame(self, frame, sink, should_process_detection=True, should_stream_frame=True):
        """Process a single frame"""
        try:
            # Detection and tracking (only when needed for performance)
            if should_process_detection:
                detections = self._perform_detection_and_tracking(frame)
                # Apply ID continuity to maintain stable tracking
                detections = self._maintain_id_continuity(detections)
                # Store detections for reuse in skipped frames
                self._last_detections = detections
            else:
                # Use previous detections for skipped frames - keep labels persistent
                detections = getattr(self, '_last_detections', sv.Detections.empty())
                # For skipped frames, use the exact same detections and labels
                # This ensures labels stay in the same position and don't flicker

            # License plate blurring is temporarily disabled for performance
            processed_frame = frame.copy()
            
            # Apply tracker ID offset for global uniqueness with safety check
            if hasattr(detections, 'tracker_id') and detections.tracker_id is not None and len(detections.tracker_id) > 0:
                try:
                    # Only apply offset if the IDs are not already offset
                    # Check if any ID is less than the offset (indicating they need offset)
                    min_id = min(detections.tracker_id)
                    if min_id < self.vehicle_processor.tracker_id_offset:
                        detections.tracker_id = [tid + self.vehicle_processor.tracker_id_offset for tid in detections.tracker_id]
                        print(f"[DEBUG] Applied offset: {min_id} -> {min(detections.tracker_id)}")
                except Exception as e:
                    print(f"[WARNING] Tracker ID offset failed: {e}")
                    # Create empty detections if tracker ID processing fails
                    detections = sv.Detections.empty()
            
            # Get anchor points with safety check
            try:
                anchor_pts = detections.get_anchors_coordinates(anchor=sv.Position.BOTTOM_CENTER)
                anchor_pts = anchor_pts + np.array([0, Config.ANCHOR_Y_OFFSET])
            except Exception as e:
                print(f"[WARNING] Anchor points calculation failed: {e}")
                anchor_pts = np.array([])
            
            # Update class consistency with safety check
            try:
                self.vehicle_tracker.update_class_consistency(detections)
            except Exception as e:
                print(f"[WARNING] Class consistency update failed: {e}")
            
            # Transform points for distance calculation with safety check
            try:
                transformed_pts = self.transformer.transform(anchor_pts).astype(float)
            except Exception as e:
                print(f"[WARNING] Point transformation failed: {e}")
                transformed_pts = np.array([])
            
            # Process detections with safety check
            try:
                if should_process_detection:
                    # Process new detections normally
                    top_labels, bottom_labels = self.vehicle_processor.process_detections(
                        detections, anchor_pts, transformed_pts
                    )
                    # Store labels for reuse in skipped frames
                    self._last_top_labels = top_labels
                    self._last_bottom_labels = bottom_labels
                else:
                    # For skipped frames, reuse the exact same labels
                    top_labels = getattr(self, '_last_top_labels', [])
                    bottom_labels = getattr(self, '_last_bottom_labels', [])
                
                # Apply tracking smoothing for stable labels
                if Config.ENABLE_TRACKING_SMOOTHING:
                    top_labels, bottom_labels = self._smooth_tracking_labels(
                        detections, top_labels, bottom_labels
                    )
            except Exception as e:
                print(f"[WARNING] Detection processing failed: {e}")
                top_labels, bottom_labels = [], []
            
            # Data is now collected during processing and saved at the end
            # No need to save during processing for better performance
            
            # Annotate frame with safety check and performance optimization
            try:
                # Always annotate frames but with optimized approach
                if len(detections) > 0:
                    # Use full annotation for better label consistency
                    annotated = self.annotation_manager.annotate_frame(processed_frame, detections, top_labels, bottom_labels)
                else:
                    # No detections, just copy frame
                    annotated = processed_frame.copy()
            except Exception as e:
                print(f"[WARNING] Frame annotation failed: {e}")
                annotated = processed_frame
            
            # Draw additional elements with safety checks
            try:
                self.annotation_manager.draw_anchor_points(annotated, anchor_pts)
            except Exception as e:
                print(f"[WARNING] Anchor points drawing failed: {e}")
            
            try:
                self.annotation_manager.draw_stop_zone(annotated)
            except Exception as e:
                print(f"[WARNING] Stop zone drawing failed: {e}")
            
            # Send frame to video streamer for live streaming with performance optimization
            try:
                if video_streamer.has_active_connections() and should_stream_frame:
                    # Minimal logging for performance
                    if self.frame_idx % 1000 == 0:
                        print(f"[VIDEO] 🎬 Sending frame {self.frame_idx} to video streamer")
                    video_streamer.update_frame(annotated)
            except Exception as e:
                print(f"[WARNING] Video streaming failed: {e}")
            
            # Output frame with safety check
            try:
                sink.write_frame(annotated)
            except Exception as e:
                print(f"[WARNING] Frame output failed: {e}")
                # Continue processing even if output fails
            
            # Handle display with safety check
            try:
                if not self.display_manager.handle_display(annotated, self.frame_idx):
                    return False
            except Exception as e:
                print(f"[WARNING] Display handling failed: {e}")
                # Continue processing even if display fails
            
            # Update FPS display with safety check
            try:
                self.display_manager.update_fps_display(self.frame_idx)
            except Exception as e:
                print(f"[WARNING] FPS display update failed: {e}")
                # Continue processing even if FPS display fails
            
            return True
            
        except Exception as e:
            print(f"[ERROR] Frame {self.frame_idx} processing failed: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    
    def _make_video_streamable(self):
        """Post-process video to make it streaming-compatible using FFmpeg"""
        try:
            import subprocess
            import tempfile
            from pathlib import Path
            
            # Check if output file exists
            if not Path(self.output_video_path).exists():
                print("[VIDEO] No output file to process for streaming")
                return
            
            # Check file size
            file_size = Path(self.output_video_path).stat().st_size
            print(f"[VIDEO] Output file size: {file_size} bytes")
            
            if file_size == 0:
                print("[VIDEO] Output file is empty, skipping FFmpeg conversion")
                return
            
            # Create temporary file for streaming-compatible version
            temp_path = str(Path(self.output_video_path).with_suffix('.tmp.mp4'))
            
            print("[VIDEO] Converting to streaming-compatible format...")
            
            # FFmpeg command optimized for good quality with reasonable speed
            cmd = [
                "ffmpeg",
                "-y",  # Overwrite output
                "-i", self.output_video_path,  # Input file
                "-c:v", "libx264",  # H.264 codec
                "-preset", "medium",   # Balanced speed/quality
                "-crf", "23",        # Good quality
                "-pix_fmt", "yuv420p",  # Compatible pixel format
                "-movflags", "+faststart",  # Enable fast start for streaming
                "-profile:v", "high",   # High profile for better quality
                "-level", "4.0",     # Level 4.0 for better quality
                "-c:a", "aac",       # Audio codec
                "-b:a", "128k",      # Good audio quality
                "-threads", "0",     # Use all available threads
                "-x264opts", "ref=3:bframes=2",  # Better quality settings
                temp_path
            ]
            
            # Run FFmpeg with timeout to prevent hanging
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)  # 5 minute timeout
            
            if result.returncode == 0:
                # Replace original with streaming-compatible version
                import shutil
                shutil.move(temp_path, self.output_video_path)
                print("[VIDEO] ✅ Video converted to streaming-compatible format")
            else:
                print(f"[ERROR] FFmpeg conversion failed: {result.stderr}")
                # Clean up temp file
                if Path(temp_path).exists():
                    Path(temp_path).unlink()
                    
        except subprocess.TimeoutExpired:
            print("[ERROR] FFmpeg conversion timed out after 5 minutes")
            # Clean up temp file
            if Path(temp_path).exists():
                Path(temp_path).unlink()
                    
        except FileNotFoundError:
            print("[WARNING] FFmpeg not found. Video may not be streaming-compatible.")
        except Exception as e:
            print(f"[ERROR] Failed to make video streamable: {e}")
    
    def _perform_detection_and_tracking(self, frame):
        """Perform object detection and tracking on frame with performance optimizations"""
        # Detection with GPU memory error handling and performance optimizations
        def detect():
            # Use optimized detection parameters
            result = self.model(frame, verbose=False, half=Config.ENABLE_FP16_PRECISION)[0]
            return result
        
        result = self.device_manager.handle_gpu_memory_error(detect)
        
        # Process detections
        detections = sv.Detections.from_ultralytics(result)
        
        # Limit detections for performance
        if len(detections) > Config.MAX_DETECTIONS_PER_FRAME:
            # Keep only the highest confidence detections
            if hasattr(detections, 'confidence') and detections.confidence is not None:
                sorted_indices = np.argsort(detections.confidence)[::-1]
                keep_indices = sorted_indices[:Config.MAX_DETECTIONS_PER_FRAME]
                detections = detections[keep_indices]
        
        # Debug: Print detection info (only for first few frames)
        if self.frame_idx <= 5:
            print(f"[DEBUG] Frame {self.frame_idx}: {len(detections)} detections")
            if len(detections) > 0:
                print(f"[DEBUG] Detection shapes: xyxy={detections.xyxy.shape if hasattr(detections, 'xyxy') else 'None'}, "
                      f"confidence={detections.confidence.shape if hasattr(detections, 'confidence') and detections.confidence is not None else 'None'}, "
                      f"class_id={detections.class_id.shape if hasattr(detections, 'class_id') else 'None'}")
        
        # Safe boolean indexing for confidence filtering
        if len(detections) > 0 and hasattr(detections, 'confidence') and detections.confidence is not None:
            try:
                confidence_mask = detections.confidence > Config.DETECTION_CONFIDENCE
                if len(confidence_mask) > 0 and len(confidence_mask) == len(detections):
                    detections = detections[confidence_mask]
                elif len(confidence_mask) == 0:
                    detections = sv.Detections.empty()
            except Exception as e:
                print(f"[WARNING] Confidence filtering failed: {e}")
                detections = sv.Detections.empty()
        
        # Safe boolean indexing for polygon zone filtering
        if len(detections) > 0:
            try:
                zone_mask = self.polygon_zone.trigger(detections)
                if len(zone_mask) > 0 and len(zone_mask) == len(detections):
                    detections = detections[zone_mask].with_nms(threshold=Config.NMS_THRESHOLD)
                else:
                    # Create empty detections if no detections in zone
                    detections = sv.Detections.empty()
            except Exception as e:
                print(f"[WARNING] Zone filtering failed: {e}")
                detections = sv.Detections.empty()
        else:
            # Create empty detections if no detections after confidence filtering
            detections = sv.Detections.empty()
        
        detections = self.vehicle_tracker.merge_overlapping_detections(detections)
        detections = self.tracker.update_with_detections(detections)
        
        # Heat map accumulation
        self.heat_map.accumulate(detections)
        
        return detections
    
    def _maintain_id_continuity(self, detections):
        """Maintain ID continuity to prevent label jumping"""
        if len(detections) == 0:
            return detections
        
        # Update position history for all detections
        for i, track_id in enumerate(detections.tracker_id):
            if hasattr(detections, 'xyxy') and i < len(detections.xyxy):
                bbox = detections.xyxy[i]
                center_x = (bbox[0] + bbox[2]) / 2
                center_y = (bbox[1] + bbox[3]) / 2
                
                if track_id not in self._position_history:
                    self._position_history[track_id] = []
                
                self._position_history[track_id].append((center_x, center_y))
                
                # Keep only recent positions
                if len(self._position_history[track_id]) > 10:
                    self._position_history[track_id] = self._position_history[track_id][-10:]
        
        # Try to match new detections with existing tracks
        new_tracker_ids = []
        for i, track_id in enumerate(detections.tracker_id):
            if track_id in self._id_mapping:
                # Use existing mapped ID
                new_tracker_ids.append(self._id_mapping[track_id])
            else:
                # Check if this detection matches a previous track by position
                if hasattr(detections, 'xyxy') and i < len(detections.xyxy):
                    bbox = detections.xyxy[i]
                    center_x = (bbox[0] + bbox[2]) / 2
                    center_y = (bbox[1] + bbox[3]) / 2
                    
                    # Find closest previous track
                    best_match_id = None
                    min_distance = float('inf')
                    
                    for old_id, positions in self._position_history.items():
                        if len(positions) > 0:
                            last_pos = positions[-1]
                            distance = ((center_x - last_pos[0])**2 + (center_y - last_pos[1])**2)**0.5
                            
                            # If close enough and not already mapped
                            if distance < 50 and old_id not in self._id_mapping.values():
                                if distance < min_distance:
                                    min_distance = distance
                                    best_match_id = old_id
                    
                    if best_match_id is not None:
                        # Map new ID to existing ID
                        self._id_mapping[track_id] = best_match_id
                        new_tracker_ids.append(best_match_id)
                    else:
                        # New track, keep original ID
                        new_tracker_ids.append(track_id)
                else:
                    new_tracker_ids.append(track_id)
        
        # Update tracker IDs with stable IDs
        if len(new_tracker_ids) == len(detections.tracker_id):
            detections.tracker_id = new_tracker_ids
        
        return detections
    
    def _smooth_tracking_labels(self, detections, top_labels, bottom_labels):
        """Smooth tracking labels to prevent flickering and maintain stability"""
        if len(detections) == 0:
            return top_labels, bottom_labels
        
        smoothed_top_labels = []
        smoothed_bottom_labels = []
        
        for i, track_id in enumerate(detections.tracker_id):
            # Get current labels
            current_top = top_labels[i] if i < len(top_labels) else ""
            current_bottom = bottom_labels[i] if i < len(bottom_labels) else ""
            
            # Initialize tracking history for new tracks
            if track_id not in self._tracking_history:
                self._tracking_history[track_id] = {
                    'top_labels': [],
                    'bottom_labels': [],
                    'frame_count': 0
                }
            
            # Update tracking history
            self._tracking_history[track_id]['top_labels'].append(current_top)
            self._tracking_history[track_id]['bottom_labels'].append(current_bottom)
            self._tracking_history[track_id]['frame_count'] += 1
            
            # Keep only recent history
            max_history = Config.TRACKING_HISTORY_LENGTH
            if len(self._tracking_history[track_id]['top_labels']) > max_history:
                self._tracking_history[track_id]['top_labels'] = self._tracking_history[track_id]['top_labels'][-max_history:]
                self._tracking_history[track_id]['bottom_labels'] = self._tracking_history[track_id]['bottom_labels'][-max_history:]
            
            # Use stable labels if available, otherwise use current
            if track_id in self._stable_labels:
                # Use stable labels for consistency
                smoothed_top_labels.append(self._stable_labels[track_id]['top'])
                smoothed_bottom_labels.append(self._stable_labels[track_id]['bottom'])
            else:
                # For new tracks, use current labels
                smoothed_top_labels.append(current_top)
                smoothed_bottom_labels.append(current_bottom)
                
                # Set stable labels after a few frames
                if self._tracking_history[track_id]['frame_count'] >= 3:
                    # Use most common label from history
                    top_history = self._tracking_history[track_id]['top_labels']
                    bottom_history = self._tracking_history[track_id]['bottom_labels']
                    
                    # Get most frequent label
                    from collections import Counter
                    top_counter = Counter(top_history)
                    bottom_counter = Counter(bottom_history)
                    
                    stable_top = top_counter.most_common(1)[0][0] if top_counter else current_top
                    stable_bottom = bottom_counter.most_common(1)[0][0] if bottom_counter else current_bottom
                    
                    self._stable_labels[track_id] = {
                        'top': stable_top,
                        'bottom': stable_bottom
                    }
        
        # Clean up old tracking data
        self._cleanup_tracking_history(detections.tracker_id)
        
        return smoothed_top_labels, smoothed_bottom_labels
    
    def _cleanup_tracking_history(self, current_track_ids):
        """Clean up tracking history for tracks that are no longer active"""
        current_set = set(current_track_ids)
        
        # Remove old tracking data
        tracks_to_remove = []
        for track_id in self._tracking_history:
            if track_id not in current_set:
                # Track is no longer active, check if we should remove it
                if self._tracking_history[track_id]['frame_count'] > Config.TRACKING_PREDICTION_FRAMES:
                    tracks_to_remove.append(track_id)
        
        for track_id in tracks_to_remove:
            del self._tracking_history[track_id]
            if track_id in self._stable_labels:
                del self._stable_labels[track_id]
    
    def _finalize_processing(self):
        """Finalize processing and cleanup with video stats update"""
        print(f"[INFO] Finalizing processing at frame {self.frame_idx} for video {self.video_id}...")
        
        # Clean up display manager (handles OpenCV GUI cleanup)
        if self.display_manager:
            self.display_manager.cleanup()
        
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
