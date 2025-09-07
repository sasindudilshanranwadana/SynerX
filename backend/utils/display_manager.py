import cv2
import time
from config.config import Config
from utils.video_streamer import video_streamer

class DisplayManager:
    """Manages video display and streaming to web clients"""
    
    def __init__(self):
        self.fps_start_time = time.time()
        self.fps_prev_time = self.fps_start_time
        self.streaming_active = False
        
    def handle_display(self, frame, frame_idx):
        """Handle frame display and streaming"""
        # Update video streamer with current frame
        video_streamer.update_frame(frame)
        
        # Handle local display if enabled
        if Config.ENABLE_DISPLAY:
            return self._handle_local_display(frame, frame_idx)
        
        return True
    
    def _handle_local_display(self, frame, frame_idx):
        """Handle local display and keyboard input"""
        # Resize frame for display if too large
        display_frame = frame.copy()
        height, width = display_frame.shape[:2]
        if width > Config.MAX_DISPLAY_WIDTH:
            scale = Config.MAX_DISPLAY_WIDTH / width
            new_width = int(width * scale)
            new_height = int(height * scale)
            display_frame = cv2.resize(display_frame, (new_width, new_height))
        
        cv2.imshow("Tracking with Stop", display_frame)
        
        # Handle keyboard input
        return self._handle_keyboard_input(frame_idx)
    
    def _handle_keyboard_input(self, frame_idx):
        """Handle keyboard input and return True if should continue, False if should stop"""
        key = cv2.waitKey(Config.DISPLAY_WAIT_KEY_DELAY) & 0xFF
        
        if key == ord('q'):
            print("[INFO] 'q' pressed. Stopping gracefully...")
            return False
        elif key == ord('p'):
            print("[INFO] 'p' pressed. Pausing... Press any key to continue...")
            cv2.waitKey(0)
        elif key == ord('s'):
            print("[INFO] 's' pressed. Saving current frame...")
            print("[INFO] Frame save requested (not implemented in display manager)")
        elif key == ord('h'):
            print("[INFO] 'h' pressed. Displaying help...")
            print("Controls: q=quit, p=pause, s=save frame, h=help")
            cv2.waitKey(2000)  # Show help for 2 seconds
        
        return True
    
    def update_fps_display(self, frame_idx):
        """Update and display FPS information"""
        if frame_idx % Config.FPS_UPDATE_INTERVAL == 0:
            now = time.time()
            fps = Config.FPS_UPDATE_INTERVAL / (now - self.fps_prev_time)
            self.fps_prev_time = now
            print(f"[INFO] FPS: {fps:.2f}")
    
    def start_streaming(self):
        """Start video streaming to web clients - only when clients connect"""
        if not self.streaming_active:
            video_streamer.start_streaming()
            self.streaming_active = True
            print("[INFO] Video streaming started for web clients")
            
    def stop_streaming(self):
        """Stop video streaming to web clients - when no clients are connected"""
        if self.streaming_active:
            video_streamer.stop_streaming()
            self.streaming_active = False
            print("[INFO] Video streaming stopped for web clients")
            
    def cleanup(self):
        """Clean up display resources"""
        cv2.destroyAllWindows()
        self.stop_streaming()
