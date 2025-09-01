import pytest
from fastapi.testclient import TestClient
from fastapi import WebSocketDisconnect
from unittest.mock import patch, MagicMock
import os
import time

# It's important to set an environment variable to indicate we are testing
# This can be used to configure different settings for tests, like a test database
os.environ["TESTING"] = "True"

from main import app

# Create a TestClient instance
client = TestClient(app)

# --- Test Root Endpoint ---
def test_read_root():
    """
    Tests the root endpoint to ensure the API is running and accessible.
    """
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "SynerX API is running!", "status": "ok"}

# --- Test WebSocket Endpoint ---
def test_websocket_connection():
    """
    Tests the WebSocket endpoint for successful connection and disconnection.
    """
    with client.websocket_connect("/ws/video-stream/test_client") as websocket:
        # The connection should be successful
        assert websocket.scope["path"] == "/ws/video-stream/test_client"

    # The context manager will automatically handle closing the connection
    # If no exception is raised, the test passes.

def test_websocket_ping_pong():
    """
    Tests the WebSocket ping-pong mechanism to ensure the connection is kept alive.
    """
    with client.websocket_connect("/ws/video-stream/test_client_ping") as websocket:
        # Send a "ping" message
        websocket.send_text("ping")
        # Wait for the "pong" response
        data = websocket.receive_json()
        assert data["type"] == "pong"
        assert "timestamp" in data

# --- Test Video Upload Endpoint ---
@patch("main.supabase_manager")
@patch("main.main")
def test_upload_video(mock_main, mock_supabase_manager):
    """
    Tests the video upload endpoint with a mock video file.
    This test mocks the actual video processing and Supabase upload.
    """
    # Mock the return value of the video processing function
    mock_main.return_value = {
        "tracking_data": [{"id": 1, "compliance": 1}],
        "vehicle_counts": {"car": 1}
    }
    # Mock the return value of the Supabase upload
    mock_supabase_manager.upload_video_to_storage.return_value = "http://fake-url.com/processed_video.mp4"

    # Create a dummy file to upload
    with open("test_video.mp4", "wb") as f:
        f.write(b"fake video data")

    with open("test_video.mp4", "rb") as f:
        response = client.post("/video/upload", files={"file": ("test_video.mp4", f, "video/mp4")})

    # Clean up the dummy file
    os.remove("test_video.mp4")

    assert response.status_code == 200
    response_json = response.json()
    assert "job_id" in response_json
    assert response_json["message"] == "File uploaded successfully, processing started."

    # Give the background thread a moment to start and update the job status
    time.sleep(1)

    # --- Test Job Status Endpoint ---
    job_id = response_json["job_id"]
    status_response = client.get(f"/jobs/status/{job_id}")
    assert status_response.status_code == 200
    status_data = status_response.json()
    assert status_data["job_id"] == job_id
    # Check that the status has progressed past "queued"
    assert status_data["status"] in ["processing", "completed"]


# --- Test System Cleanup Endpoint ---
def test_cleanup_temp_files():
    """
    Tests the endpoint for cleaning up temporary files.
    """
    # This test assumes the function `cleanup_temp_files` works correctly.
    # We are testing the endpoint's accessibility and response format.
    response = client.post("/system/cleanup")
    assert response.status_code == 200
    assert "cleaned_count" in response.json()
    assert isinstance(response.json()["cleaned_count"], int)


# --- Test Status Endpoint ---
def test_get_status():
    """
    Tests the main status endpoint of the API.
    """
    response = client.get("/status/")
    assert response.status_code == 200
    status_json = response.json()
    assert status_json["status"] == "ok"
    assert "shutdown_imminent" in status_json
    assert "processing_time" in status_json
