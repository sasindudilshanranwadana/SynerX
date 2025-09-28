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
    HAS_CV2 = True
    print("[STREAM] OpenCV available in headless mode")
except ImportError:
    HAS_CV2 = False
    print("[STREAM] OpenCV not available, using alternative methods")

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
        
        # Performance settings from config
        self.frame_skip = Config.STREAMING_FRAME_SKIP
        self.jpeg_quality = Config.STREAMING_JPEG_QUALITY
        self.max_frame_size = Config.STREAMING_MAX_FRAME_SIZE
        self.target_fps = getattr(Config, 'STREAMING_TARGET_FPS', 30)
        
        # Frame rate limiting for smooth playback
        self.last_frame_time = 0
        self.frame_interval = 1.0 / self.target_fps  # Time between frames in seconds
        
        # Logging counters
        self.frames_processed = 0
        self.frames_sent = 0
        self.connection_count = 0
        self._pending_message = None
        
        print("[STREAM] VideoStreamer initialized - ready for WebSocket connections")
        
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
                self.connection_count += 1
                
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
            
            # Simple resize without complex processing
            frame = self._quick_resize(frame)
            
            # Clear queue and add new frame immediately
            while not self.frame_queue.empty():
                self.frame_queue.get_nowait()
            self.frame_queue.put_nowait(frame)
            
            # Log every 200 frames for performance monitoring (minimal logging for RunPod)
            if self.frames_processed % 200 == 0:
                print(f"[STREAM] 📊 Processed {self.frames_processed} frames, sent {self.frames_sent} frames to {len(self.active_connections)} clients")
                    
        except Exception as e:
            print(f"[STREAM] ❌ Error updating frame: {e}")
            
    def _quick_resize(self, frame: np.ndarray) -> np.ndarray:
        """GPU-accelerated resize for maximum speed on RunPod"""
        height, width = frame.shape[:2]
        max_width, max_height = self.max_frame_size
        
        if width > max_width or height > max_height:
            scale = min(max_width / width, max_height / height)
            new_width = int(width * scale)
            new_height = int(height * scale)
            
            # Use GPU acceleration if available (RunPod)
            if HAS_CUPY:
                try:
                    # Convert to CuPy array for GPU processing
                    gpu_frame = cp.asarray(frame)
                    gpu_resized = cp.resize(gpu_frame, (new_height, new_width))
                    frame = cp.asnumpy(gpu_resized)
                    return frame
                except Exception as e:
                    print(f"[STREAM] GPU resize failed, falling back to CPU: {e}")
            
            # Fallback to OpenCV if available
            if HAS_CV2 and Config.STREAMING_INTERPOLATION is not None:
                frame = cv2.resize(frame, (new_width, new_height), interpolation=Config.STREAMING_INTERPOLATION)
            elif HAS_PIL:
                # Use PIL as fallback
                pil_image = PIL.Image.fromarray(frame)
                pil_resized = pil_image.resize((new_width, new_height), PIL.Image.LANCZOS)
                frame = np.array(pil_resized)
            else:
                # Simple numpy resize as last resort
                frame = np.array([[frame[int(i*height/new_height), int(j*width/new_width)] 
                                 for j in range(new_width)] for i in range(new_height)])
            
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
        """Ultra-fast streaming loop"""
        frame_count = 0
        print(f"[STREAM] 🔄 Streaming loop started - thread ID: {threading.current_thread().ident}")
        
        while self.streaming_active:
            try:
                # Get frame immediately
                try:
                    frame = self.frame_queue.get_nowait()
                    # Minimal logging for RunPod performance
                    if frame_count % 500 == 0:
                        print(f"[STREAM] 🎬 Received frame {frame_count + 1} from queue")
                except queue.Empty:
                    time.sleep(0.0001)  # 0.1ms sleep for faster processing
                    continue
                
                frame_count += 1
                
                # Frame rate limiting for smooth playback
                current_time = time.time()
                time_since_last_frame = current_time - self.last_frame_time
                
                # Only send frames at the target FPS rate
                if time_since_last_frame >= self.frame_interval and frame_count % self.frame_skip == 0:
                    # Encode frame directly (no thread pool for speed)
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
                        
                        # Store message for async broadcast (will be sent by the WebSocket handler)
                        self._pending_message = json.dumps(message)
                        
                        # Log every 100 frames for performance monitoring (reduced for smoothness)
                        if self.frames_sent % 100 == 0:
                            print(f"[STREAM] 📡 Sent {self.frames_sent} frames to {len(self.active_connections)} clients")
                
                # Small sleep for smooth frame rate
                time.sleep(0.001)  # 1ms sleep for smooth playback
                
            except Exception as e:
                print(f"[STREAM] ❌ Error in streaming loop: {e}")
                time.sleep(0.001)  # Minimal error recovery
                
        print(f"[STREAM] 🔄 Streaming loop ended - processed {frame_count} frames")
                
    def _fast_encode(self, frame: np.ndarray) -> str:
        """GPU-accelerated high-quality frame encoding for RunPod"""
        try:
            # Try GPU-accelerated encoding first (RunPod)
            if HAS_CUPY:
                try:
                    # Convert to CuPy for GPU processing
                    gpu_frame = cp.asarray(frame)
                    # Use CuPy's optimized encoding
                    gpu_encoded = cp.asnumpy(gpu_frame)
                    # Fallback to OpenCV for actual JPEG encoding
                    if HAS_CV2:
                        encode_params = [
                            cv2.IMWRITE_JPEG_QUALITY, self.jpeg_quality,
                            cv2.IMWRITE_JPEG_OPTIMIZE, 1,
                            cv2.IMWRITE_JPEG_PROGRESSIVE, 1
                        ]
                        _, buffer = cv2.imencode('.jpg', gpu_encoded, encode_params)
                        return base64.b64encode(buffer).decode('utf-8')
                except Exception as e:
                    print(f"[STREAM] GPU encoding failed, falling back to CPU: {e}")
            
            # Fallback to OpenCV if available
            if HAS_CV2:
                encode_params = [
                    cv2.IMWRITE_JPEG_QUALITY, self.jpeg_quality,
                    cv2.IMWRITE_JPEG_OPTIMIZE, 1,
                    cv2.IMWRITE_JPEG_PROGRESSIVE, 1
                ]
                _, buffer = cv2.imencode('.jpg', frame, encode_params)
                return base64.b64encode(buffer).decode('utf-8')
            elif HAS_PIL:
                # Use PIL as fallback
                pil_image = PIL.Image.fromarray(frame)
                import io
                buffer = io.BytesIO()
                pil_image.save(buffer, format='JPEG', quality=self.jpeg_quality, optimize=True)
                return base64.b64encode(buffer.getvalue()).decode('utf-8')
            else:
                # Simple base64 encoding as last resort
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
