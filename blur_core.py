import cv2
import os

def process_video(video_path='sample_video.mp4', output_video='processed_video.mp4', frames_dir='frames'):
    # Load Haar cascade for license plate detection
    plate_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_russian_plate_number.xml')

    # Create 'frames' directory if it doesn't exist
    os.makedirs(frames_dir, exist_ok=True)

    # Open the video file
    cap = cv2.VideoCapture(video_path)

    # Check if the video opened successfully
    if not cap.isOpened():
        raise FileNotFoundError("Error: Couldn't open video.")

    frame_count = 0
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = int(cap.get(cv2.CAP_PROP_FPS))

    # Define the codec and create a VideoWriter object
    out = cv2.VideoWriter(output_video, cv2.VideoWriter_fourcc(*'mp4v'), fps, (frame_width, frame_height))

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
        cv2.imwrite(f"{frames_dir}/frame_{frame_count:04d}.jpg", frame)

        # Write the frame to the video file
        out.write(frame)

    cap.release()
    out.release()
    return {
        "message": f"✅ Processing complete. {frame_count} frames saved in '{frames_dir}' folder.",
        "video_output": f"✅ Processed video saved as '{output_video}'."
    }
