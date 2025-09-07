FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-runtime-ubuntu22.04

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
    ffmpeg libglib2.0-0 libsm6 libxrender1 libxext6 libgl1 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY serverless/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt

COPY serverless/handler.py /app/handler.py
CMD ["python", "-u", "handler.py"]
