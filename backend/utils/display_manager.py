import cv2
import time
from config.config import Config

class DisplayManager:
    """Manages video display and keyboard input handling"""
    
    def __init__(self):
        self.fps_start_time = time.time()
        self.fps_prev_time = self.fps_start_time
    
    def handle_display(self, frame, frame_idx):
        """Handle frame display and keyboard input"""
        if not Config.ENABLE_DISPLAY:
            return True
        
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
            # Note: frame saving would need to be handled by the calling code
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
    
    def cleanup(self):
        """Clean up display windows"""
        cv2.destroyAllWindows()
