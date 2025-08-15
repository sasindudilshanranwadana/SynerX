import numpy as np
import time
from collections import defaultdict, Counter, deque
from datetime import datetime
import supervision as sv
from config.config import Config

class VehicleTracker:
    """Handles vehicle tracking logic"""
    
    def __init__(self):
        self.position_history = defaultdict(lambda: deque(maxlen=Config.FRAME_BUFFER))
        self.class_history = defaultdict(lambda: deque(maxlen=Config.CLASS_HISTORY_FRAMES))
        self.stable_class = {}
        self.status_cache = {}
        self.stationary_vehicles = set()
        self.entry_times = {}
        self.reaction_times = {}
        self.written_records = set()
    
    def calculate_iou(self, box1, box2):
        """Calculate Intersection over Union of two bounding boxes"""
        x1, y1, x2, y2 = box1
        x3, y3, x4, y4 = box2
        
        xi1, yi1 = max(x1, x3), max(y1, y3)
        xi2, yi2 = min(x2, x4), min(y2, y4)
        
        if xi2 <= xi1 or yi2 <= yi1:
            return 0.0
        
        intersection = (xi2 - xi1) * (yi2 - yi1)
        box1_area = (x2 - x1) * (y2 - y1)
        box2_area = (x4 - x3) * (y4 - y3)
        union = box1_area + box2_area - intersection
        
        return intersection / union if union > 0 else 0.0
    
    def merge_overlapping_detections(self, detections):
        """Merge overlapping detections to prevent duplicate tracker IDs"""
        if len(detections) <= 1:
            return detections
        
        # Safety check for required attributes
        if not hasattr(detections, 'xyxy') or not hasattr(detections, 'class_id') or not hasattr(detections, 'confidence'):
            print("[WARNING] Detections object missing required attributes")
            return detections
        
        boxes, classes, confidences = detections.xyxy, detections.class_id, detections.confidence
        
        # Safety check for array lengths
        if not (len(boxes) == len(classes) == len(confidences)):
            print(f"[WARNING] Array length mismatch in merge_overlapping_detections:")
            print(f"  boxes: {len(boxes)}, classes: {len(classes)}, confidences: {len(confidences)}")
            return detections
        
        merged_indices, used_indices = [], set()
        
        for i in range(len(boxes)):
            if i in used_indices:
                continue
            
            current_group = [i]
            used_indices.add(i)
            
            for j in range(i + 1, len(boxes)):
                if j in used_indices:
                    continue
                
                if self.calculate_iou(boxes[i], boxes[j]) > Config.DETECTION_OVERLAP_THRESHOLD:
                    current_group.append(j)
                    used_indices.add(j)
            
            merged_indices.append(current_group)
        
        # Create merged detections
        merged_boxes, merged_classes, merged_confidences = [], [], []
        
        for group in merged_indices:
            if len(group) == 1:
                idx = group[0]
                merged_boxes.append(boxes[idx])
                merged_classes.append(classes[idx])
                merged_confidences.append(confidences[idx])
            else:
                group_confidences = confidences[group]
                best_idx = np.argmax(group_confidences)
                weights = group_confidences / np.sum(group_confidences)
                avg_box = np.average(boxes[group], axis=0, weights=weights)
                
                merged_boxes.append(avg_box)
                merged_classes.append(classes[group[best_idx]])
                merged_confidences.append(group_confidences[best_idx])
        
        # Safety check before creating new Detections object
        if not (len(merged_boxes) == len(merged_classes) == len(merged_confidences)):
            print(f"[WARNING] Merged arrays length mismatch:")
            print(f"  merged_boxes: {len(merged_boxes)}, merged_classes: {len(merged_classes)}, merged_confidences: {len(merged_confidences)}")
            return detections
        
        return sv.Detections(
            xyxy=np.array(merged_boxes),
            class_id=np.array(merged_classes),
            confidence=np.array(merged_confidences)
        )
    
    def update_class_consistency(self, detections):
        """Update vehicle class consistency"""
        # Safety check for required attributes
        if not hasattr(detections, 'tracker_id') or not hasattr(detections, 'class_id'):
            print("[WARNING] Detections object missing tracker_id or class_id for class consistency update")
            return
        
        # Safety check for array lengths
        if len(detections.tracker_id) != len(detections.class_id):
            print(f"[WARNING] Array length mismatch in update_class_consistency:")
            print(f"  tracker_id: {len(detections.tracker_id)}, class_id: {len(detections.class_id)}")
            return
        
        for i, track_id in enumerate(detections.tracker_id):
            if i >= len(detections.class_id):
                print(f"[WARNING] Index {i} out of bounds for class_id array (length: {len(detections.class_id)})")
                continue
                
            current_class = detections.class_id[i]
            self.class_history[track_id].append(current_class)
            
            if track_id in self.stable_class:
                detections.class_id[i] = self.stable_class[track_id]
            elif len(self.class_history[track_id]) >= 3:
                class_counts = Counter(self.class_history[track_id])
                most_common_class, most_common_count = class_counts.most_common(1)[0]
                confidence_ratio = most_common_count / len(self.class_history[track_id])
                
                if confidence_ratio >= Config.CLASS_CONFIDENCE_THRESHOLD:
                    self.stable_class[track_id] = most_common_class
                    detections.class_id[i] = most_common_class
                    print(f"[INFO] Vehicle #{track_id} class established as {Config.CLASS_NAMES.get(most_common_class, 'unknown')}")
