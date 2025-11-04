# SynerX – Deployment Documentation

**Project:** SynerX – Road-User Behaviour Analysis Using AI & Computer Vision
**Team:** Project 49

## 1. Deployment Overview

This document outlines the deployment process for the SynerX system — detailing backend deployment on RunPod, frontend deployment on Netlify, and database integration through Supabase. The goal is to provide a reproducible and scalable deployment guide to ensure consistent production rollouts.

## 2. Backend Deployment – RunPod

**Directory:** `/backend/`

### Technology Stack

* Framework: FastAPI (Python)
* Inference Engine: YOLOv8 (Ultralytics)
* Runtime: Uvicorn
* Containerization: Docker (GPU support)
* Hosting: RunPod Cloud GPU Pod

### 2.1 Build and Push Docker Image (Example)

The following commands demonstrate how the SynerX backend was containerized and deployed. Future developers can build and publish their own version using their own Docker Hub credentials.

**Prerequisites**

* Docker installed and configured
* Docker Buildx enabled
* Authenticated to Docker Hub

**Commands (example):**

```bash
docker buildx build --platform linux/amd64 \
  -t docker.io/synerx-org/synerx-backend:gpu-amd64-tmp .

docker push docker.io/synerx-org/synerx-backend:gpu-amd64-tmp

docker buildx imagetools create \
  --tag docker.io/synerx-org/synerx-backend:gpu \
  docker.io/synerx-org/synerx-backend:gpu-amd64-tmp

docker buildx imagetools inspect docker.io/synerx-org/synerx-backend:gpu
```

### 2.2 Deploy to RunPod (Custom Docker Template + Availability)

1. Log in to RunPod Console → Pods → Create Pod.
2. Select **Custom Docker Template**.
3. Choose a GPU runtime (e.g., NVIDIA T4, A10).
4. Use the image: `docker.io/synerx-org/synerx-backend:gpu`
5. Exposed Port: 8000

**Environment Variables (example placeholders):**

```bash
# VITE_SUPABASE_ANON_KEY=<insert-your-value-here>
# VITE_SUPABASE_URL=<insert-your-value-here>
# VITE_RUNPOD_URL=<insert-your-value-here>
# VITE_RUNPOD_API_KEY=<insert-your-value-here>
# VITE_CLOUDFLARE_ACCOUNT_ID=<insert-your-value-here>
# VITE_R2_ACCESS_KEY_ID=<insert-your-value-here>
# VITE_R2_SECRET_ACCESS_KEY=<insert-your-value-here>
# VITE_R2_BUCKET_NAME=<insert-your-value-here>
```

Deploy and wait until status = Running. Then copy your RunPod public endpoint.

**Health check:**

```bash
curl https://<runpod-endpoint>/health
```

If you deploy a new pod, update the frontend `.env`: `VITE_RUNPOD_URL=<your-new-runpod-endpoint>`

### 2.3 Updating Backend

```bash
docker buildx build --push --platform linux/amd64 \
  -t docker.io/synerx-org/synerx-backend:gpu .
```

Restart the RunPod container after building.

### 2.4 Backend .env — Detection / Processing / Streaming

```bash
# === Detection Thresholds Configuration ===
TARGET_WIDTH=50
TARGET_HEIGHT=130
DETECTION_CONFIDENCE=0.25
NMS_THRESHOLD=0.3
VELOCITY_THRESHOLD=0.6
FRAME_BUFFER=5
DETECTION_OVERLAP_THRESHOLD=0.5
CLASS_CONFIDENCE_THRESHOLD=0.5
CLASS_HISTORY_FRAMES=10

# === Video Processing Configuration ===
TARGET_FPS=30
FPS_UPDATE_INTERVAL=30
PROCESSING_FRAME_SKIP=2

# === Visual Settings Configuration ===
ANNOTATION_THICKNESS=1
TEXT_SCALE=0.4
TEXT_THICKNESS=1
TRACE_LENGTH_SECONDS=2
STOP_ZONE_COLOR=0,255,255
STOP_ZONE_LINE_THICKNESS=2
ANCHOR_Y_OFFSET=0
SHOW_ANCHOR_POINTS=true
ANCHOR_POINT_COLOR=255,0,255
ANCHOR_POINT_RADIUS=5
ANCHOR_POINT_THICKNESS=-1

# === Display Settings Configuration ===
MAX_DISPLAY_WIDTH=1280
DISPLAY_FRAME_SKIP=1
DISPLAY_WAIT_KEY_DELAY=1

# === Location Coordinates for Weather Data ===
LOCATION_LAT=-37.740585
LOCATION_LON=144.731637

# === WebSocket Streaming Configuration ===
STREAMING_FRAME_SKIP=2
STREAMING_JPEG_QUALITY=85
STREAMING_MAX_FRAME_SIZE=1280,720
STREAMING_QUEUE_SIZE=4
STREAMING_WORKERS=4
STREAMING_TARGET_FPS=30
```

Restart the pod after applying any changes.

## 3. Frontend Deployment – Netlify

**Directory:** `/frontend/`

### Technology Stack

* React + Vite
* Supabase JS SDK + Axios
* Hosting: Netlify (Static SPA)

### 3.1 Deployment Configuration Overview

The SynerX frontend is already deployed on Netlify and connected to GitHub for CI/CD. Every push to the `main` branch triggers an automatic build and deploy.

### 3.2 Configure Environment Variables (Local Build)

Create `.env` in `/frontend`:

```bash
# VITE_SUPABASE_ANON_KEY=<insert-your-value-here>
# VITE_SUPABASE_URL=<insert-your-value-here>
# VITE_RUNPOD_URL=<insert-your-value-here>
# VITE_RUNPOD_API_KEY=<insert-your-value-here>
# VITE_CLOUDFLARE_ACCOUNT_ID=<insert-your-value-here>
# VITE_R2_ACCESS_KEY_ID=<insert-your-value-here>
# VITE_R2_SECRET_ACCESS_KEY=<insert-your-value-here>
# VITE_R2_BUCKET_NAME=<insert-your-value-here>
```

Update these values if you create a new backend or rotate credentials.

### 3.3 Build the Application

```bash
npm install
npm run build
```

Output directory: `/dist`

### 3.4 Deployment Options

**A. Automatic (Recommended)**

* Linked to GitHub repository.
* Push to `main` branch triggers automatic build and deploy.

**B. Manual Deployment**

```bash
npm install
npm run build
```

Upload `dist/` to Netlify (Deploys tab) and configure environment variables.

Add SPA routing:

```toml
[[redirects]]
from = "/*"
to = "/index.html"
status = 200
```

### 3.5 Updating or Reconnecting

* Ensure `VITE_RUNPOD_URL` points to the current backend endpoint.
* Refill all required environment variables.
* Trigger redeploy via **Netlify → Deploy site**.

## 4. Database & Authentication – Supabase

### Overview

Supabase provides the PostgreSQL database, authentication, API gateway, and file storage. It is already integrated with both backend (RunPod) and frontend (Netlify).

### Current Setup

* Tables & auth schemas pre-configured
* Frontend uses Supabase SDK
* Backend performs privileged operations securely

If you create a new Supabase project, update connection details in both environments.

### Database Schema Overview

| Table      | Description                                                     |
| ---------- | --------------------------------------------------------------- |
| users      | Authenticated user profiles                                     |
| detections | Vehicle detections, timestamps, object types, confidence scores |
| sessions   | Analysis sessions & metadata                                    |
| settings   | System configuration and preferences                            |

### 4.3 Integration Verification

| Component          | Verification Step              | Expected Result                          |
| ------------------ | ------------------------------ | ---------------------------------------- |
| Backend (RunPod)   | Visit `<runpod-endpoint>/docs` | FastAPI Swagger UI loads                 |
| Frontend (Netlify) | Open live site                 | Dashboard loads and fetches backend data |
| Supabase (DB)      | View detections in dashboard   | Records created after analysis runs      |

## 5. Maintenance & Redeployment

| Task            | Action                                            |
| --------------- | ------------------------------------------------- |
| Backend Update  | Build & push new Docker image, restart RunPod pod |
| Frontend Update | Push commits, Netlify auto-builds & redeploys     |
| Database Backup | Export/snapshot via Supabase dashboard            |
| Monitoring      | Use RunPod logs and Supabase metrics              |

## 6. Troubleshooting

| Issue                   | Likely Cause                 | Resolution                              |
| ----------------------- | ---------------------------- | --------------------------------------- |
| Frontend not connecting | Outdated backend URL         | Verify `VITE_RUNPOD_URL` in Netlify env |
| Backend not responding  | Missing/incorrect env vars   | Recheck RunPod env config               |
| Data not updating       | Expired Supabase credentials | Re-authenticate or reissue keys         |
| API 502                 | RunPod pod inactive          | Restart pod from dashboard              |

**Prepared by:** SynerX Development Team (Project 49)
**Swinburne University of Technology**
**November 2025**
