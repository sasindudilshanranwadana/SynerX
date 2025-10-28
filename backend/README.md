# SynerX - Vehicle Tracking & Compliance System

A comprehensive vehicle tracking and compliance monitoring system with database-driven operation for production deployment.

## 🚀 Features

- **Real-time vehicle tracking** with YOLO object detection
- **Compliance monitoring** - tracks vehicles stopping in designated zones
- **Database-driven operation** - Supabase integration for cloud data storage
- **FastAPI web interface** for video upload and processing
- **Processing time tracking** and graceful shutdown
- **Heat map generation** for traffic analysis
- **Vehicle counting** by type (car, truck, etc.)
- **Weather integration** for environmental data correlation

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

Create a `.env` file in the `backend` directory by copying the example:

```bash
cp .env.example .env
```

Then edit `.env` with your actual credentials:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_KEY=your_supabase_anon_key_here
SUPABASE_EMAIL=your_email@example.com
SUPABASE_PASSWORD=your_password_here

# Weather API Configuration
WEATHER_API_KEY=your_openweathermap_api_key_here

# Cloudflare R2 Storage Configuration
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id_here
R2_ACCESS_KEY_ID=your_r2_access_key_id_here
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key_here
R2_BUCKET_NAME=your_r2_bucket_name_here
```

### 5. Model Setup

Place your YOLO model file at:

```
backend/models/best.pt
```

### 6. Supabase Database Setup

1. **Open Supabase Dashboard**
   - Go to [supabase.com](https://supabase.com) and sign in
   - Select your project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy and Paste Database Schema**
   - Open the file `backend/database/supabase_tables.sql` in your code editor
   - Copy the entire contents (Ctrl+A, then Ctrl+C)
   - Paste into the Supabase SQL Editor (Ctrl+V)

4. **Run the SQL Commands**
   - Click the "Run" button or press Ctrl+Enter
   - Wait for all commands to execute successfully
   - You should see "Success. No rows returned" messages

5. **Verify Setup**
   - Check that three tables were created: `videos`, `tracking_results`, `vehicle_counts`
   - Verify the sequence `tracker_id_seq` was created
   - Confirm all functions and triggers are in place

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

# Get authentication token for testing (make sure u have supabase email and password in supabase)
npm run get:token

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

## 🔄 Database-Driven Workflow

**Purpose**: Production deployment and web interface
**Data Storage**: Supabase database for metadata and analysis results
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

- **Interactive API Documentation** at `http://localhost:8000/docs` (Swagger UI)
- Upload videos via `/upload-video` endpoint
- Saves analysis results to Supabase database
- Processing time tracking
- Graceful shutdown support
- Real-time video streaming via WebSocket
- Test all endpoints directly from the browser interface

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

#### Web Interface Testing

1. **Start the server**
   ```bash
   uvicorn main:app --reload
   ```

2. **Open the interactive API documentation**
   - Go to [http://localhost:8000/docs](http://localhost:8000/docs)
   - This provides a Swagger UI interface for testing all endpoints
   - You can test endpoints directly from the browser

3. **Test endpoints through the web interface**
   - Click on any endpoint to expand it
   - Click "Try it out" to test the endpoint
   - Fill in required parameters and click "Execute"
   - View the response directly in the browser

#### Programmatic Testing

#### `GET /test-db/`

Test database connectivity and current data.

#### `pytest test_main.py`

Test API endpoints programmatically.

## ⚙️ Configuration

Edit `config/config.py` to customize:

- **Video paths**: Input/output video locations
- **Model path**: YOLO model file location
- **Detection settings**: Confidence thresholds, NMS settings
- **Zone configuration**: Stop zone and source polygon coordinates
- **Processing parameters**: Frame buffer, velocity threshold
- **Visualization**: Colors, line thickness, annotation settings

## 📊 Database Schema

The system uses three main tables in Supabase:

### Videos Table
Stores video metadata and processing status:
- `id` - Primary key
- `video_name` - Display name
- `original_filename` - Original file name
- `status` - Processing status (uploaded, processing, completed, failed, cancelled, interrupted)
- `total_vehicles` - Count of detected vehicles
- `compliance_rate` - Percentage of compliant vehicles
- `processing_time_seconds` - Time taken to process
- `message` - Current status message
- `error` - Error details if failed

### Tracking Results Table
Individual vehicle tracking data:
- `tracker_id` - Unique tracking ID
- `video_id` - Reference to videos table
- `vehicle_type` - Type of vehicle (car, truck, etc.)
- `status` - Movement status (moving, stationary)
- `compliance` - Compliance status (0 or 1)
- `reaction_time` - Time to react to stop zone
- Weather data (temperature, humidity, visibility, precipitation, wind speed)

### Vehicle Counts Table
Aggregated vehicle counts per video:
- `id` - Primary key
- `video_id` - Reference to videos table
- `vehicle_type` - Type of vehicle
- `count` - Number of vehicles
- `date` - Date of count

## 📊 Data Structure Examples

### Tracking Results

```json
{
  "tracker_id": 5,
  "vehicle_type": "car",
  "status": "stationary",
  "compliance": 1,
  "reaction_time": 3.22,
  "weather_condition": "clear",
  "temperature": 22.5,
  "humidity": 65,
  "visibility": 10.0,
  "precipitation_type": "none",
  "wind_speed": 5.2,
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

### Database Production Mode

```bash
# 1. Set up environment
cp .env.example .env
# Edit .env with your Supabase credentials

# 2. Start FastAPI server
uvicorn main:app --reload

# 3. Open interactive API documentation
# http://localhost:8000/docs

# 4. Upload video via /upload-video endpoint
# 5. Monitor processing status via /status endpoint
# 6. Stop processing via /shutdown endpoint if needed
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
   Failed to read from database
   ```

   **Solution**: Check your Supabase credentials and network connection

4. **SQL execution errors in Supabase**

   ```
   ERROR: relation "videos" already exists
   ```

   **Solution**: The SQL file includes DROP statements, so you can safely re-run it. If you get constraint errors, run the SQL file again as it handles existing constraints.

5. **Tables not created after running SQL**

   - Check the SQL Editor for any error messages
   - Ensure you copied the entire file content
   - Try running the verification queries manually:
     ```sql
     SELECT table_name FROM information_schema.tables 
     WHERE table_schema = 'public' 
     AND table_name IN ('videos', 'tracking_results', 'vehicle_counts');
     ```

6. **Shutdown not working**
   - Ensure you're calling the `/shutdown/` endpoint
   - Check that processing is actually running
   - Wait a few frames for the shutdown to take effect
  
7. **Local Backend not using GPU**
   - System is configured to run in GPU mode in Runpod.
   - Locally, you need to uninstall torch and torchvision
     ```pip uninstall torch torchvision```
   - Then install it using this [link](https://pytorch.org/get-started/locally/) (select your Operating System and copy the command into your open terminal with venv running)

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
│   └── video_processor.py  # Main processing function (YOLO/OpenCV)
├── config/
│   └── config.py           # Configuration settings
├── database/
│   └── supabase_tables.sql # Database schema
├── utils/
│   ├── data_manager.py     # Database data orchestration
│   ├── vehicle_tracker.py  # Vehicle tracking logic
│   ├── heatmap.py          # Heat map generation
│   └── view_transformer.py # Coordinate transformation
├── models/
│   └── best.pt             # YOLO model file
├── processed/              # Processed videos
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables
└── README.md               # This file
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test in database mode
5. Submit a pull request


**Happy tracking! 🚗📊**
