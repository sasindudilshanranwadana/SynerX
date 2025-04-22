import cv2 
import os

# Load Haar cascade for license plate detection
plate_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_russian_plate_number.xml')

# Create 'frames' directory if it doesn't exist
os.makedirs('frames', exist_ok=True)

# Open the video file
cap = cv2.VideoCapture('sample_video.mp4')

# Check if the video opened successfully
if not cap.isOpened():
    print("Error: Couldn't open video.")
    exit()

frame_count = 0

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Convert to grayscale and enhance contrast
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)  # Improve contrast

    # Detect plates with tuned parameters
    plates = plate_cascade.detectMultiScale(
        gray,
        scaleFactor=1.05,    # more sensitive
        minNeighbors=3,      # less strict, detects more
        minSize=(20, 20)     # smaller plates
    )

    # Blur all detected plates
    for (x, y, w, h) in plates:
        roi = frame[y:y+h, x:x+w]
        blurred_roi = cv2.GaussianBlur(roi, (25, 25), 30)
        frame[y:y+h, x:x+w] = blurred_roi

    # Save the processed frame
    frame_count += 1
    cv2.imwrite(f"frames/frame_{frame_count:04d}.jpg", frame)

cap.release()
print(f"✅ Processing complete. {frame_count} frames saved in 'frames' folder.")
