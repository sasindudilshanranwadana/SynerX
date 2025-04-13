# SynerX

Road-User Behaviour Analysis Using AI &amp; Computer Vision (Project 49)

Run the following in either a code cell before the main code in Google Colab, or in your terminal:

pip install ultralytics supervision

If running Colab tests, upload /asset/ contents into your Drive Account, make sure to match the file paths in the code to your drive locations.

## The New Video

The new video file used for tracking and status detection is located in the `asset` folder:

📁 **Path**: `asset/videoplayback.mp4`

This video is used as the input for the vehicle detection, tracking, and stopping behavior analysis system.

> Ensure this file exists in the correct directory before running the script.

## 📁 Test Data

> ⚠️ **Important Notice:**

- The files `tracking_results.csv` and `vehicle_count.csv` will be **reset (overwritten)** every time the program is re-run.
- If you have already collected valuable or large amounts of data, please make sure to **rename the existing files** or **update the output file paths in the code** before running the script again.
- Otherwise, all data in those files will be **lost**.
- For testing data, we can use `tracking_results_test.csv`.

Ensure you manage and back up your data appropriately.

## 🚀 Installation Guide

Follow the steps below to set up and run the project.

### 📁 1. Clone the Repository

```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
```

### 🧪 2. (Optional) Create a Virtual Environment

This helps keep dependencies isolated.

```bash
python -m venv venv
source venv/bin/activate  # For Windows: venv\Scripts\activate
```

### 📦 3. Install Requirements

Make sure you have `pip` installed, then run the following command to install all the required dependencies listed in the `requirements.txt` file:

```bash
pip install -r requirements.txt
```

### 🎥 4. Run the Program

To run the program, follow these steps:

1. **Prepare Your Test Data**:  
   Place your test video file in the `asset/` directory. Ensure that the video file is named as specified in the code (e.g., `videoplayback.mp4`), or update the `VIDEO_PATH` variable in the script to reflect the correct path.

2. **Execute the Script**:  
   Run the following command in your terminal:

   ```bash
   python main.py
   ```
