import argparse
from collections import defaultdict, deque
import cv2
import numpy as np
from ultralytics import YOLO
import supervision as sv
import csv

# Define SOURCE and TARGET constants
SOURCE = np.array(((422, 10), (535, 649), (801, 665), (594, 16)))

TARGET_WIDTH = 5
TARGET_HEIGHT = 130

TARGET = np.array(
    [
        [0, 0],
        [TARGET_WIDTH - 1, 0],
        [TARGET_WIDTH - 1, TARGET_HEIGHT - 1],
        [0, TARGET_HEIGHT - 1],
    ]
)

# Define Stop Zone (Before the giveaway sign)
STOP_ZONE = np.array(
    [
        (540, 307),
        (735, 310),
        (746, 557),
        (490, 555),
    ]
)

CLASS_NAMES = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck"
}

class ViewTransformer:
    def __init__(self, source: np.ndarray, target: np.ndarray) -> None:
        source = source.astype(np.float32)
        target = target.astype(np.float32)
        self.m = cv2.getPerspectiveTransform(source, target)

    def transform_points(self, points: np.ndarray) -> np.ndarray:
        if points.size == 0:
            return points
        reshaped_points = points.reshape(-1, 1, 2).astype(np.float32)
        transformed_points = cv2.perspectiveTransform(reshaped_points, self.m)
        return transformed_points.reshape(-1, 2)

def update_csv(tracker_status, csvfile, writer):
    """ Update the CSV file with the latest vehicle status """
    csvfile.seek(0)  # Move to the start of the file
    csvfile.truncate()  # Clear the file
    writer.writeheader()  # Re-write the header
    for tid, data in tracker_status.items():
        writer.writerow({"tracker_id": tid, "vehicle_type": data["vehicle_type"], "status": data["status"], "compliance": data["compliance"]})
    csvfile.flush()

if __name__ == "__main__":
    video_info = sv.VideoInfo.from_video_path(video_path='./asset/videoplayback.mp4')
    video_info.fps = 25

    model = YOLO("yolo11n.pt")

    byte_track = sv.ByteTrack(
        frame_rate=video_info.fps, track_activation_threshold=0.3
    )

    thickness = sv.calculate_optimal_line_thickness(
        resolution_wh=video_info.resolution_wh
    )
    text_scale = sv.calculate_optimal_text_scale(resolution_wh=video_info.resolution_wh)

    box_annotator = sv.BoxAnnotator(thickness=thickness)
    trace_annotator = sv.TraceAnnotator(
        thickness=thickness,
        trace_length=video_info.fps * 2,
        position=sv.Position.BOTTOM_CENTER,
    )

    label_annotator_top_left = sv.LabelAnnotator(
        text_scale=text_scale,
        text_thickness=thickness,
        text_position=sv.Position.TOP_LEFT,
    )

    label_annotator_bottom = sv.LabelAnnotator(
        text_scale=text_scale,
        text_thickness=thickness,
        text_position=sv.Position.BOTTOM_CENTER,
    )

    frame_generator = sv.get_video_frames_generator(source_path='./asset/videoplayback.mp4')

    polygon_zone = sv.PolygonZone(polygon=SOURCE)
    stop_zone = sv.PolygonZone(polygon=STOP_ZONE)  # Define the stop zone
    view_transformer = ViewTransformer(source=SOURCE, target=TARGET)

    vehicle_counts = defaultdict(int)
    processed_tracker_ids = set()
    stopped_vehicles = defaultdict(int)  # Track how long a vehicle has been stopped

    # Dictionary to store the latest status for each tracker ID
    tracker_status = {}

    # Set of tracker IDs that are currently inside the stop zone and compliant
    compliant_vehicles = set()

   

    # Variable to track all vehicles that have ever been in the stop zone
    historical_stop_zone_data = {}

    with open('./asset/tracking_results.csv', mode='w', newline='') as csvfile:
        fieldnames = ["tracker_id", "vehicle_type", "status", "compliance"]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()  # Write the header once

        try:
            with sv.VideoSink('./asset/TrackingWithStopResult.mp4', video_info) as sink:
                tracker_types = {}  # Moved outside the loop to persist vehicle types

                for frame in frame_generator:
                    result = model(frame)[0]
                    detections = sv.Detections.from_ultralytics(result)
                    detections = detections[detections.confidence > 0.4]
                    detections = detections[polygon_zone.trigger(detections)]
                    detections = detections.with_nms(threshold=0.6)
                    detections = byte_track.update_with_detections(detections=detections)

                    # Get both original and transformed anchor points
                    anchor_points = detections.get_anchors_coordinates(anchor=sv.Position.BOTTOM_CENTER)
                    transformed_points = view_transformer.transform_points(points=anchor_points).astype(int)

                    top_left_labels = []
                    bottom_labels = []

                    for tracker_id, orig_point, trans_point, class_id in zip(
                        detections.tracker_id, anchor_points, transformed_points, detections.class_id
                    ):
                        if tracker_id not in tracker_types:
                            tracker_types[tracker_id] = CLASS_NAMES.get(class_id, "unknown")

                        vehicle_type = tracker_types[tracker_id]
                        status = "moving"
                        compliance = 0  # Default compliance value

                        # Check if this specific vehicle is inside the stop zone using original point
                        pt = tuple(map(float, orig_point))  # ensure it's (x, y) and float
                        is_in_stop_zone = cv2.pointPolygonTest(stop_zone.polygon.astype(np.float32), pt, False) >= 0

                        if is_in_stop_zone:
                            stopped_vehicles[tracker_id] += 1

                            if stopped_vehicles[tracker_id] > video_info.fps * 2:
                                status = "stopped"
                                compliance = 1  # Compliant if stopped
                                compliant_vehicles.add(tracker_id)  # Add vehicle to compliant set
                            elif stopped_vehicles[tracker_id] > video_info.fps:
                                status = "slower"
                                compliance = 1  # Compliant if slower

                            # Update tracker status in memory only when it changes
                            if tracker_id not in tracker_status or tracker_status[tracker_id]["status"] != status:
                                tracker_status[tracker_id] = {"vehicle_type": vehicle_type, "status": status, "compliance": compliance}

                         

                            # Add vehicle to historical data
                            historical_stop_zone_data[tracker_id] = {"vehicle_type": vehicle_type, "status": status, "compliance": compliance}
                        else:
                            stopped_vehicles[tracker_id] = 0

                           

                            # Prevent the status from changing to "moving" or "slower" if it's already stopped or slower
                            if tracker_id in compliant_vehicles:
                                continue  # Skip the status change if already compliant

                            # Otherwise, reset to "moving" if vehicle is not compliant and leaves the stop zone
                            if tracker_id not in compliant_vehicles:
                                status = "moving"  # Only reset to moving if it is not compliant and leaves the zone

                            # Update tracker status in memory only when it changes
                            if tracker_id not in tracker_status or tracker_status[tracker_id]["status"] != status:
                                tracker_status[tracker_id] = {"vehicle_type": vehicle_type, "status": status, "compliance": compliance}

                        # Update labels
                        if status == "stopped":
                            top_left_labels.append(f"{vehicle_type} stopped")
                        elif status == "slower":
                            top_left_labels.append(f"{vehicle_type} slower")
                        else:
                            top_left_labels.append(vehicle_type)

                        bottom_labels.append(f"#{tracker_id}")

                    # Save all historical stop zone data to the CSV file
                    csvfile.seek(0)  # Move to the start of the file
                    csvfile.truncate()  # Clear the file
                    writer.writeheader()  # Re-write the header
                    for tid, data in historical_stop_zone_data.items():
                        writer.writerow({"tracker_id": tid, "vehicle_type": data["vehicle_type"], "status": data["status"], "compliance": data["compliance"]})
                    csvfile.flush()

                    # Ensure labels match the number of detections
                    while len(top_left_labels) < len(detections):
                        top_left_labels.append("")
                    while len(bottom_labels) < len(detections):
                        bottom_labels.append("")

                    annotated_frame = trace_annotator.annotate(scene=frame.copy(), detections=detections)
                    annotated_frame = box_annotator.annotate(scene=annotated_frame, detections=detections)

                    annotated_frame = label_annotator_top_left.annotate(
                        scene=annotated_frame, detections=detections, labels=top_left_labels
                    )
                    annotated_frame = label_annotator_bottom.annotate(
                        scene=annotated_frame, detections=detections, labels=bottom_labels
                    )

                    # Draw stop zone polygon (optional but useful)
                    cv2.polylines(annotated_frame, [STOP_ZONE], isClosed=True, color=(0, 255, 255), thickness=2)

                    sink.write_frame(annotated_frame)
                    cv2.imshow("Tracking with Stop", annotated_frame)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break

        except Exception as e:
            print(f"Error: {e}")

        finally:
            csvfile.flush()
            print("Tracking data has been saved.")

        cv2.destroyAllWindows()
        print("Vehicle Counts:")
        for vehicle, count in vehicle_counts.items():
            print(f"{vehicle}: {count}")
