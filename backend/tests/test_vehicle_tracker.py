import sys
import types
import time
import numpy as np


class _FakeDetections:
    def __init__(self, xyxy, class_id, confidence, tracker_id=None):
        self.xyxy = np.array(xyxy)
        self.class_id = np.array(class_id)
        self.confidence = np.array(confidence)
        if tracker_id is not None:
            self.tracker_id = np.array(tracker_id)
        else:
            self.tracker_id = np.arange(len(self.xyxy))
    
    def __len__(self):
        return len(self.xyxy)


def _install_fake_supervision_module():
    """Install a minimal fake 'supervision' module into sys.modules so
    `utils.vehicle_tracker` can import `sv.Detections` without the real package.
    """
    mod = types.SimpleNamespace(Detections=_FakeDetections)
    sys.modules['supervision'] = mod


def _install_fake_config_module():
    """Install a minimal fake 'config.config' module with required Config attributes."""
    fake_config = types.SimpleNamespace(
        FRAME_BUFFER=5,
        CLASS_HISTORY_FRAMES=10,
        CLASS_CONFIDENCE_THRESHOLD=0.5,
        DETECTION_OVERLAP_THRESHOLD=0.5,
        CLASS_NAMES={2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
    )
    config_mod = types.SimpleNamespace(Config=fake_config)
    sys.modules['config'] = types.SimpleNamespace()
    sys.modules['config.config'] = config_mod


def test_iou_and_merge_behavior():
    # Ensure vehicle_tracker imports our fake supervision module
    _install_fake_supervision_module()
    _install_fake_config_module()
    from utils.vehicle_tracker import VehicleTracker

    vt = VehicleTracker()

    # Simple IoU test (overlapping boxes)
    b1 = (0, 0, 10, 10)
    b2 = (5, 5, 15, 15)
    iou = vt.calculate_iou(b1, b2)
    # Intersection is 5x5=25, union = 100+100-25=175 -> 25/175 ~= 0.142857
    assert abs(iou - (25.0 / 175.0)) < 1e-6

    # Test merging: two highly overlapping boxes should merge into one
    # Use boxes that have >50% overlap to trigger merge
    b1 = (0, 0, 10, 10)
    b3 = (3, 3, 13, 13)  # 7x7=49 intersection, 100+100-49=151 union -> IoU ~0.324
    b4 = (2, 2, 12, 12)  # 8x8=64 intersection, 100+100-64=136 union -> IoU ~0.47
    b_high_overlap = (1, 1, 9, 9)  # 8x8=64 intersection, 100+64-64=100 union -> IoU = 0.64
    boxes = [b1, b_high_overlap]
    classes = [2, 2]
    confidences = [0.6, 0.9]
    detections = _FakeDetections(boxes, classes, confidences)

    merged = vt.merge_overlapping_detections(detections)
    # After merging we expect a single detection
    assert len(merged.xyxy) == 1
    # Class should be taken from the highest confidence (index 1 -> class 2)
    assert merged.class_id.shape[0] == 1
    assert merged.confidence.shape[0] == 1


def test_tracker_performance_merge_and_class_updates():
    """Lightweight performance test for merge_overlapping_detections and
    update_class_consistency. This creates synthetic detections and asserts
    the operations complete within a reasonable time budget.
    """
    _install_fake_supervision_module()
    _install_fake_config_module()
    from utils.vehicle_tracker import VehicleTracker

    vt = VehicleTracker()

    # Create many small non-overlapping boxes to simulate load
    N = 200
    boxes = []
    classes = []
    confs = []
    tracker_ids = list(range(N))
    for i in range(N):
        x = i * 20
        boxes.append((x, 0, x + 10, 10))
        classes.append(2 if (i % 3) else 3)
        confs.append(0.5 + (i % 5) * 0.1)

    detections = _FakeDetections(boxes, classes, confs, tracker_id=tracker_ids)

    start = time.perf_counter()
    merged = vt.merge_overlapping_detections(detections)
    # merge should not create more detections than original
    assert len(merged.xyxy) <= N
    mid = time.perf_counter()

    # Simulate several frames to update class consistency history
    for _ in range(5):
        # flip classes slightly to simulate noisy classifier
        noisy = detections.class_id.copy()
        noisy = (noisy + (_ % 2)) % 5
        detections.class_id = noisy
        vt.update_class_consistency(detections)

    end = time.perf_counter()
    merge_time = mid - start
    update_time = end - mid

    # Keep thresholds generous for CI machines; these should be fast on modern dev boxes
    assert merge_time < 1.5, f"merge took too long: {merge_time:.2f}s"
    assert update_time < 1.5, f"class updates took too long: {update_time:.2f}s"
