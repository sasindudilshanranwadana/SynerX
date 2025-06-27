#!/usr/bin/env python3
"""
Test script to verify shutdown mechanism works properly
"""
import time
import threading
from main import set_shutdown_flag, reset_shutdown_flag, check_shutdown

def test_shutdown_mechanism():
    """Test the shutdown flag mechanism"""
    print("Testing shutdown mechanism...")
    
    # Test 1: Initial state
    print(f"1. Initial shutdown state: {check_shutdown()}")
    assert not check_shutdown(), "Initial state should be False"
    
    # Test 2: Set shutdown flag
    print("2. Setting shutdown flag...")
    set_shutdown_flag()
    print(f"   Shutdown state after set: {check_shutdown()}")
    assert check_shutdown(), "Shutdown should be True after setting"
    
    # Test 3: Reset shutdown flag
    print("3. Resetting shutdown flag...")
    reset_shutdown_flag()
    print(f"   Shutdown state after reset: {check_shutdown()}")
    assert not check_shutdown(), "Shutdown should be False after reset"
    
    # Test 4: Thread safety
    print("4. Testing thread safety...")
    def set_flag_in_thread():
        set_shutdown_flag()
    
    thread = threading.Thread(target=set_flag_in_thread)
    thread.start()
    thread.join()
    
    print(f"   Shutdown state from thread: {check_shutdown()}")
    assert check_shutdown(), "Shutdown should be True from thread"
    
    # Reset for next test
    reset_shutdown_flag()
    
    print("✅ All shutdown mechanism tests passed!")

if __name__ == "__main__":
    test_shutdown_mechanism() 