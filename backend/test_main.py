import pytest
from fastapi.testclient import TestClient
import os
import time
import shutil
import uuid

# Set an environment variable to indicate we are testing
os.environ["TESTING"] = "True"

from main import app, OUTPUT_DIR

# Create a TestClient instance
client = TestClient(app)

# --- Fixtures ---
@pytest.fixture(scope="module")
def video_path():
    """
    Pytest fixture to provide the path to the test video.
    It ensures the video file exists before tests run.
    """
    path = os.path.join("testAssets", "videoplayback.mp4")
    if not os.path.exists(path):
        pytest.fail(f"Test video not found at path: {path}. Make sure 'videoplayback.mp4' is in the 'testAssets' folder.")
    return path

# --- Existing Tests (Unchanged) ---

def test_read_root():
    """
    Tests the root endpoint to ensure the API is running and accessible.
    """
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "SynerX API is running!", "status": "ok"}

def test_upload_and_process_video(video_path: str):
    """
    This is an integration test. It uploads a real video file
    and checks the entire processing workflow.
    """
    # 1. Upload the video
    with open(video_path, "rb") as f:
        response = client.post("/video/upload", files={"file": ("videoplayback.mp4", f, "video/mp4")})

    assert response.status_code == 200
    response_json = response.json()
    assert "job_id" in response_json
    assert "Video added to processing queue" in response_json["message"]

    job_id = response_json["job_id"]

    # 2. Poll the job status endpoint until the job is completed
    timeout = 180
    start_time = time.time()
    final_status = None

    while time.time() - start_time < timeout:
        status_response = client.get(f"/jobs/status/{job_id}")
        assert status_response.status_code == 200
        status_data = status_response.json()
        
        if status_data["status"] == "completed":
            final_status = status_data
            break
        elif status_data["status"] == "failed":
            pytest.fail(f"Job failed with message: {status_data.get('message', 'No message')}")
        
        time.sleep(2)
    
    # 3. Assert the final result
    assert final_status is not None, f"Job did not complete within the {timeout}s timeout."
    assert final_status["status"] == "completed"
    assert final_status["progress"] == 100
    
    result = final_status.get("result", {})
    assert "processed_video_url" in result
    assert result["processed_video_url"] is not None
    assert "tracking_data" in result
    assert "processing_stats" in result

def test_get_processing_status():
    """
    Tests the /status/processing endpoint.
    """
    response = client.get("/status/processing")
    assert response.status_code == 200
    status_json = response.json()
    assert "processing_active" in status_json
    assert "shutdown_requested" in status_json
    assert "processing_time" in status_json
    assert isinstance(status_json["processing_active"], bool)
    assert isinstance(status_json["shutdown_requested"], bool)

def test_get_stream_status():
    """
    Tests the /status/stream endpoint.
    """
    response = client.get("/status/stream")
    assert response.status_code == 200
    status_json = response.json()
    assert "streaming_active" in status_json
    assert "active_connections" in status_json
    assert "status" in status_json
    assert isinstance(status_json["active_connections"], int)

def test_get_job_status_not_found():
    """
    Tests that requesting a non-existent job ID returns a 404 error.
    """
    non_existent_job_id = str(uuid.uuid4())
    response = client.get(f"/jobs/status/{non_existent_job_id}")
    assert response.status_code == 404
    assert response.json() == {"detail": "Job not found"}

def test_system_cleanup_temp_files():
    """
    Tests the endpoint for cleaning up temporary files.
    """
    response = client.post("/system/cleanup-temp-files")
    assert response.status_code == 200
    response_json = response.json()
    assert "message" in response_json
    assert "cleaned_count" in response_json
    assert isinstance(response_json["cleaned_count"], int)

def test_websocket_connection():
    """
    Tests a basic WebSocket connection and disconnection.
    """
    with client.websocket_connect("/ws/video-stream/test_client_id") as websocket:
        pass

# --- Corrected Test ---
def test_get_data_tracking():
    """
    Tests the GET /data/tracking endpoint.
    """
    response = client.get("/data/tracking") 
    assert response.status_code == 200
    
    response_json = response.json()
    
    # FIX: Check that the response is a dictionary with the correct structure.
    assert isinstance(response_json, dict)
    assert "status" in response_json
    assert response_json["status"] == "success"
    assert "data" in response_json
    assert isinstance(response_json["data"], list)

def test_get_analysis_correlation():
    """
    Tests the GET /analysis/correlation endpoint.
    """
    response = client.get("/analysis/correlation")
    assert response.status_code == 200
    assert isinstance(response.json(), dict)

# --- Teardown ---
def teardown_module(module):
    """
    Clean up any processed files created during the tests.
    This function runs once after all tests in this file are done.
    """
    print("\n--- Tearing down test module ---")
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)
        print(f"Removed test output directory: {OUTPUT_DIR}")
    
    os.makedirs(OUTPUT_DIR)