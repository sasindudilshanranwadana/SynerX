#!/usr/bin/env python3
"""
Development server script that properly handles Ctrl+C termination - immediately kills localhost
"""
import signal
import sys
import subprocess
import os
import time
import psutil

def kill_port_8000():
    """Kill any process using port 8000"""
    print("🔍 Looking for processes using port 8000...")
    killed_count = 0
    
    try:
        # Find processes using port 8000
        for proc in psutil.process_iter(['pid', 'name', 'connections']):
            try:
                connections = proc.info['connections']
                if connections:
                    for conn in connections:
                        if conn.laddr.port == 8000:
                            print(f"💀 Killing process {proc.info['pid']} ({proc.info['name']}) using port 8000")
                            proc.kill()
                            killed_count += 1
                            break
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        
        if killed_count == 0:
            print("ℹ️ No processes found using port 8000")
        else:
            print(f"✅ Killed {killed_count} processes using port 8000")
            
    except Exception as e:
        print(f"⚠️ Error killing processes on port 8000: {e}")
    
    return killed_count

def kill_uvicorn_processes():
    """Kill all uvicorn processes"""
    print("🔍 Looking for uvicorn processes...")
    killed_count = 0
    
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            proc_info = proc.info
            if proc_info['name'] and 'uvicorn' in proc_info['name'].lower():
                print(f"💀 Killing uvicorn process {proc_info['pid']}")
                proc.kill()
                killed_count += 1
            elif proc_info['cmdline'] and any('uvicorn' in str(arg).lower() for arg in proc_info['cmdline']):
                print(f"💀 Killing uvicorn process {proc_info['pid']} (by cmdline)")
                proc.kill()
                killed_count += 1
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    
    print(f"✅ Killed {killed_count} uvicorn processes")
    return killed_count

def signal_handler(sig, frame):
    """Handle Ctrl+C gracefully by immediately killing localhost server"""
    print('\n🛑 Shutting down development server...')
    
    # First, kill processes using port 8000 (most important)
    kill_port_8000()
    
    # Then kill uvicorn processes
    kill_uvicorn_processes()
    
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
    time.sleep(0.5)
    
    # Force kill any remaining children
    for child in current_process.children(recursive=True):
        try:
            print(f"💀 Force killing process {child.pid}")
            child.kill()
        except psutil.NoSuchProcess:
            pass
    
    print('✅ Localhost server killed')
    os._exit(0)  # Force exit to bypass any hanging threads

def main():
    """Run the development server with proper process management"""
    # Register signal handler for Ctrl+C
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    print("🚀 Starting SynerX development server...")
    print("📡 Server will be available at: http://localhost:8000")
    print("🔄 Auto-reload enabled")
    print("⏹️  Press Ctrl+C to immediately kill localhost server")
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
        print('\n🛑 Keyboard interrupt received...')
        signal_handler(signal.SIGINT, None)
    except Exception as e:
        print(f'❌ Error starting server: {e}')
        signal_handler(signal.SIGTERM, None)

if __name__ == "__main__":
    main()
