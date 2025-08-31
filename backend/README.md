# SynerX - Vehicle Tracking & Compliance System

A comprehensive vehicle tracking and compliance monitoring system with dual-mode operation (local development and API production).

## 🚀 Features

- **Real-time vehicle tracking** with YOLO object detection
- **Compliance monitoring** - tracks vehicles stopping in designated zones
- **Dual-mode operation** - Local development (CSV) and API production (Database)
- **FastAPI web interface** for video upload and processing
- **Supabase integration** for cloud data storage
- **Processing time tracking** and graceful shutdown
- **Heat map generation** for traffic analysis
- **Vehicle counting** by type (car, truck, etc.)

## 📋 Prerequisites

- Python 3.8+
- Supabase account and project
- YOLO model file (`models/best.pt`)

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd SynerX/backend
```

### 2. Set Up Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Environment Setup

Create a `.env` file in the `backend` directory:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
GCS_BUCKET_NAME=your-supabase-storage-name
```

### 5. Model Setup

Place your YOLO model file at:

```
backend/models/best.pt
```

### 6. Supabase Database Setup

Before ru the SQL commands, u can do the step 9 and step 10 wrote in `supabase_tables.sql` first and make sure you correct the name of bucket name

Run the SQL commands in `supabase_tables.sql` in your Supabase SQL editor to create the required tables and storage bucket.

## ⚡ Quick Development Commands

### Using npm-style scripts (Recommended)

```bash
# Start development server with hot reload
npm run dev

# Start production server
npm start

# Run tests
npm test

# Run video processor
npm run processor

# Install dependencies
npm run install-deps
```

### Traditional commands

```bash
# Start development server with hot reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Start production server
uvicorn main:app --host 0.0.0.0 --port 8000

# Run video processor
python core/video_processor.py
```

## 🔄 Dual-Mode Workflow

### 🏠 Local Development Mode

**Purpose**: Development, testing, and local analysis
**Data Storage**: CSV files only
**Input**: Video from config file

```bash
# Run local development mode (from backend root directory)
python core/video_processor.py
```

**Features:**

- Reads video from `Config.VIDEO_PATH`
- Saves data to CSV files (`data/tracking_results.csv`, `data/vehicle_count.csv`)
- No database dependency
- Fast development cycle

### 🌐 API Production Mode

**Purpose**: Production deployment and web interface
**Data Storage**: Supabase database only
**Input**: Uploaded videos via API

```bash
# 1. Start FastAPI server
uvicorn main:app --reload

# 2. Open web interface
# http://localhost:8000/docs

# 3. Upload video via /upload-video endpoint
# 4. Monitor processing status via /status endpoint
# 5. Stop processing via /shutdown endpoint if needed
```

**Features:**

- Web interface at `http://localhost:8000/docs`
- Upload videos via `/upload-video` endpoint
- Saves data to Supabase database
- Processing time tracking
- Graceful shutdown support

## 📡 API Endpoints

### Video Processing

#### `POST /upload-video/`

Upload and process a video file.

**Request:**

- `file`: Video file (MP4, AVI, etc.)

**Response:**

```json
{
  "status": "done",
  "processed_video_url": "https://...",
  "tracking_data": [...],
  "vehicle_counts": [...],
  "processing_stats": {
    "total_vehicles": 15,
    "compliance_rate": 80.0,
    "processing_time": 45.23,
    "total_processing_time": 47.89
  }
}
```

### System Control

#### `POST /shutdown/`

Stop ongoing video processing gracefully.

**Usage:**

**PowerShell (Windows):**

```powershell
# Method 1: Using Invoke-WebRequest
Invoke-WebRequest -Uri "http://localhost:8000/shutdown/" -Method POST

# Method 2: Using Invoke-RestMethod (returns JSON)
Invoke-RestMethod -Uri "http://localhost:8000/shutdown/" -Method POST
```

**Command Prompt (Windows):**

```cmd
# Using curl (if available)
curl -X POST http://localhost:8000/shutdown/

# Using PowerShell
powershell -Command "Invoke-RestMethod -Uri 'http://localhost:8000/shutdown/' -Method POST"
```

**Linux/Mac:**

```bash
curl -X POST http://localhost:8000/shutdown/
```

**Response:**

```json
{
  "status": "shutdown_requested",
  "message": "Processing will stop gracefully",
  "processing_time": 23.45
}
```

#### `GET /status/`

Check processing status.

**Response:**

```json
{
  "processing_active": false,
  "shutdown_requested": true,
  "processing_time": 23.45
}
```

### Testing

#### `GET /test-db/`

Test database connectivity and current data.

## ⚙️ Configuration

Edit `config/config.py` to customize:

- **Video paths**: Input/output video locations
- **Model path**: YOLO model file location
- **Detection settings**: Confidence thresholds, NMS settings
- **Zone configuration**: Stop zone and source polygon coordinates
- **Processing parameters**: Frame buffer, velocity threshold
- **Visualization**: Colors, line thickness, annotation settings

## 📊 Data Structure

### Tracking Results

```json
{
  "tracker_id": 5,
  "vehicle_type": "car",
  "status": "stationary",
  "compliance": 1,
  "reaction_time": 3.22,
  "date": "2025-06-27 21:45:24"
}
```

### Vehicle Counts

```json
{
  "vehicle_type": "car",
  "count": 15,
  "date": "2025-06-27"
}
```

## 🚦 Usage Examples

### Local Development

```bash
# 1. Set up environment
cp .env.example .env
# Edit .env with your Supabase credentials

# 2. Configure video path in config/config.py
VIDEO_PATH = "path/to/your/video.mp4"

# 3. Run local processing (from backend root directory)
python core/video_processor.py

# 4. Check results in data/ folder
cat data/tracking_results.csv
cat data/vehicle_count.csv
```

### API Production

```bash
# 1. Start FastAPI server
uvicorn main:app --reload

# 2. Open web interface
# http://localhost:8000/docs

# 3. Upload video via /upload-video endpoint
# 4. Monitor processing status via /status endpoint
# 5. Stop processing via /shutdown endpoint if needed
```

## 🔧 Troubleshooting

### Common Issues

1. **Missing .env file**

   ```
   ValueError: Missing SUPABASE_URL or SUPABASE_KEY in environment variables
   ```

   **Solution**: Create `.env` file with your Supabase credentials

2. **Model file not found**

   ```
   FileNotFoundError: models/best.pt
   ```

   **Solution**: Place your YOLO model file in `backend/models/best.pt`

3. **Database connection failed**

   ```
   Failed to read from Supabase, falling back to CSV
   ```

   **Solution**: Check your Supabase credentials and network connection

4. **Shutdown not working**
   - Ensure you're calling the `/shutdown/` endpoint
   - Check that processing is actually running
   - Wait a few frames for the shutdown to take effect

### Debug Mode

Enable debug logging by setting in `.env`:

```env
DEBUG=True
```

## 📁 Project Structure

```
backend/
├── main.py                 # FastAPI server (entrypoint)
├── package.json            # npm-style scripts
├── clients/
│   ├── __init__.py
│   └── supabase_client.py  # Supabase client setup
├── core/
│   ├── __init__.py
│   ├── video_processor.py  # Main processing function (YOLO/OpenCV)
│   └── license_plate_blur.py # License plate blurring module
├── config/
│   └── config.py           # Configuration settings
├── utils/
│   ├── supabase_manager.py # Supabase database operations
│   ├── data_manager.py     # CSV and data orchestration
│   ├── vehicle_tracker.py  # Vehicle tracking logic
│   ├── heatmap.py          # Heat map generation
│   └── view_transformer.py # Coordinate transformation
├── models/
│   └── best.pt             # YOLO model file
├── data/                   # CSV output (local mode)
├── processed/              # Processed videos
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables
└── README.md               # This file
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test in both local and API modes
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:

1. Check the troubleshooting section
2. Review the configuration options
3. Test in local mode first
4. Create an issue with detailed error messages

---

**Happy tracking! 🚗📊**
