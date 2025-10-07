# ── SynerX backend Dockerfile (RTX 5090 ready: PyTorch 2.8 + CUDA 12.8 + cuDNN 9)
# Build context: backend/

############################
# Builder: prebuild wheels for everything EXCEPT torch family
############################
FROM pytorch/pytorch:2.8.0-cuda12.8-cudnn9-runtime AS builder
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /build

# Build-time switches (default: drop CuPy & Numba to avoid kernel mismatches on RTX 50)
ARG WITHOUT_CUPY=1
ARG WITHOUT_NUMBA=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git curl ffmpeg libgl1 libglib2.0-0 ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Copy your requirement files
COPY requirements.txt requirements.txt
COPY requirements_runpod.txt requirements_runpod.txt

# Keep torch/vision/audio from the base; optionally drop cupy/numba too
# (case-insensitive; matches package name at line start)
RUN awk 'BEGIN{IGNORECASE=1} \
    !/^(torch|torchvision|torchaudio)[[:space:]>~=]/ && \
    !('"$WITHOUT_CUPY"' && /^cupy-cuda12x[[:space:]>~=]/) && \
    !('"$WITHOUT_NUMBA"' && /^numba[[:space:]>~=]/)' \
    requirements.txt > req.nocuda.txt && \
    awk 'BEGIN{IGNORECASE=1} \
    !/^(torch|torchvision|torchaudio)[[:space:]>~=]/ && \
    !('"$WITHOUT_CUPY"' && /^cupy-cuda12x[[:space:]>~=]/) && \
    !('"$WITHOUT_NUMBA"' && /^numba[[:space:]>~=]/)' \
    requirements_runpod.txt > req_runpod.nocuda.txt

RUN python -m pip install --upgrade pip && \
    python -m pip wheel --wheel-dir /wheels \
      -r req.nocuda.txt -r req_runpod.nocuda.txt

############################
# Runtime: same modern CUDA/PyTorch base
############################
FROM pytorch/pytorch:2.8.0-cuda12.8-cudnn9-runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    # PORT is no longer needed for the serverless worker
    # PORT=8000 \
    PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:64
WORKDIR /app

# System libs for OpenCV/FFmpeg + tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libgl1 libglib2.0-0 wget curl && \
    rm -rf /var/lib/apt/lists/*

# Install remaining deps from prebuilt wheels (ultralytics, opencv-headless, fastapi, etc.)
COPY --from=builder /wheels /wheels
COPY --from=builder /build/req.nocuda.txt /wheels/req.nocuda.txt
COPY --from=builder /build/req_runpod.nocuda.txt /wheels/req_runpod.nocuda.txt
RUN python -m pip install --no-cache-dir --find-links=/wheels \
      -r /wheels/req.nocuda.txt -r /wheels/req_runpod.nocuda.txt && \
    rm -rf /wheels

# App source
COPY . /app

# Non-root user + writable dirs (ephemeral only on RunPod; no network volume)
RUN useradd -m appuser && \
    mkdir -p /app/.cache /app/models /app/data /app/uploads /app/temp /app/processed && \
    chown -R appuser:appuser /app
USER appuser

# --- START OF CHANGES FOR RUNPOD SERVERLESS ---

# COPY and make the new startup script executable
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# The EXPOSE and HEALTHCHECK commands are no longer needed, as RunPod
# manages this externally via the PORT and PORT_HEALTH variables.
# EXPOSE 8000
# HEALTHCHECK --interval=30s --timeout=5s --retries=5 \
#  CMD wget -qO- http://127.0.0.1:8000/ || exit 1

# Change the startup command to use the new script.
CMD ["/app/start.sh"]
# --- END OF CHANGES ---