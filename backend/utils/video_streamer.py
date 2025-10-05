import asyncio
import json
import base64
import numpy as np
from typing import Dict, Set
from fastapi import WebSocket
import threading
import time
from concurrent.futures import ThreadPoolExecutor
import queue
from config.config import Config

# Conditional imports for different environments
try:
    import cv2
    # Set OpenCV to headless mode to avoid GUI issues on RunPod
    import os
    os.environ['OPENCV_VIDEOIO_PRIORITY_MSMF'] = '0'
    os.environ['OPENCV_VIDEOIO_PRIORITY_DSHOW'] = '0'
    os.environ['OPENCV_VIDEOIO_PRIORITY_V4L2'] = '0'
    os.environ['OPENCV_VIDEOIO_PRIORITY_GSTREAMER'] = '0'
    # Additional RunPod-specific OpenCV optimizations
    os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = 'rtbufsize;100000000'
    os.environ['OPENCV_VIDEOIO_DEBUG'] = '0'
    HAS_CV2 = True
    print("[STREAM] OpenCV available in headless mode")
except ImportError:
    HAS_CV2 = False
    print("[STREAM] OpenCV not available, using alternative methods")

# Detect RunPod environment
IS_RUNPOD = os.environ.get('RUNPOD_POD_ID') is not None or 'runpod' in os.environ.get('HOSTNAME', '').lower()
if IS_RUNPOD:
    print("[STREAM] RunPod environment detected - using optimized settings")

# Try to import GPU-accelerated libraries for RunPod
try:
    import cupy as cp
    HAS_CUPY = True
    print("[STREAM] CuPy available for GPU acceleration")
except ImportError:
    HAS_CUPY = False

try:
    import PIL.Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

class VideoStreamer:
    """High-performance video streaming with WebSocket support"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.streaming_active = False
        self.current_frame = None
        self.frame_lock = threading.Lock()
        self.connection_lock = threading.Lock()
        self.streaming_thread = None
        self.frame_queue = queue.Queue(maxsize=Config.STREAMING_QUEUE_SIZE)
        self.executor = ThreadPoolExecutor(max_workers=Config.STREAMING_WORKERS)
        
        # Performance settings from config with RunPod optimizations
        self.frame_skip = Config.STREAMING_FRAME_SKIP
        self.jpeg_quality = Config.STREAMING_JPEG_QUALITY
        self.max_frame_size = Config.STREAMING_MAX_FRAME_SIZE
        self.target_fps = getattr(Config, 'STREAMING_TARGET_FPS', 25)  # Lower FPS for RunPod
        
        # RunPod-specific optimizations
        if IS_RUNPOD:
            # Reduce quality slightly for better stability on RunPod
            self.jpeg_quality = min(85, self.jpeg_quality)
            # Smaller frame size for RunPod GPU efficiency
            self.max_frame_size = (min(960, self.max_frame_size[0]), min(540, self.max_frame_size[1]))
            print(f"[STREAM] RunPod optimizations applied: quality={self.jpeg_quality}, size={self.max_frame_size}")
        
        # Frame rate limiting for smooth playback
        self.last_frame_time = 0
        self.frame_interval = 1.0 / self.target_fps  # Time between frames in seconds
        
        # Logging counters
        self.frames_processed = 0
        self.frames_sent = 0
        self.connection_count = 0
        self._pending_message = None
        
        print(f"[STREAM] VideoStreamer initialized - ready for WebSocket connections")
        print(f"[STREAM] Settings: quality={self.jpeg_quality}, size={self.max_frame_size}, fps={self.target_fps}")
        
    async def connect(self, websocket: WebSocket, client_id: str):
        """Connect a new client to the video stream"""
        print(f"[STREAM] 🔌 Attempting to connect client: {client_id}")
        
        with self.connection_lock:
            self.active_connections[client_id] = websocket
            self.connection_count += 1
            
            # Start streaming if this is the first client
            if len(self.active_connections) == 1:
                print(f"[STREAM] 🚀 First client connected - starting video streaming")
                self.start_streaming()
            else:
                print(f"[STREAM] 📱 Additional client connected - streaming already active")
                
        print(f"[STREAM] ✅ Client {client_id} connected. Total clients: {len(self.active_connections)}")
        
    async def disconnect(self, client_id: str):
        """Disconnect a client from the video stream"""
        with self.connection_lock:
            if client_id in self.active_connections:
                del self.active_connections[client_id]
                self.connection_count -= 1  # Fixed: should be decrement, not increment
                
                # Stop streaming if no clients are left
                if len(self.active_connections) == 0:
                    print(f"[STREAM] 🛑 Last client disconnected - stopping video streaming")
                    self.stop_streaming()
                else:
                    print(f"[STREAM] 📱 Client disconnected - {len(self.active_connections)} clients remaining")
                    
        print(f"[STREAM] ❌ Client {client_id} disconnected. Total clients: {len(self.active_connections)}")
            
    def update_frame(self, frame: np.ndarray):
        """Update the current frame to be streamed - only when clients are connected"""
        # Only process frames if there are active connections
        if not self.has_active_connections():
            return
            
        try:
            self.frames_processed += 1
            
            # Don't skip frames - send all frames for smoother video
            # Simple resize without complex processing
            frame = self._quick_resize(frame)
            
            # Add frame to queue (allow more frames for smoother video)
            try:
                self.frame_queue.put_nowait(frame)
            except queue.Full:
                # Queue is full, skip this frame to maintain smoothness
                pass
            
            # Log every 100 frames for performance monitoring
            if self.frames_processed % 100 == 0:
                queue_size = self.frame_queue.qsize()
                active_connections = len(self.active_connections)
                print(f"[STREAM] 📊 Processed {self.frames_processed} frames, sent {self.frames_sent} frames, queue: {queue_size}, connections: {active_connections}")
                    
        except Exception as e:
            print(f"[STREAM] ❌ Error updating frame: {e}")
            
    def _quick_resize(self, frame: np.ndarray) -> np.ndarray:
        """Fixed GPU-accelerated resize for RunPod with proper color handling"""
        height, width = frame.shape[:2]
        max_width, max_height = self.max_frame_size
        
        if width > max_width or height > max_height:
            scale = min(max_width / width, max_height / height)
            new_width = int(width * scale)
            new_height = int(height * scale)
            
            # Ensure frame is in correct format (BGR for OpenCV)
            if len(frame.shape) == 3 and frame.shape[2] == 3:
                # Frame is already in BGR format
                pass
            else:
                print(f"[STREAM] Warning: Unexpected frame shape {frame.shape}")
                return frame
            
            # Use OpenCV for reliable resizing (avoid GPU issues on RunPod)
            if HAS_CV2:
                try:
                    # Use OpenCV with proper interpolation for better quality
                    frame = cv2.resize(frame, (new_width, new_height), interpolation=cv2.INTER_LINEAR)
                    return frame
                except Exception as e:
                    print(f"[STREAM] OpenCV resize failed: {e}")
            
            # Fallback to PIL with proper color handling
            if HAS_PIL:
                try:
                    # Convert BGR to RGB for PIL
                    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB) if HAS_CV2 else frame
                    pil_image = PIL.Image.fromarray(rgb_frame)
                    pil_resized = pil_image.resize((new_width, new_height), PIL.Image.LANCZOS)
                    # Convert back to BGR
                    resized_rgb = np.array(pil_resized)
                    if HAS_CV2:
                        frame = cv2.cvtColor(resized_rgb, cv2.COLOR_RGB2BGR)
                    else:
                        frame = resized_rgb
                    return frame
                except Exception as e:
                    print(f"[STREAM] PIL resize failed: {e}")
            
            # Simple numpy resize as last resort (preserve color channels)
            try:
                frame = np.array([[frame[int(i*height/new_height), int(j*width/new_width)] 
                                 for j in range(new_width)] for i in range(new_height)])
            except Exception as e:
                print(f"[STREAM] Numpy resize failed: {e}")
                return frame
            
        return frame
            
    def start_streaming(self):
        """Start the video streaming loop"""
        if not self.streaming_active:
            self.streaming_active = True
            self.streaming_thread = threading.Thread(target=self._streaming_loop, daemon=True)
            self.streaming_thread.start()
            print(f"[STREAM] 🎬 Video streaming started - thread ID: {self.streaming_thread.ident}")
        else:
            print(f"[STREAM] ⚠️ Streaming already active - ignoring start request")
            
    def stop_streaming(self):
        """Stop the video streaming loop"""
        if self.streaming_active:
            self.streaming_active = False
            if self.streaming_thread:
                self.streaming_thread.join(timeout=0.5)
            print(f"[STREAM] 🛑 Video streaming stopped - processed {self.frames_processed} frames, sent {self.frames_sent} frames")
        else:
            print(f"[STREAM] ⚠️ Streaming not active - ignoring stop request")
        
    def _streaming_loop(self):
        """Smooth streaming loop with proper frame rate control"""
        frame_count = 0
        last_log_time = time.time()
        print(f"[STREAM] 🔄 Streaming loop started - thread ID: {threading.current_thread().ident}")
        
        while self.streaming_active:
            try:
                # Get frame with timeout
                try:
                    frame = self.frame_queue.get(timeout=0.1)
                except queue.Empty:
                    time.sleep(0.01)
                    continue
                
                frame_count += 1
                current_time = time.time()
                
                # Frame rate limiting for smooth video
                time_since_last_frame = current_time - self.last_frame_time
                if time_since_last_frame < self.frame_interval:
                    time.sleep(self.frame_interval - time_since_last_frame)
                    current_time = time.time()
                
                # Encode and send frame
                try:
                    encoded_frame = self._fast_encode(frame)
                    
                    if encoded_frame:
                        self.frames_sent += 1
                        self.last_frame_time = current_time
                        
                        # Prepare message
                        message = {
                            "type": "frame",
                            "frame_data": encoded_frame,
                            "timestamp": current_time,
                            "frame_number": frame_count
                        }
                        
                        # Store message for async broadcast
                        self._pending_message = json.dumps(message)
                        
                        # Log performance every 5 seconds
                        if current_time - last_log_time >= 5.0:
                            fps = self.frames_sent / (current_time - (self.last_frame_time - self.frames_sent * self.frame_interval)) if self.frames_sent > 0 else 0
                            print(f"[STREAM] 📡 Sent {self.frames_sent} frames to {len(self.active_connections)} clients (FPS: {fps:.1f})")
                            last_log_time = current_time
                    else:
                        print(f"[STREAM] ⚠️ Frame encoding failed for frame {frame_count}")
                        
                except Exception as e:
                    print(f"[STREAM] ❌ Encoding error for frame {frame_count}: {e}")
                
            except Exception as e:
                print(f"[STREAM] ❌ Error in streaming loop: {e}")
                time.sleep(0.01)
                
        print(f"[STREAM] 🔄 Streaming loop ended - processed {frame_count} frames")
                
    def _fast_encode(self, frame: np.ndarray) -> str:
        """Fixed high-quality frame encoding for RunPod with proper color handling"""
        try:
            # Ensure frame is in correct format and data type
            if frame.dtype != np.uint8:
                frame = frame.astype(np.uint8)
            
            # Ensure frame has correct shape and color channels
            if len(frame.shape) != 3 or frame.shape[2] != 3:
                print(f"[STREAM] Warning: Invalid frame shape {frame.shape}")
                return None
            
            # Use OpenCV for reliable encoding (avoid GPU issues on RunPod)
            if HAS_CV2:
                try:
                    # Optimized encoding parameters for RunPod
                    encode_params = [
                        cv2.IMWRITE_JPEG_QUALITY, self.jpeg_quality,
                        cv2.IMWRITE_JPEG_OPTIMIZE, 1,
                        cv2.IMWRITE_JPEG_PROGRESSIVE, 0,  # Disable progressive for better compatibility
                        cv2.IMWRITE_JPEG_RST_INTERVAL, 0  # Disable restart intervals for streaming
                    ]
                    success, buffer = cv2.imencode('.jpg', frame, encode_params)
                    if success:
                        return base64.b64encode(buffer).decode('utf-8')
                    else:
                        print(f"[STREAM] OpenCV encoding failed")
                except Exception as e:
                    print(f"[STREAM] OpenCV encoding error: {e}")
            
            # Fallback to PIL with proper color handling
            if HAS_PIL:
                try:
                    # Convert BGR to RGB for PIL
                    if HAS_CV2:
                        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    else:
                        rgb_frame = frame
                    
                    pil_image = PIL.Image.fromarray(rgb_frame)
                    import io
                    buffer = io.BytesIO()
                    pil_image.save(buffer, format='JPEG', quality=self.jpeg_quality, optimize=True)
                    return base64.b64encode(buffer.getvalue()).decode('utf-8')
                except Exception as e:
                    print(f"[STREAM] PIL encoding error: {e}")
            
            # Last resort: simple base64 encoding (not recommended for production)
            print(f"[STREAM] Warning: Using fallback encoding method")
            return base64.b64encode(frame.tobytes()).decode('utf-8')
                
        except Exception as e:
            print(f"[STREAM] Encoding error: {e}")
            return None
                
    async def _broadcast_message(self, message: str):
        """Broadcast a message to all connected clients"""
        disconnected_clients = []
        
        with self.connection_lock:
            for client_id, websocket in self.active_connections.items():
                try:
                    await websocket.send_text(message)
                except Exception as e:
                    print(f"[STREAM] ❌ Failed to send to client {client_id}: {e}")
                    disconnected_clients.append(client_id)
                    
        # Clean up disconnected clients
        for client_id in disconnected_clients:
            print(f"[STREAM] 🧹 Cleaning up disconnected client: {client_id}")
            await self.disconnect(client_id)
            
    def get_connection_count(self) -> int:
        """Get number of active connections"""
        with self.connection_lock:
            return len(self.active_connections)
            
    def get_stats(self) -> dict:
        """Get comprehensive streaming statistics"""
        with self.connection_lock:
            return {
                "streaming_active": self.streaming_active,
                "active_connections": len(self.active_connections),
                "total_connections": self.connection_count,
                "frames_processed": self.frames_processed,
                "frames_sent": self.frames_sent,
                "queue_size": self.frame_queue.qsize(),
                "frame_skip": self.frame_skip,
                "jpeg_quality": self.jpeg_quality,
                "frame_size": self.max_frame_size,
                "thread_id": self.streaming_thread.ident if self.streaming_thread else None,
                "client_ids": list(self.active_connections.keys())
            }
    
    def print_status(self):
        """Print current streaming status to console"""
        stats = self.get_stats()
        print(f"\n[STREAM] 📊 Streaming Status Report:")
        print(f"  🎬 Streaming Active: {stats['streaming_active']}")
        print(f"  👥 Active Connections: {stats['active_connections']}")
        print(f"  📈 Total Connections: {stats['total_connections']}")
        print(f"  🎞️ Frames Processed: {stats['frames_processed']}")
        print(f"  📡 Frames Sent: {stats['frames_sent']}")
        print(f"  📦 Queue Size: {stats['queue_size']}")
        print(f"  🔧 Thread ID: {stats['thread_id']}")
        if stats['client_ids']:
            print(f"  👤 Connected Clients: {', '.join(stats['client_ids'])}")
        print()

    def has_active_connections(self) -> bool:
        """Check if there are any active connections."""
        with self.connection_lock:
            return bool(self.active_connections)

# Global instance
video_streamer = VideoStreamer()
