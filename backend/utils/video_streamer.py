import asyncio
import json
import base64
import cv2
import numpy as np
from typing import Dict, Set
from fastapi import WebSocket
import threading
import time
from concurrent.futures import ThreadPoolExecutor
import queue

class VideoStreamer:
    """High-performance video streaming with WebSocket support"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.streaming_active = False
        self.current_frame = None
        self.frame_lock = threading.Lock()
        self.connection_lock = threading.Lock()
        self.streaming_thread = None
        self.frame_queue = queue.Queue(maxsize=2)  # Very small buffer for minimal latency
        self.executor = ThreadPoolExecutor(max_workers=2)  # Reduced workers
        
        # Performance settings - maximum speed
        self.frame_skip = 1  # Send every frame for maximum responsiveness
        self.jpeg_quality = 60  # Lower quality for maximum speed
        self.max_frame_size = (640, 480)  # Smaller frames for maximum speed
        
    async def connect(self, websocket: WebSocket, client_id: str):
        """Connect a new client to the video stream"""
        await websocket.accept()
        with self.connection_lock:
            self.active_connections[client_id] = websocket
        print(f"[STREAM] Client {client_id} connected. Total clients: {len(self.active_connections)}")
        
    async def disconnect(self, client_id: str):
        """Disconnect a client from the video stream"""
        with self.connection_lock:
            if client_id in self.active_connections:
                del self.active_connections[client_id]
        print(f"[STREAM] Client {client_id} disconnected. Total clients: {len(self.active_connections)}")
            
    def update_frame(self, frame: np.ndarray):
        """Update the current frame to be streamed - simplified for speed"""
        try:
            # Simple resize without complex processing
            frame = self._quick_resize(frame)
            
            # Clear queue and add new frame immediately
            while not self.frame_queue.empty():
                self.frame_queue.get_nowait()
            self.frame_queue.put_nowait(frame)
                    
        except Exception as e:
            print(f"[STREAM] Error updating frame: {e}")
            
    def _quick_resize(self, frame: np.ndarray) -> np.ndarray:
        """Quick resize for maximum speed"""
        height, width = frame.shape[:2]
        max_width, max_height = self.max_frame_size
        
        if width > max_width or height > max_height:
            scale = min(max_width / width, max_height / height)
            new_width = int(width * scale)
            new_height = int(height * scale)
            frame = cv2.resize(frame, (new_width, new_height), interpolation=cv2.INTER_NEAREST)  # Fastest interpolation
            
        return frame
            
    def start_streaming(self):
        """Start the video streaming loop"""
        if not self.streaming_active:
            self.streaming_active = True
            self.streaming_thread = threading.Thread(target=self._streaming_loop, daemon=True)
            self.streaming_thread.start()
            print("[STREAM] Video streaming started")
            
    def stop_streaming(self):
        """Stop the video streaming loop"""
        self.streaming_active = False
        if self.streaming_thread:
            self.streaming_thread.join(timeout=0.5)
        print("[STREAM] Video streaming stopped")
        
    def _streaming_loop(self):
        """Ultra-fast streaming loop"""
        frame_count = 0
        
        while self.streaming_active:
            try:
                # Get frame immediately
                try:
                    frame = self.frame_queue.get_nowait()
                except queue.Empty:
                    time.sleep(0.001)  # 1ms sleep
                    continue
                
                frame_count += 1
                
                # Send every frame for maximum responsiveness
                if frame_count % self.frame_skip == 0:
                    # Encode frame directly (no thread pool for speed)
                    encoded_frame = self._fast_encode(frame)
                    
                    if encoded_frame:
                        # Prepare message
                        message = {
                            "type": "frame",
                            "frame_data": encoded_frame,
                            "timestamp": time.time(),
                            "frame_number": frame_count
                        }
                        
                        # Broadcast immediately
                        asyncio.run(self._broadcast_message(json.dumps(message)))
                
                # No sleep for maximum speed
                
            except Exception as e:
                print(f"[STREAM] Error in streaming loop: {e}")
                time.sleep(0.001)  # Minimal error recovery
                
    def _fast_encode(self, frame: np.ndarray) -> str:
        """Ultra-fast frame encoding"""
        try:
            # Fastest possible encoding
            encode_params = [
                cv2.IMWRITE_JPEG_QUALITY, self.jpeg_quality,
                cv2.IMWRITE_JPEG_OPTIMIZE, 0,
                cv2.IMWRITE_JPEG_PROGRESSIVE, 0
            ]
            _, buffer = cv2.imencode('.jpg', frame, encode_params)
            return base64.b64encode(buffer).decode('utf-8')
        except Exception as e:
            return None
                
    async def _broadcast_message(self, message: str):
        """Broadcast a message to all connected clients"""
        disconnected_clients = []
        
        with self.connection_lock:
            for client_id, websocket in self.active_connections.items():
                try:
                    await websocket.send_text(message)
                except Exception as e:
                    disconnected_clients.append(client_id)
                    
        # Clean up disconnected clients
        for client_id in disconnected_clients:
            await self.disconnect(client_id)
            
    def get_connection_count(self) -> int:
        """Get number of active connections"""
        with self.connection_lock:
            return len(self.active_connections)
            
    def get_stats(self) -> dict:
        """Get streaming statistics"""
        return {
            "active_connections": self.get_connection_count(),
            "streaming_active": self.streaming_active,
            "queue_size": self.frame_queue.qsize(),
            "frame_skip": self.frame_skip,
            "jpeg_quality": self.jpeg_quality,
            "frame_size": self.max_frame_size
        }

# Global instance
video_streamer = VideoStreamer()
