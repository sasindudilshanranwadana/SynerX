import os, json, time, tempfile, traceback, requests, runpod, boto3

# ---- Env ----
S3_ENDPOINT   = os.environ["S3_ENDPOINT"]
S3_ACCESS_KEY = os.environ["S3_ACCESS_KEY"]
S3_SECRET_KEY = os.environ["S3_SECRET_KEY"]
S3_BUCKET     = os.environ["S3_BUCKET"]

CALLBACK_URL   = os.getenv("RENDER_CALLBACK_URL")
CALLBACK_TOKEN = os.getenv("RUNPOD_CALLBACK_TOKEN")

s3 = boto3.client(
    "s3",
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
)

def _download_to_tmp(key: str, suffix=".mp4") -> str:
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    with open(path, "wb") as f:
        s3.download_fileobj(S3_BUCKET, key, f)
    return path

def _put_bytes(key: str, data: bytes, content_type="application/octet-stream"):
    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=data, ContentType=content_type)

def _presign_get(key: str, expires=3600):
    return s3.generate_presigned_url("get_object",
        Params={"Bucket": S3_BUCKET, "Key": key}, ExpiresIn=expires)

# ---- Replace with your real pipeline ----
def run_pipeline(video_path: str):
    time.sleep(2)
    metrics = {"vehicle_count": 42, "stops_detected": 5}
    tracking_csv = b"frame,id,x,y,w,h\n"
    count_csv    = b"class,count\ncar,42\nbus,3\n"
    return metrics, tracking_csv, count_csv

def handler(event):
    try:
        job_id     = event["job_id"]
        input_key  = event["input_key"]
        out_prefix = event.get("out_prefix", f"runs/{job_id}")

        local_video = _download_to_tmp(input_key, ".mp4")
        metrics, tracking_csv, count_csv = run_pipeline(local_video)

        tracking_key = f"{out_prefix}/tracking_results.csv"
        count_key    = f"{out_prefix}/vehicle_count.csv"
        _put_bytes(tracking_key, tracking_csv, "text/csv")
        _put_bytes(count_key, count_csv, "text/csv")

        result = {
            "job_id": job_id,
            "status": "completed",
            "metrics": metrics,
            "artifacts": {
                "tracking_key": tracking_key,
                "count_key": count_key,
                "tracking_url": _presign_get(tracking_key),
                "count_url": _presign_get(count_key),
            },
        }

        if CALLBACK_URL:
            headers = {"Content-Type": "application/json"}
            if CALLBACK_TOKEN: headers["X-Runpod-Token"] = CALLBACK_TOKEN
            try:
                requests.post(CALLBACK_URL, json=result, headers=headers, timeout=30)
            except Exception:
                pass

        return result
    except Exception as e:
        return {"status": "failed", "error": str(e),
                "traceback": traceback.format_exc()[:2000]}

runpod.serverless.start({"handler": handler})
