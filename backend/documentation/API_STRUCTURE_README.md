# API Structure - Modular Organization

## Overview

The API has been reorganized into a modular structure to improve maintainability and readability. The large `main.py` file has been split into focused modules.

## 📁 New Structure

```
backend/
├── api/                          # API modules
│   ├── __init__.py              # Package initialization
│   ├── models.py                # Pydantic response models
│   ├── jobs.py                  # Job management endpoints
│   ├── video.py                 # Video processing endpoints
│   ├── data.py                  # Data retrieval endpoints
│   ├── analysis.py              # Correlation analysis endpoints
│   ├── system.py                # System management endpoints
│   └── status.py                # Status monitoring endpoints
├── main.py                      # Clean modular main file
└── main_old.py                  # Backup of original main file (if needed)
```

## 🏗️ Module Breakdown

### **`api/models.py`**

- **Purpose**: Pydantic response models for API documentation
- **Contains**: `JobStatusResponse`, `CleanupResponse`, `QueueStatusResponse`

### **`api/jobs.py`**

- **Purpose**: Job management and queue operations
- **Endpoints**:
  - `GET /jobs/` - List all jobs
  - `GET /jobs/status/{job_id}` - Get specific job status
  - `POST /jobs/clear-completed` - Clear completed jobs
  - `POST /jobs/shutdown` - Cancel current job
  - `POST /jobs/restart-queue` - Restart queue processor
  - `GET /jobs/queue-status` - Get queue status

### **`api/video.py`**

- **Purpose**: Video upload and processing
- **Endpoints**:
  - `POST /video/upload` - Upload video for processing

### **`api/data.py`**

- **Purpose**: Data retrieval and filtering
- **Endpoints**:
  - `GET /data/tracking` - Get tracking data
  - `GET /data/vehicle-counts` - Get vehicle counts
  - `GET /data/tracking/filter` - Get filtered tracking data
  - `GET /data/vehicle-counts/filter` - Get filtered vehicle counts

### **`api/analysis.py`**

- **Purpose**: Correlation analysis and weather impact
- **Endpoints**:
  - `GET /analysis/correlation` - Weather-driver correlation
  - `GET /analysis/weather-impact` - Weather impact analysis
  - `GET /analysis/complete` - Complete analysis

### **`api/system.py`**

- **Purpose**: System maintenance and cleanup
- **Endpoints**:
  - `POST /system/cleanup-temp-files` - Clean up temp files

### **`api/status.py`**

- **Purpose**: System status monitoring
- **Endpoints**:
  - `GET /status/processing` - Get processing status
  - `GET /status/stream` - Get stream status

## ✅ Migration Complete!

The modular structure has been successfully implemented. The old `main.py` has been replaced with the new modular version.

### **Updated Endpoint URLs:**

The new structure uses different URL prefixes:

- Old: `/upload-video/` → New: `/video/upload`
- Old: `/jobs/` → New: `/jobs/` (same)
- Old: `/tracking-data/` → New: `/data/tracking`
- Old: `/correlation-analysis/` → New: `/analysis/correlation`
- Old: `/status/` → New: `/status/processing`
- Old: `/stream-status/` → New: `/status/stream`

### **Next Steps:**

1. **Update Frontend**: Update `stream_test.html` to use the new endpoint URLs
2. **Test**: Run `python main.py` to test the new modular API
3. **Verify**: Check that all endpoints work correctly in Swagger UI

## ✨ Benefits

1. **Maintainability**: Each module has a single responsibility
2. **Readability**: Much easier to find and modify specific functionality
3. **Scalability**: Easy to add new modules for new features
4. **Testing**: Each module can be tested independently
5. **Documentation**: Better organized Swagger documentation
6. **Code Reuse**: Modules can be imported and reused

## 🏷️ Swagger Organization

The new structure provides better Swagger organization:

- **Job Management** - All job-related operations
- **Video Processing** - Video upload and processing
- **Data** - Data retrieval and filtering
- **Correlation Analysis** - Weather-driver analysis
- **System Management** - System maintenance
- **Status** - System monitoring

## 🔧 Configuration

The new `main.py` maintains all the original functionality while providing:

- Cleaner code organization
- Better separation of concerns
- Improved maintainability
- Enhanced documentation
- Modular architecture

## 📝 Remaining Tasks

1. **Update Frontend**: Update `stream_test.html` to use the new endpoint URLs
2. **Test**: Verify all endpoints work correctly
3. **Documentation**: Update any external documentation
4. **Testing**: Consider adding unit tests for each module
