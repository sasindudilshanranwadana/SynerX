import cv2
import numpy as np
import supervision as sv
from config.config import Config

class AnnotationManager:
    """Manages video annotation and visualization"""
    
    def __init__(self):
        self.annotators = self._setup_annotators()
    
    def _setup_annotators(self):
        """Setup supervision annotators"""
        return {
            'box': sv.BoxAnnotator(thickness=Config.ANNOTATION_THICKNESS),
            'trace': sv.TraceAnnotator(
                thickness=Config.ANNOTATION_THICKNESS,
                trace_length=Config.TARGET_FPS * Config.TRACE_LENGTH_SECONDS,
                position=sv.Position.BOTTOM_CENTER
            ),
            'label_top': sv.LabelAnnotator(
                text_scale=Config.TEXT_SCALE,
                text_thickness=Config.TEXT_THICKNESS,
                text_position=sv.Position.TOP_LEFT
            ),
            'label_bottom': sv.LabelAnnotator(
                text_scale=Config.TEXT_SCALE,
                text_thickness=Config.TEXT_THICKNESS,
                text_position=sv.Position.BOTTOM_CENTER
            )
        }
    
    def annotate_frame(self, frame, detections, top_labels, bottom_labels):
        """Annotate frame with detections and labels"""
        try:
            # Ensure label lists match detection count
            top_labels += [""] * (len(detections) - len(top_labels))
            bottom_labels += [""] * (len(detections) - len(bottom_labels))
            
            # Safety check for tracker_id array shape
            if hasattr(detections, 'tracker_id') and detections.tracker_id is not None:
                if len(detections.tracker_id) != len(detections):
                    print(f"[WARNING] Tracker ID length mismatch: {len(detections.tracker_id)} vs {len(detections)}")
                    # Create empty detections if there's a mismatch
                    detections = sv.Detections.empty()
            
            # Apply annotations with safety checks
            annotated = frame.copy()
            
            if len(detections) > 0:
                try:
                    annotated = self.annotators['trace'].annotate(scene=annotated, detections=detections)
                except Exception as e:
                    print(f"[WARNING] Trace annotation failed: {e}")
                    # Continue without trace annotation
                
                try:
                    annotated = self.annotators['box'].annotate(annotated, detections)
                except Exception as e:
                    print(f"[WARNING] Box annotation failed: {e}")
                    # Continue without box annotation
                
                try:
                    annotated = self.annotators['label_top'].annotate(annotated, detections, top_labels)
                except Exception as e:
                    print(f"[WARNING] Top label annotation failed: {e}")
                    # Continue without top labels
                
                try:
                    annotated = self.annotators['label_bottom'].annotate(annotated, detections, bottom_labels)
                except Exception as e:
                    print(f"[WARNING] Bottom label annotation failed: {e}")
                    # Continue without bottom labels
            
            return annotated
            
        except Exception as e:
            print(f"[ERROR] Annotation failed: {e}")
            # Return original frame if annotation fails
            return frame
    
    def draw_anchor_points(self, frame, anchor_pts):
        """Draw anchor points if enabled"""
        if Config.SHOW_ANCHOR_POINTS:
            for anchor_pt in anchor_pts:
                cv2.circle(frame, 
                         (int(anchor_pt[0]), int(anchor_pt[1])), 
                         Config.ANCHOR_POINT_RADIUS, 
                         Config.ANCHOR_POINT_COLOR, 
                         Config.ANCHOR_POINT_THICKNESS)
    
    def draw_stop_zone(self, frame):
        """Draw stop zone polygon"""
        cv2.polylines(frame, [Config.STOP_ZONE_POLYGON], True, 
                    Config.STOP_ZONE_COLOR, Config.STOP_ZONE_LINE_THICKNESS)
    
    def resize_for_display(self, frame):
        """Resize frame for display if too large"""
        height, width = frame.shape[:2]
        if width > Config.MAX_DISPLAY_WIDTH:
            scale = Config.MAX_DISPLAY_WIDTH / width
            new_width = int(width * scale)
            new_height = int(height * scale)
            return cv2.resize(frame, (new_width, new_height))
        return frame
    
    @staticmethod
    def point_inside_polygon(point, polygon):
        """Check if point is inside polygon"""
        return cv2.pointPolygonTest(polygon.astype(np.float32), tuple(map(float, point)), False) >= 0
