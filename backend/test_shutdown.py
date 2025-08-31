#!/usr/bin/env python3
"""
Test script to verify enhanced shutdown functionality
"""

import time
import threading
import signal
import sys
import os

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.shutdown_manager import shutdown_manager

def test_shutdown_manager():
    """Test the enhanced shutdown manager"""
    print("🧪 Testing enhanced shutdown manager...")
    
    # Setup signal handlers
    shutdown_manager.setup_signal_handlers()
    
    # Add a test cleanup handler
    def test_cleanup():
        print("🧹 Test cleanup handler executed")
    
    shutdown_manager.add_cleanup_handler(test_cleanup)
    
    print("✅ Shutdown manager setup complete")
    print("🔄 Running for 10 seconds...")
    print("⏹️  Press Ctrl+C to test graceful shutdown")
    
    # Simulate some work
    start_time = time.time()
    while time.time() - start_time < 10:
        if shutdown_manager.check_shutdown():
            print("🛑 Shutdown detected in main loop")
            break
        time.sleep(0.1)
    
    print("✅ Test completed")

if __name__ == "__main__":
    test_shutdown_manager()
