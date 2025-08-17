#!/usr/bin/env python3
"""
Development server script that properly handles Ctrl+C termination
"""
import signal
import sys
import subprocess
import os
import time
import psutil

def signal_handler(sig, frame):
    """Handle Ctrl+C gracefully by killing all related processes"""
    print('\n🛑 Shutting down development server...')
    
    # Get current process
    current_process = psutil.Process()
    
    # Kill all child processes
    for child in current_process.children(recursive=True):
        try:
            print(f"🔄 Stopping process {child.pid} ({child.name()})")
            child.terminate()
        except psutil.NoSuchProcess:
            pass
    
    # Wait a bit for graceful shutdown
    time.sleep(1)
    
    # Force kill any remaining children
    for child in current_process.children(recursive=True):
        try:
            print(f"💀 Force killing process {child.pid}")
            child.kill()
        except psutil.NoSuchProcess:
            pass
    
    print('✅ All processes stopped')
    sys.exit(0)

def main():
    """Run the development server with proper process management"""
    # Register signal handler for Ctrl+C
    signal.signal(signal.SIGINT, signal_handler)
    
    print("🚀 Starting SynerX development server...")
    print("📡 Server will be available at: http://localhost:8000")
    print("🔄 Auto-reload enabled")
    print("⏹️  Press Ctrl+C to stop the server")
    print("-" * 50)
    
    try:
        # Run uvicorn as a subprocess for better control
        process = subprocess.Popen([
            sys.executable, "-m", "uvicorn",
            "main:app",
            "--reload",
            "--host", "0.0.0.0",
            "--port", "8000",
            "--log-level", "info"
        ])
        
        # Wait for the process to complete
        process.wait()
        
    except KeyboardInterrupt:
        print('\n🛑 Stopping server...')
        if process:
            # Terminate the main process
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
        
        # Also kill any remaining uvicorn processes
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                if proc.info['name'] and 'uvicorn' in proc.info['name'].lower():
                    print(f"💀 Killing uvicorn process {proc.info['pid']}")
                    proc.kill()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        
        print('✅ Server stopped')
    except Exception as e:
        print(f'❌ Error starting server: {e}')
        sys.exit(1)

if __name__ == "__main__":
    main()
