import cv2
import os

def blur_plates_yolo(video_path='sample_video.mp4', output_video='processed_video.mp4', frames_dir='frames'):
    """
    Blurs license plates in a video using Haar Cascade.
    
    Args:
        video_path (str): Input video path
        output_video (str): Path to save the processed video
        frames_dir (str): Directory to optionally save processed frames

    Returns:
        dict: Result message and output video path
    """
    # Load Haar cascade for license plate detection
    plate_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_russian_plate_number.xml')

    # Create directory for optional debug frames
    os.makedirs(frames_dir, exist_ok=True)

    # Open the input video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise FileNotFoundError("❌ Error: Couldn't open video.")

    frame_count = 0
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)

    # Define the codec and create output video writer
    out = cv2.VideoWriter(output_video, cv2.VideoWriter_fourcc(*'mp4v'), fps, (frame_width, frame_height))

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Convert to grayscale for detection
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)  # enhance contrast

        # Detect plates
        plates = plate_cascade.detectMultiScale(
            gray,
            scaleFactor=1.05,
            minNeighbors=3,
            minSize=(20, 20)
        )

        # Blur each plate detected
        for (x, y, w, h) in plates:
            roi = frame[y:y+h, x:x+w]
            blurred = cv2.GaussianBlur(roi, (25, 25), 30)
            frame[y:y+h, x:x+w] = blurred

        # Optionally save debug frame
        cv2.imwrite(f"{frames_dir}/frame_{frame_count:04d}.jpg", frame)

        # Write frame to output video
        out.write(frame)
        frame_count += 1

    cap.release()
    out.release()

    return {
        "message": f"✅ Processed {frame_count} frames. Output: '{output_video}'",
        "output_video": output_video
    }
