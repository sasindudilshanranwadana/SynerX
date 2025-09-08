

# FastAPI Testing Documentation

## 1. Overview

This document outlines the testing procedures for the **SynerX Video Processing API**. The test suite is built using **Pytest** and leverages FastAPI's `TestClient` to perform robust integration tests against the API endpoints without requiring a live server.

The primary goals of this test suite are to:
- ✅ Verify the correctness of each API endpoint.
- ✅ Ensure the end-to-end video processing workflow functions as expected.
- ✅ Prevent regressions during future development.
- ✅ Document the expected behavior of the API.

---

## 2. Prerequisites

Before running the tests, ensure you have the following set up:

1.  **Python Environment**: Python 3.8+ is recommended.
2.  **Required Packages**: All necessary packages should be installed. You can typically install them from a `requirements.txt` file.
    ```bash
    pip install -r requirements.txt
    # Key packages include: pytest, requests, fastapi, uvicorn
    ```
3.  **Test Asset**: A test video file must be placed in the correct directory.
    -   **File**: `videoplayback.mp4`
    -   **Location**: `backend/testAssets/`

---

## 3. Configuration

The test suite is configured to automatically discover and run tests.

### Ignoring Old Tests

To prevent Pytest from running old or deprecated tests located in the `tests/` directory, a `pytest.ini` file is used in the `backend/` root directory.

**File: `pytest.ini`**
```ini
[pytest]
norecursedirs = tests
```This configuration ensures that only `test_main.py` is executed.

---

## 4. Running the Tests

To execute the entire test suite, navigate to the `backend/` directory in your terminal and run the following command:

```bash
pytest -v
```

-   The `-v` flag enables verbose mode, which provides more detailed output for each test.

A successful run will show all tests passing, similar to this:

```
============================= test session starts ==============================
...
collected 19 items

test_main.py::test_read_root PASSED                                       [  5%]
test_main.py::test_shutdown_job_when_none_active PASSED                   [ 10%]
...
test_main.py::test_upload_and_monitor_with_websocket PASSED               [100%]

============================== 19 passed in 123.45s ==============================
```

---

## 5. Test Suite Breakdown

The test suite is organized into logical sections, with state-independent tests running first, followed by the main integration test.

### 5.1 Core API & Setup

These tests verify the basic setup and functionality of the application.

-   **`test_read_root()`**
    -   **Endpoint**: `GET /`
    -   **Purpose**: Verifies that the API is running and accessible at its root.
    -   **Assertions**: Checks for a `200 OK` status and the expected `{"message": "SynerX API is running!", "status": "ok"}` JSON response.

-   **`test_websocket_connection()`**
    -   **Endpoint**: `WEBSOCKET /ws/video-stream/{client_id}`
    -   **Purpose**: Ensures the real-time video streaming WebSocket can accept and close connections.
    -   **Assertions**: Passes if the WebSocket connection is established and terminated without errors.

### 5.2 System, Status & Job Management (Clean State)

These tests are run before any video processing is initiated to ensure they are tested in a clean, idle state.

-   **`test_shutdown_job_when_none_active()`**
    -   **Endpoint**: `POST /jobs/shutdown`
    -   **Purpose**: Verifies that the shutdown command behaves correctly when no jobs are active.
    -   **Assertions**: Checks for a `200 OK` status and a JSON response containing `"status": "no_job"`.

-   **`test_shutdown_specific_job_not_found()`**
    -   **Endpoint**: `POST /jobs/shutdown/{job_id}`
    -   **Purpose**: Ensures the API correctly handles requests to shut down a job that does not exist.
    -   **Assertions**: Checks for a `200 OK` status and a JSON response containing `"status": "not_found"`.

-   **`test_system_cleanup_temp_files()`**
    -   **Endpoint**: `POST /system/cleanup-temp-files`
    -   **Purpose**: Tests the manual trigger for cleaning up old temporary files.
    -   **Assertions**: Checks for a `200 OK` status and ensures the `cleaned_count` key is present in the response.

-   **`test_system_cleanup_orphaned_files()`**
    -   **Endpoint**: `POST /system/cleanup-orphaned-files`
    -   **Purpose**: Tests the manual trigger for cleaning up orphaned files specifically.
    -   **Assertions**: Checks for a `200 OK` status and a successful JSON response.

-   **`test_get_processing_status()`** and **`test_get_stream_status()`**
    -   **Endpoints**: `GET /status/processing` and `GET /status/stream`
    -   **Purpose**: Verify that the status monitoring endpoints are functional.
    -   **Assertions**: Check for a `200 OK` status and the presence of expected keys in the JSON response (e.g., `processing_active`, `streaming_active`).

### 5.3 Data & Analysis Endpoints

These tests verify the data retrieval and analysis endpoints, which are expected to work even with an empty or pre-existing database.

-   **`test_get_data_tracking()`**, **`test_get_data_vehicle_counts()`**, etc.
    -   **Endpoints**: All endpoints under `/data/*` and `/analysis/*`.
    -   **Purpose**: Ensures each data and analysis endpoint is accessible and returns a well-formed response.
    -   **Assertions**: Checks for a `200 OK` status and validates the basic structure of the JSON response (e.g., contains a `status` key, `data` is a list).

-   **`test_delete_video_not_found()`**
    -   **Endpoint**: `DELETE /data/videos/{video_id}`
    -   **Purpose**: Verifies the API's behavior when attempting to delete a video record that does not exist.
    -   **Assertions**: Checks that the API returns a `200 OK` with a `"status": "success"` response, as the backend handles this case gracefully.

### 5.4 Main Integration Test

This is the most critical test, verifying the entire end-to-end workflow. It is intentionally run last to avoid interfering with clean-state tests.

-   **`test_upload_and_monitor_with_websocket()`**
    -   **Endpoints**: `POST /video/upload` and `WEBSOCKET /ws/jobs`
    -   **Purpose**: Simulates a user's complete journey: uploading a video, receiving a job ID, and monitoring the job's progress to completion via the live status WebSocket.
    -   **Workflow**:
        1.  A video file is uploaded to `/video/upload`.
        2.  The test extracts the `job_id` from the response.
        3.  It connects to the `/ws/jobs` WebSocket.
        4.  It listens to incoming messages, searching for its `job_id`.
        5.  It continues listening until it receives a message indicating the job's status is `"completed"`.
    -   **Assertions**:
        -   The initial upload returns a `200 OK` status and a valid `job_id`.
        -   The test successfully finds a `"completed"` status for its job via the WebSocket within a 180-second timeout.
        -   The final job status payload contains a valid `result` object with a `processed_video_url`.

---

## 6. Test Helpers & Fixtures

-   **`video_path()` Fixture**:
    -   This Pytest fixture is responsible for providing the path to the test video (`testAssets/videoplayback.mp4`).
    -   It ensures that the test run fails early if the required video asset is not found.

-   **`teardown_module()` Function**:
    -   This function runs automatically once after all tests in the file have been completed.
    -   Its purpose is to clean up the `processed/` directory, removing any video files generated during the tests to ensure a clean state for the next test run.
