import threading

class ShutdownManager:
    """Simple shutdown manager for video processing"""
    
    def __init__(self):
        self.shutdown_requested = False
        self.shutdown_lock = threading.Lock()
    
    def check_shutdown(self):
        """Check if shutdown has been requested"""
        with self.shutdown_lock:
            return self.shutdown_requested
    
    def set_shutdown_flag(self):
        """Set the shutdown flag"""
        with self.shutdown_lock:
            self.shutdown_requested = True
    
    def reset_shutdown_flag(self):
        """Reset the shutdown flag"""
        with self.shutdown_lock:
            self.shutdown_requested = False

# Global instance
shutdown_manager = ShutdownManager()
