# ── SynerX backend for RunPod GPU PODS (plain by default; serverless optional)
FROM pytorch/pytorch:2.8.0-cuda12.8-cudnn9-runtime

# Basic hygiene + reliable signal handling
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Useful NCCL/CUDA envs inside many GPU pods
ENV NCCL_P2P_DISABLE=1 \
    NCCL_IB_DISABLE=1 \
    CUDA_DEVICE_ORDER=PCI_BUS_ID

# OS deps for OpenCV/FFmpeg + tini for graceful shutdowns
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libgl1 libglib2.0-0 ca-certificates curl git tini && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Select which requirement set to install
#   requirements.txt            -> plain (non-serverless) backend  [default]
#   requirements_runpod.txt     -> serverless-style deps
ARG REQUIREMENTS_FILE=requirements.txt
ENV REQUIREMENTS_FILE=${REQUIREMENTS_FILE}

COPY requirements.txt requirements.txt
COPY requirements_runpod.txt requirements_runpod.txt

RUN python -m pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r ${REQUIREMENTS_FILE}

# Copy your backend
COPY . .

# Expose API port used on RunPod (set this when creating the Exposed Endpoint)
EXPOSE 8000

# Simple healthcheck (ensure your app serves GET /health)
HEALTHCHECK --interval=30s --timeout=5s --retries=5 \
  CMD curl -fsS http://localhost:8000/health || exit 1

# Run mode (plain FastAPI by default; optional serverless handler)
ARG MODE=plain
ENV APP_MODE=${MODE}

# Use tini as PID 1 for proper signal handling in RunPod
ENTRYPOINT ["/usr/bin/tini", "--"]

# Adjust "main:app" if your ASGI module path differs
CMD [ "bash", "-lc", "if [ \"$APP_MODE\" = 'serverless' ]; then \
        python rp_handler.py; \
      else \
        uvicorn main:app --host 0.0.0.0 --port 8000 --log-level info --timeout-keep-alive 65; \
      fi" ]
