import pytest
from fastapi.testclient import TestClient
import os
import time
import shutil
import uuid
import json

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

# --- Base and State-Independent Tests (Run First) ---

def test_read_root():
    """ Tests the root endpoint. """
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "SynerX API is running!", "status": "ok"}

def test_shutdown_job_when_none_active():
    """ Tests POST /jobs/shutdown when no job is processing. """
    response = client.post("/jobs/shutdown")
    assert response.status_code == 200
    assert response.json()["status"] == "no_job"

def test_shutdown_specific_job_not_found():
    """ Tests POST /jobs/shutdown/{job_id} for a non-existent job. """
    non_existent_job_id = str(uuid.uuid4())
    response = client.post(f"/jobs/shutdown/{non_existent_job_id}")
    assert response.status_code == 200
    assert response.json()["status"] == "not_found"

def test_system_cleanup_temp_files():
    """ Tests POST /system/cleanup-temp-files. """
    response = client.post("/system/cleanup-temp-files")
    assert response.status_code == 200
    response_json = response.json()
    assert response_json["status"] == "success"
    assert "cleaned_count" in response_json

def test_system_cleanup_orphaned_files():
    """ Tests POST /system/cleanup-orphaned-files. """
    response = client.post("/system/cleanup-orphaned-files")
    assert response.status_code == 200
    response_json = response.json()
    assert response_json["status"] == "success"
    assert "cleaned_count" in response_json

def test_delete_video_not_found():
    """ Tests DELETE /data/videos/{video_id} for a non-existent video. """
    non_existent_video_id = 999999
    response = client.delete(f"/data/videos/{non_existent_video_id}")
    assert response.status_code == 200
    assert response.json()["status"] == "success"

def test_get_processing_status():
    """ Tests GET /status/processing. """
    response = client.get("/status/processing")
    assert response.status_code == 200
    assert "processing_active" in response.json()

def test_get_stream_status():
    """ Tests GET /status/stream. """
    response = client.get("/status/stream")
    assert response.status_code == 200
    assert "streaming_active" in response.json()

def test_websocket_connection():
    """ Tests a basic connection to /ws/video-stream/{client_id}. """
    with client.websocket_connect("/ws/video-stream/test_client_id") as websocket:
        pass

# --- Data and Analysis Endpoint Tests ---

def test_get_data_tracking():
    """ Tests GET /data/tracking. """
    response = client.get("/data/tracking")
    assert response.status_code == 200
    assert response.json()["status"] == "success"

def test_get_data_vehicle_counts():
    """ Tests GET /data/vehicle-counts. """
    response = client.get("/data/vehicle-counts")
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert "data" in response.json()

def test_get_data_tracking_filter():
    """ Tests GET /data/tracking/filter. """
    response = client.get("/data/tracking/filter?limit=5&compliance=1")
    assert response.status_code == 200
    response_json = response.json()
    assert response_json["status"] == "success"
    assert response_json["filters_applied"]["compliance"] == 1

def test_get_data_vehicle_counts_filter():
    """ Tests GET /data/vehicle-counts/filter. """
    response = client.get("/data/vehicle-counts/filter?limit=5&vehicle_type=car")
    assert response.status_code == 200
    response_json = response.json()
    assert response_json["status"] == "success"
    assert response_json["filters_applied"]["vehicle_type"] == "car"

def test_get_data_videos_filter():
    """ Tests GET /data/videos/filter. """
    response = client.get("/data/videos/filter?limit=10")
    assert response.status_code == 200
    assert response.json()["status"] == "success"

def test_get_summary_by_video_not_found():
    """ Tests GET /data/summary/by-video/{video_id} for a non-existent video. """
    response = client.get(f"/data/summary/by-video/999999")
    assert response.status_code == 200
    assert response.json()["status"] == "error"

def test_get_analysis_correlation():
    """ Tests GET /analysis/correlation. """
    response = client.get("/analysis/correlation")
    assert response.status_code == 200
    assert "analysis" in response.json()

def test_get_analysis_weather_impact():
    """ Tests GET /analysis/weather-impact. """
    response = client.get("/analysis/weather-impact")
    assert response.status_code == 200
    assert "weather_impact" in response.json()

def test_get_analysis_complete():
    """ Tests GET /analysis/complete. """
    response = client.get("/analysis/complete")
    assert response.status_code == 200
    assert "complete_analysis" in response.json()

def test_clear_completed_jobs():
    """ Tests POST /jobs/clear-completed. """
    response = client.post("/jobs/clear-completed")
    assert response.status_code == 200
    assert response.json()["status"] == "success"

# --- Main Integration Test (Run Last) ---

def test_upload_and_monitor_with_websocket(video_path: str):
    """
    This is the main integration test. It uploads a video and then monitors
    the /ws/jobs WebSocket to confirm the job completes successfully.
    """
    # 1. Upload the video
    with open(video_path, "rb") as f:
        response = client.post("/video/upload", files={"file": ("videoplayback.mp4", f, "video/mp4")})

    assert response.status_code == 200
    response_json = response.json()
    job_id = response_json["job_id"]
    assert job_id is not None

    # 2. Connect to the jobs WebSocket and listen for completion
    timeout = 180  # 3 minutes
    start_time = time.time()
    job_completed = False
    final_job_status = None

    with client.websocket_connect("/ws/jobs") as websocket:
        while time.time() - start_time < timeout:
            data = websocket.receive_text()
            payload = json.loads(data)
            
            # Find our specific job in the list of all jobs
            for job in payload.get("all_jobs", []):
                if job.get("job_id") == job_id:
                    print(f"Job {job_id} status: {job.get('status')}, progress: {job.get('progress')}%")
                    if job.get("status") == "completed":
                        job_completed = True
                        final_job_status = job
                        break
                    elif job.get("status") in ["failed", "interrupted", "cancelled"]:
                        pytest.fail(f"Job {job_id} did not complete successfully. Final status: {job.get('status')}")
            
            if job_completed:
                break
    
    # 3. Assert that the job was successfully marked as completed
    assert job_completed, f"Job {job_id} did not complete within the {timeout}s timeout."
    assert final_job_status is not None
    assert "result" in final_job_status
    assert final_job_status["result"]["status"] == "done"
    assert "processed_video_url" in final_job_status["result"]


# --- Teardown ---
def teardown_module(module):
    """
    Clean up any processed files created during the tests.
    """
    print("\n--- Tearing down test module ---")
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)
        print(f"Removed test output directory: {OUTPUT_DIR}")

    os.makedirs(OUTPUT_DIR)