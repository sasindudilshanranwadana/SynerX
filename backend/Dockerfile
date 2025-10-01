# ── SynerX backend Dockerfile (CUDA, multi-stage, installs BOTH requirements files)
# Build context: backend/  (so main.py ends up at /app/main.py)

############################
# Builder: create wheels for all deps EXCEPT torch family
############################
FROM nvidia/cuda:12.2.2-cudnn8-runtime-ubuntu22.04 AS builder
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /build

# System libs + Python toolchain for building wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-dev build-essential git curl ffmpeg \
    libgl1 libglib2.0-0 ca-certificates && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    pip3 install --upgrade pip && \
    rm -rf /var/lib/apt/lists/*

# Copy BOTH requirements from current dir (backend/)
COPY requirements.txt requirements.txt
COPY requirements_runpod.txt requirements_runpod.txt

# Filter out torch/vision/audio so we install their CUDA wheels explicitly later
RUN awk 'BEGIN{IGNORECASE=1} !/^(torch|torchvision|torchaudio)[ >=~=]/' requirements.txt > req.nocuda.txt && \
    awk 'BEGIN{IGNORECASE=1} !/^(torch|torchvision|torchaudio)[ >=~=]/' requirements_runpod.txt > req_runpod.nocuda.txt

# Build wheels for the remaining deps (opencv-headless, ultralytics, supabase, etc.)
RUN python -m pip wheel --wheel-dir /wheels \
    -r req.nocuda.txt -r req_runpod.nocuda.txt

############################
# Runtime: CUDA + cuDNN + Python, install torch CUDA wheels first
############################
FROM nvidia/cuda:12.2.2-cudnn8-runtime-ubuntu22.04
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    PORT=8000 \
    PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:64
WORKDIR /app

# System libs for OpenCV/FFmpeg + Python
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-dev git curl wget ffmpeg \
    libgl1 libglib2.0-0 ca-certificates && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    pip3 install --upgrade pip && \
    rm -rf /var/lib/apt/lists/*

# --- Install CUDA-enabled PyTorch stack FIRST (from official CUDA 12.1 index) ---
# Pin to stable, adjust if you need to match specific ultralytics/torch combos.
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cu121 \
    torch==2.4.1 torchvision==0.19.1 torchaudio==2.4.1

# Bring in prebuilt wheels for the rest
COPY --from=builder /wheels /wheels
# Optional: keep the filtered files (handy for troubleshooting)
COPY --from=builder /build/req.nocuda.txt /wheels/req.nocuda.txt
COPY --from=builder /build/req_runpod.nocuda.txt /wheels/req_runpod.nocuda.txt

# Install everything else from wheels (ultralytics, opencv-python-headless, cupy-cuda12x, fastapi, etc.)
RUN pip install --no-cache-dir --find-links=/wheels \
    -r /wheels/req.nocuda.txt -r /wheels/req_runpod.nocuda.txt && \
    rm -rf /wheels

# Copy app source from current dir (backend/)
COPY . /app

# Non-root + writable dirs
RUN useradd -m appuser && \
    mkdir -p /app/.cache /app/models /app/data /app/uploads /app/temp /app/processed && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Simple wget healthcheck (switch to /health if you prefer)
HEALTHCHECK --interval=30s --timeout=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8000/ || exit 1

# FastAPI entrypoint (main:app in backend/)
CMD ["sh","-c","uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
