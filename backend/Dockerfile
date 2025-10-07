# ── SynerX backend Dockerfile — Serverless Load Balancer (RTX 4090 ready)
# Build context: backend/

############################
# Builder: prebuild wheels for everything EXCEPT torch family
############################
FROM pytorch/pytorch:2.8.0-cuda12.8-cudnn9-runtime AS builder
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /build

# Disable libs that can ship incompatible kernels on new GPUs (re-enable later if needed)
ARG WITHOUT_CUPY=1
ARG WITHOUT_NUMBA=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git curl ffmpeg libgl1 libglib2.0-0 ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements.txt
COPY requirements_runpod.txt requirements_runpod.txt

# Keep torch/vision/audio from base; optionally drop cupy/numba
RUN awk 'BEGIN{IGNORECASE=1} \
    !/^(torch|torchvision|torchaudio)[[:space:]>~=]/ && \
    !('"$WITHOUT_CUPY"' && /^cupy-cuda12x[[:space:]>~=]/) && \
    !('"$WITHOUT_NUMBA"' && /^numba[[:space:]>~=]/)' requirements.txt > req.nocuda.txt && \
    awk 'BEGIN{IGNORECASE=1} \
    !/^(torch|torchvision|torchaudio)[[:space:]>~=]/ && \
    !('"$WITHOUT_CUPY"' && /^cupy-cuda12x[[:space:]>~=]/) && \
    !('"$WITHOUT_NUMBA"' && /^numba[[:space:]>~=]/)' requirements_runpod.txt > req_runpod.nocuda.txt

RUN python -m pip install --upgrade pip && \
    python -m pip wheel --wheel-dir /wheels \
      -r req.nocuda.txt -r req_runpod.nocuda.txt

############################
# Runtime: same CUDA/PyTorch base
############################
FROM pytorch/pytorch:2.8.0-cuda12.8-cudnn9-runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:64 \
    PORT=8000 \
    PORT_HEALTH=8000   

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libgl1 libglib2.0-0 ca-certificates curl wget && \
    rm -rf /var/lib/apt/lists/*

# Install the rest of deps from wheels (ultralytics, opencv-headless, fastapi, etc.)
COPY --from=builder /wheels /wheels
COPY --from=builder /build/req.nocuda.txt /wheels/req.nocuda.txt
COPY --from=builder /build/req_runpod.nocuda.txt /wheels/req_runpod.nocuda.txt
RUN python -m pip install --no-cache-dir --find-links=/wheels \
      -r /wheels/req.nocuda.txt -r /wheels/req_runpod.nocuda.txt && \
    rm -rf /wheels

# App code
COPY . /app

# Non-root
RUN useradd -m appuser && \
    mkdir -p /app/.cache /app/models /app/data /app/uploads /app/temp /app/processed && \
    chown -R appuser:appuser /app
USER appuser

# We’re in HTTP load-balancer mode (NOT handler mode), so start uvicorn.
# It must listen on $PORT, and expose /ping on $PORT_HEALTH (we set both to 8000).
EXPOSE 8000
CMD ["sh","-lc","uvicorn main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
