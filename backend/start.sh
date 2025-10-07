#!/bin/sh

# This script is the new entrypoint for the Docker container.
# It respects the PORT environment variable provided by RunPod.

# Ensure the PORT variable is set, defaulting to 8000 if not.
PORT=${PORT:-8000}

echo "Starting FastAPI server on port $PORT..."

# Start the main Uvicorn server
uvicorn main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips='*'