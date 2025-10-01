# ── SynerX backend Dockerfile (CUDA + PyTorch preinstalled, multi-stage)
# Build context: backend/

############################
# Builder: build wheels for everything EXCEPT torch family
############################
FROM pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime AS builder
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git curl ffmpeg libgl1 libglib2.0-0 ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements.txt
COPY requirements_runpod.txt requirements_runpod.txt

# Strip torch/vision/audio so we keep CUDA builds from base
RUN awk 'BEGIN{IGNORECASE=1} !/^(torch|torchvision|torchaudio)[ >=~=]/' requirements.txt > req.nocuda.txt && \
    awk 'BEGIN{IGNORECASE=1} !/^(torch|torchvision|torchaudio)[ >=~=]/' requirements_runpod.txt > req_runpod.nocuda.txt

RUN python -m pip install --upgrade pip && \
    python -m pip wheel --wheel-dir /wheels \
      -r req.nocuda.txt -r req_runpod.nocuda.txt

############################
# Runtime: same CUDA+PyTorch base
############################
FROM pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    PORT=8000 PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:64
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libgl1 libglib2.0-0 wget curl && \
    rm -rf /var/lib/apt/lists/*

# Install remaining deps from wheels
COPY --from=builder /wheels /wheels
COPY --from=builder /build/req.nocuda.txt /wheels/req.nocuda.txt
COPY --from=builder /build/req_runpod.nocuda.txt /wheels/req_runpod.nocuda.txt
RUN python -m pip install --no-cache-dir --find-links=/wheels \
      -r /wheels/req.nocuda.txt -r /wheels/req_runpod.nocuda.txt && \
    rm -rf /wheels

# Copy app
COPY . /app

# Non-root + writable dirs
RUN useradd -m appuser && \
    mkdir -p /app/.cache /app/models /app/data /app/uploads /app/temp /app/processed && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8000/ || exit 1

CMD ["sh","-c","uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
