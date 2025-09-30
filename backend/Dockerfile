# ── SynerX backend Dockerfile (installs BOTH requirements files)
FROM python:3.11-slim AS builder
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /build

# System libs for torch/opencv/ultralytics
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git curl ffmpeg libgl1 libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

# Copy BOTH requirements from current dir (backend/)
COPY requirements.txt /build/requirements.txt
COPY requirements_runpod.txt /build/requirements_runpod.txt

# Build wheels for both sets
RUN python -m pip wheel --wheel-dir /wheels \
    -r /build/requirements.txt \
    -r /build/requirements_runpod.txt

# ── Runtime
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libgl1 libglib2.0-0 wget && \
    rm -rf /var/lib/apt/lists/*

# Install deps
COPY --from=builder /wheels /wheels
COPY --from=builder /build/requirements.txt /wheels/requirements.txt
COPY --from=builder /build/requirements_runpod.txt /wheels/requirements_runpod.txt
RUN python -m pip install --no-index --find-links=/wheels \
    -r /wheels/requirements.txt \
    -r /wheels/requirements_runpod.txt && rm -rf /wheels

# Copy app source from current dir (backend/)
COPY . /app

# Non-root + writable dirs
RUN useradd -m appuser && \
    mkdir -p /app/.cache /app/models /app/data /app/uploads && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Simple wget healthcheck (no here-doc)
HEALTHCHECK --interval=30s --timeout=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8000/ || exit 1

# If your FastAPI app is in backend/main.py with `app`
CMD ["sh","-c","uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
