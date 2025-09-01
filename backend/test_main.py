import pytest
from fastapi.testclient import TestClient
import os
import time
import shutil

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
    # Use a relative path to the assets folder
    path = os.path.join("testAssets", "videoplayback.mp4")
    if not os.path.exists(path):
        pytest.fail(f"Test video not found at path: {path}. Make sure 'videoplayback.mp4' is in the 'assets' folder.")
    return path

# --- Tests ---

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
    
    # FIX: Update the expected message to what your API actually returns
    assert "Video added to processing queue" in response_json["message"]

    job_id = response_json["job_id"]

    # 2. Poll the job status endpoint until the job is completed
    timeout = 180  # 3 minutes timeout for processing
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
        
        # Wait before polling again
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
    
    # Re-create the directory so the app doesn't crash on next run
    os.makedirs(OUTPUT_DIR)