import cv2
import numpy as np

class ViewTransformer:
    def __init__(self, source: np.ndarray, target_size: tuple[int, int]):
        target = np.array([
            [0, 0], [target_size[0] - 1, 0],
            [target_size[0] - 1, target_size[1] - 1], [0, target_size[1] - 1]
        ], dtype=np.float32)
        self.m = cv2.getPerspectiveTransform(source.astype(np.float32), target)

    def transform(self, points: np.ndarray) -> np.ndarray:
        if points.size == 0:
            return points
        return cv2.perspectiveTransform(
            points.reshape(-1, 1, 2).astype(np.float32), self.m
        ).reshape(-1, 2)
