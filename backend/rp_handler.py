import runpod
import uuid
import time
from pathlib import Path

# --- Import the necessary components from your existing main.py ---
# This assumes your main.py file can be imported without starting the server immediately.
# The `if __name__ == "__main__":` block in your main.py prevents the server from starting on import.
from main import (
    process_single_job,
    background_jobs,
    job_lock,
    TEMP_PROCESSING_DIR,
    OUTPUT_DIR
)

def handler(job):
    """
    This function is the entrypoint for the RunPod Serverless worker.
    It prepares a job for your existing logic and calls it directly.
    """
    job_input = job.get('input', {})

    # 1. Validate the input from the RunPod API call
    video_path_str = job_input.get("video_path")
    if not video_path_str:
        return {"error": "Missing 'video_path' in job input."}

    original_filename = job_input.get("original_filename", Path(video_path_str).name)
    raw_path = Path(video_path_str)

    if not raw_path.exists():
        return {"error": f"Input video not found at path: {video_path_str}"}

    # 2. Prepare the job data structure that `process_single_job` expects
    job_id = str(uuid.uuid4())
    suffix = raw_path.suffix
    analytic_path = TEMP_PROCESSING_DIR / f"{raw_path.stem}_processed{suffix}"

    # Your processing function relies on the global `background_jobs` dictionary
    # to track progress and state. We must create an entry for this job.
    with job_lock:
        background_jobs[job_id] = {
            "status": "queued",
            "progress": 0,
            "message": "Initializing worker...",
            "error": None,
            "start_time": time.time(),
            "file_name": original_filename,
            "result": None,
            "video_id": None # This gets created inside process_single_job
        }

    job_data = {
        'job_id': job_id,
        'raw_path': raw_path,
        'analytic_path': analytic_path,
        'suffix': suffix,
        'start_time': background_jobs[job_id]["start_time"],
    }
    
    print(f"[HANDLER] Starting job {job_id} for video {original_filename}")

    # 3. Call your existing processing function directly
    try:
        process_single_job(job_data)
        # The function updates the global `background_jobs` dict, so we can check it for the result.
        with job_lock:
            final_status = background_jobs[job_id]
            # Clean up the in-memory record for this ephemeral job
            del background_jobs[job_id] 
        return final_status

    except Exception as e:
        print(f"[HANDLER] An unexpected error occurred for job {job_id}: {e}")
        return {"status": "failed", "error": str(e)}


if __name__ == "__main__":
    print("Starting RunPod Serverless Worker...")
    runpod.serverless.start({"handler": handler})