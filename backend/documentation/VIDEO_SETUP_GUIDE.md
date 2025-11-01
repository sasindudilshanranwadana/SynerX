# Video Setup Guide

## Quick Video Setup

### 1. Configure Video Path

#### Option A: Using Default Video (No Changes Needed)
If you're using the default video (`videoplayback.mp4`), you don't need to make any changes. The system will automatically use:
```
backend/asset/videoplayback.mp4
```

#### Option B: Using Your Own Video
If you want to use your own video file:

1. **Place your video file** in the `backend/asset/` directory:
   ```bash
   # Place your video here:
   backend/asset/your_video.mp4
   ```

2. **Update the video path** in `backend/config/config.py`:
   ```python
   # In backend/config/config.py, update this line:
   VIDEO_PATH = os.path.join(BACKEND_ROOT, 'asset', 'your_video.mp4')  # Change 'your_video.mp4' to your actual filename
   ```

3. **Important**: After changing the video file, you'll need to:
   - Update your detection zone coordinates (see Step 3 below)
   - Recalibrate zone coordinates for your new video resolution
   - Update polygon coordinates in your `.env` file

> **Note**: For more details on video setup and zone configuration, see the [Zone Setup Steps](#zone-setup-steps) section below.

### 2. Configure Environment Variables
Create or update your `.env` file in the `backend` directory:

```bash
# Copy the example file if you haven't already
cp backend/env.example backend/.env
```

### 3. Set Detection Zones (REQUIRED)
Open `backend/.env` and configure the polygon coordinates (comma-separated values):

```env
# Polygon coordinates format: x1,y1,x2,y2,x3,y3,x4,y4
# These are REQUIRED - the application will fail to start if these are not set
SOURCE_POLYGON=422,10,594,16,801,665,535,649
STOP_ZONE_POLYGON=507,199,681,209,751,555,484,541

# Also set the real dimensions of your SOURCE_ZONE area for accurate measurements:
TARGET_WIDTH=50
TARGET_HEIGHT=130
```

## Video Requirements
- **Format**: MP4, AVI, MOV
- **Codec**: H.264 recommended
- **Resolution**: 720p or higher
- **Frame Rate**: 15-60 FPS

## Zone Setup Steps

### Step 1: Get Video Resolution
```python
# Check your video resolution
import cv2
cap = cv2.VideoCapture('your_video.mp4')
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
print(f"Video resolution: {width}x{height}")
cap.release()
```

### Step 2: Get Zone Coordinates (Choose One Method)

#### Method 1: Use the Interactive Notebook (Recommended)
1. Open `backend/analysis/notebooks/process.ipynb`
2. Change the video path to your video:
   ```python
   video_path = './asset/your_video.mp4'  # Update this path
   ```
3. Run the notebook
4. Click on your video frame to mark zone corners
5. Press 'q' to quit and get coordinates
6. Copy the printed coordinates to your `.env` file in comma-separated format: `x1,y1,x2,y2,x3,y3,x4,y4`

#### Method 2: Online Coordinate Tools
1. Go to [Image Coordinate Picker](https://www.image-map.net/) or [Coordinate Picker](https://www.coordinatepicker.com/)
2. Upload a screenshot of your video frame
3. Click on the corners of your detection zones
4. Copy the coordinates

#### Method 3: Manual Method
1. Open your video in any video player
2. Take a screenshot of a key frame
3. Open the screenshot in an image editor (Paint, GIMP, Photoshop)
4. Note the pixel coordinates of your detection areas
5. Write down the (x, y) coordinates

### Step 3: Update .env File with Coordinates
Open `backend/.env` and update these values (comma-separated format):

```env
# Main detection area (REQUIRED)
# Format: x1,y1,x2,y2,x3,y3,x4,y4
SOURCE_POLYGON=x1,y1,x2,y2,x3,y3,x4,y4

# Stop zone area (REQUIRED)
# Format: x1,y1,x2,y2,x3,y3,x4,y4
STOP_ZONE_POLYGON=x1,y1,x2,y2,x3,y3,x4,y4

# Real dimensions of your SOURCE_ZONE area for accurate measurements (in meters/feet)
TARGET_WIDTH=50
TARGET_HEIGHT=130
```

### Understanding Coordinates vs Real SOURCE_ZONE Dimensions
- **TARGET_WIDTH, TARGET_HEIGHT**: Real dimensions of your SOURCE_ZONE area (e.g., 50m wide, 130m long)
- **x1, x2, x3, x4**: Pixel coordinates on your video frame that define the SOURCE_ZONE polygon
- **The system converts pixel coordinates to real-world measurements within your SOURCE_ZONE**

#### Example:
```env
# If your SOURCE_ZONE area is 50 meters wide and 130 meters long:
TARGET_WIDTH=50
TARGET_HEIGHT=130

# And your SOURCE_ZONE polygon corners are at these pixel coordinates:
# Format: x1,y1,x2,y2,x3,y3,x4,y4
SOURCE_POLYGON=422,10,594,16,801,665,535,649
# This creates a polygon that covers the real 50m x 130m SOURCE_ZONE area
```

### Step 4: Test Your Zones
Update your `backend/.env` file with example coordinates (adjust for your video):

```env
SOURCE_POLYGON=422,10,594,16,801,665,535,649
STOP_ZONE_POLYGON=507,199,681,209,751,555,484,541
```

## Detection Settings

### Basic Detection Parameters
Open `backend/.env` and adjust these values (optional - defaults will be used if not set):

```env
# Detection sensitivity (0.1-0.9, lower = more detections)
# Start with 0.25, increase if too many false positives
DETECTION_CONFIDENCE=0.25

# Remove duplicate detections (0.1-0.8, higher = more aggressive removal)
# Start with 0.3, increase if overlapping boxes
NMS_THRESHOLD=0.3

# Vehicle speed threshold for stationary detection (pixels/frame, lower = more sensitive to movement)
# Start with 0.6, lower values = more vehicles considered stationary
VELOCITY_THRESHOLD=0.6
```

### How to Calculate VELOCITY_THRESHOLD

#### Method 1: Manual Calculation
1. **Measure your video resolution** (width x height)
2. **Estimate real-world speed** of slow-moving vehicles (e.g., 5 km/h = 1.4 m/s)
3. **Calculate pixels per frame**:
   ```python
   # Example: 1920x1080 video, 30 FPS, 5 km/h vehicle
   video_width = 1920
   fps = 30
   real_speed_kmh = 5  # km/h
   real_speed_ms = real_speed_kmh / 3.6  # Convert to m/s
   
   # If your SOURCE_ZONE is 50m wide in real world
   real_zone_width = 50  # meters
   pixels_per_meter = video_width / real_zone_width
   
   # Calculate pixels per frame for 5 km/h vehicle
   pixels_per_frame = (real_speed_ms * pixels_per_meter) / fps
   print(f"VELOCITY_THRESHOLD should be around: {pixels_per_frame:.2f}")
   ```

#### Method 2: Trial and Error
1. **Start with default**: `VELOCITY_THRESHOLD=0.6` in your `.env` file
2. **Run processing** and check results
3. **Adjust based on results**:
   - Too many stationary vehicles → Increase threshold (0.8, 1.0)
   - Not detecting stationary vehicles → Decrease threshold (0.3, 0.4)
4. **Update your `.env` file** with the new value

#### Method 3: Use Built-in Testing Tools
1. **Navigate to the testing tools:**
   ```bash
   cd backend/utils/velocity_testing/
   ```

2. **Run the velocity threshold test:**
   ```bash
   python realistic_velocity_test.py
   ```

3. **Follow the recommendations** provided by the test

4. **Update your `.env` file** with the recommended value (e.g., `VELOCITY_THRESHOLD=0.75`)

**Note:** This method tests realistic vehicle movement patterns and provides specific recommendations for your video.

### Advanced Detection Settings
Add these to your `backend/.env` file (optional - defaults will be used if not set):

```env
# Frame processing (higher = faster processing, lower = more accurate)
FRAME_BUFFER=5
DETECTION_OVERLAP_THRESHOLD=0.5
CLASS_CONFIDENCE_THRESHOLD=0.5
CLASS_HISTORY_FRAMES=10
```

### Performance Tuning Tips

#### For High-Traffic Videos
Add these to your `backend/.env`:
```env
DETECTION_CONFIDENCE=0.3
VELOCITY_THRESHOLD=0.8
FRAME_BUFFER=3
```

#### For Low-Traffic Videos
Add these to your `backend/.env`:
```env
DETECTION_CONFIDENCE=0.2
VELOCITY_THRESHOLD=0.4
FRAME_BUFFER=7
```

#### For Fast-Moving Vehicles
Add these to your `backend/.env`:
```env
VELOCITY_THRESHOLD=1.0
DETECTION_CONFIDENCE=0.3
```

#### For Slow/Stationary Vehicles
Add these to your `backend/.env`:
```env
VELOCITY_THRESHOLD=0.3
DETECTION_CONFIDENCE=0.2
```

## Quick Start

### For Default Video Users:
1. **Copy environment example file:**
   ```bash
   cp backend/env.example backend/.env
   ```

2. **Configure required settings in `backend/.env`:**
   - Set `SOURCE_POLYGON` (comma-separated coordinates: `x1,y1,x2,y2,x3,y3,x4,y4`)
   - Set `STOP_ZONE_POLYGON` (comma-separated coordinates)
   - Set `LOCATION_LAT` and `LOCATION_LON` (for weather data)
   - Set `TARGET_WIDTH` and `TARGET_HEIGHT` (real dimensions of your zone)

3. **Optionally adjust detection settings** in `.env` if defaults don't work

4. **Run the system**

### For Custom Video Users:
1. **Place your video** in `backend/asset/your_video.mp4`

2. **Update video path** in `backend/config/config.py`:
   ```python
   VIDEO_PATH = os.path.join(BACKEND_ROOT, 'asset', 'your_video.mp4')
   ```

3. **Copy environment example file:**
   ```bash
   cp backend/env.example backend/.env
   ```

4. **Configure required settings in `backend/.env`:**
   - Set `SOURCE_POLYGON` (comma-separated coordinates: `x1,y1,x2,y2,x3,y3,x4,y4`)
   - Set `STOP_ZONE_POLYGON` (comma-separated coordinates)
   - Set `LOCATION_LAT` and `LOCATION_LON` (for weather data)
   - Set `TARGET_WIDTH` and `TARGET_HEIGHT` (real dimensions of your zone)

5. **Important**: Since you're using a custom video, you **must** get new zone coordinates:
   - Follow the [Zone Setup Steps](#zone-setup-steps) section below
   - Use the interactive notebook or coordinate tools to get coordinates for your video
   - Update the polygon values in your `.env` file

6. **Optionally adjust detection settings** in `.env` if defaults don't work

7. **Run the system**

## Validation & Testing

### Run the Video Processor
After setup is complete, validate your configuration by running:

```bash
npm run processor
```

This will:
- Process your video with the configured settings
- Show real-time detection and tracking
- Validate that your zones are working correctly
- Generate output video with annotations
- Display processing statistics

### What to Check During Processing
- ✅ Vehicles are detected in your SOURCE_ZONE
- ✅ Vehicles are tracked as they move
- ✅ Stationary vehicles are detected in STOP_ZONE
- ✅ Vehicle counts are accurate
- ✅ No false detections outside your zones

### If Issues Found
- **No detections**: Lower `DETECTION_CONFIDENCE` in `.env` (try `DETECTION_CONFIDENCE=0.2`)
- **Too many false positives**: Increase `DETECTION_CONFIDENCE` in `.env` (try `DETECTION_CONFIDENCE=0.3`)
- **Zones not working**: Check your coordinate values in `.env` (ensure comma-separated format: `x1,y1,x2,y2,x3,y3,x4,y4`)
- **Poor tracking**: Adjust `VELOCITY_THRESHOLD` in `.env`
- **Too many stationary vehicles**: Increase `VELOCITY_THRESHOLD` in `.env` (try `VELOCITY_THRESHOLD=0.8`)
- **Not detecting stationary vehicles**: Decrease `VELOCITY_THRESHOLD` in `.env` (try `VELOCITY_THRESHOLD=0.3`)
- **Application fails to start**: Ensure required environment variables are set (`SOURCE_POLYGON`, `STOP_ZONE_POLYGON`, `LOCATION_LAT`, `LOCATION_LON`)

That's it! 🎬
