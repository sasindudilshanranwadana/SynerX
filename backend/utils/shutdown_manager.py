import threading
import signal
import sys
import os
import psutil
import time
from typing import List, Callable

class ShutdownManager:
    """Manages graceful shutdown functionality for video processing and uvicorn server"""
    
    def __init__(self):
        self.shutdown_requested = False
        self.shutdown_lock = threading.Lock()
        self.cleanup_handlers: List[Callable] = []
        self.original_signal_handlers = {}
        
    def check_shutdown(self):
        """Check if shutdown has been requested"""
        with self.shutdown_lock:
            return self.shutdown_requested
    
    def set_shutdown_flag(self):
        """Set the shutdown flag (called from API)"""
        with self.shutdown_lock:
            self.shutdown_requested = True
    
    def reset_shutdown_flag(self):
        """Reset the shutdown flag"""
        with self.shutdown_lock:
            self.shutdown_requested = False
    
    def add_cleanup_handler(self, handler: Callable):
        """Add a cleanup function to be called during shutdown"""
        self.cleanup_handlers.append(handler)
    
    def setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown"""
        # Store original handlers
        self.original_signal_handlers[signal.SIGINT] = signal.signal(signal.SIGINT, self._signal_handler)
        self.original_signal_handlers[signal.SIGTERM] = signal.signal(signal.SIGTERM, self._signal_handler)
        
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        print(f"\n🛑 Shutdown signal {signum} received. Gracefully stopping server...")
        
        # Set shutdown flag
        self.set_shutdown_flag()
        
        # Run cleanup handlers
        self._run_cleanup_handlers()
        
        # Kill all child processes
        self._kill_child_processes()
        
        # Force exit after cleanup
        print("✅ Cleanup completed. Exiting...")
        os._exit(0)  # Force exit to bypass any hanging threads
    
    def _run_cleanup_handlers(self):
        """Run all registered cleanup handlers"""
        print("🧹 Running cleanup handlers...")
        for handler in self.cleanup_handlers:
            try:
                handler()
            except Exception as e:
                print(f"⚠️ Cleanup handler failed: {e}")
    
    def _kill_child_processes(self):
        """Kill all child processes to ensure clean shutdown"""
        try:
            current_process = psutil.Process()
            children = current_process.children(recursive=True)
            
            if children:
                print(f"🔄 Terminating {len(children)} child processes...")
                
                # First, try graceful termination
                for child in children:
                    try:
                        print(f"  - Terminating {child.pid} ({child.name()})")
                        child.terminate()
                    except psutil.NoSuchProcess:
                        pass
                
                # Wait for graceful shutdown
                gone, alive = psutil.wait_procs(children, timeout=3)
                
                # Force kill any remaining processes
                for child in alive:
                    try:
                        print(f"  - Force killing {child.pid} ({child.name()})")
                        child.kill()
                    except psutil.NoSuchProcess:
                        pass
                
                print("✅ All child processes terminated")
            else:
                print("ℹ️ No child processes to terminate")
                
        except Exception as e:
            print(f"⚠️ Error killing child processes: {e}")
    
    def force_shutdown(self):
        """Force shutdown - kill all related processes"""
        print("💀 Force shutdown requested...")
        self._kill_child_processes()
        
        # Kill any remaining uvicorn processes
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                if proc.info['name'] and 'uvicorn' in proc.info['name'].lower():
                    print(f"💀 Killing uvicorn process {proc.info['pid']}")
                    proc.kill()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        
        print("✅ Force shutdown completed")

# Global instance
shutdown_manager = ShutdownManager()
