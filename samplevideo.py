import cv2
import os

# Create a 'frames' folder if it doesn't exist
if not os.path.exists('frames'):
    os.makedirs('frames')

# Open the video file
cap = cv2.VideoCapture('sample_video.mp4')

# Check if the video opened successfully
if not cap.isOpened():
    print("Error: Couldn't open video.")
    exit()

# Extract frames
frame_count = 0
while True:
    ret, frame = cap.read()
    if not ret:
        break
    frame_count += 1
    # Save frames in the 'frames' folder
    cv2.imwrite(f"frames/frame_{frame_count}.jpg", frame)

cap.release()  # Release the video capture object
