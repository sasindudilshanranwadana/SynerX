#!/usr/bin/env python3
"""
SynerX Development Script
Usage: python dev.py [command]

Commands:
    dev     - Start FastAPI server with hot reload
    start   - Start FastAPI server (production)
    test    - Run tests
    process - Run video processor
    install - Install dependencies
    clean   - Clean cache files
"""

import sys
import subprocess
import os
from pathlib import Path

def run_command(cmd, description=""):
    """Run a command and handle errors"""
    print(f"🚀 {description or cmd}")
    try:
        result = subprocess.run(cmd, shell=True, check=True)
        return result.returncode == 0
    except subprocess.CalledProcessError as e:
        print(f"❌ Command failed: {e}")
        return False

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return

    command = sys.argv[1].lower()
    
    commands = {
        'dev': {
            'cmd': 'uvicorn main:app --reload --host 0.0.0.0 --port 8000',
            'desc': 'Starting FastAPI development server with hot reload...'
        },
        'start': {
            'cmd': 'uvicorn main:app --host 0.0.0.0 --port 8000',
            'desc': 'Starting FastAPI production server...'
        },
        'test': {
            'cmd': 'python -m pytest tests/ -v',
            'desc': 'Running tests...'
        },
        'process': {
            'cmd': 'python core/video_processor.py',
            'desc': 'Running video processor...'
        },
        'install': {
            'cmd': 'pip install -r requirements.txt',
            'desc': 'Installing dependencies...'
        },
        'clean': {
            'cmd': 'find . -type f -name "*.pyc" -delete && find . -type d -name "__pycache__" -delete && rm -rf .pytest_cache',
            'desc': 'Cleaning cache files...'
        }
    }
    
    if command in commands:
        run_command(commands[command]['cmd'], commands[command]['desc'])
    else:
        print(f"❌ Unknown command: {command}")
        print(__doc__)

if __name__ == "__main__":
    main() 