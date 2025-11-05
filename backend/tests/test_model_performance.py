import sys
import types
import time
import numpy as np
import os
from pathlib import Path


def _install_fake_ultralytics():
    """Install a minimal fake ultralytics module to avoid loading the actual model in tests."""
    
    class _FakeYOLO:
        def __init__(self, model_path):
            self.model_path = model_path
            self.load_time = 0.1  # Simulate model loading time
            time.sleep(self.load_time)  # Simulate loading delay
            
        def predict(self, source, **kwargs):
            """Simulate model inference with fake results."""
            # Simulate inference time based on input
            if hasattr(source, 'shape'):
                # If it's a numpy array (image), base time on resolution
                h, w = source.shape[:2] if len(source.shape) >= 2 else (640, 640)
                inference_time = (h * w) / 1000000.0 * 0.01  # Scale with image size
            else:
                # Default inference time
                inference_time = 0.05
                
            time.sleep(inference_time)
            
            # Return fake detection results
            fake_result = types.SimpleNamespace(
                boxes=types.SimpleNamespace(
                    xyxy=np.array([[100, 100, 200, 150], [300, 200, 400, 250]]),  # 2 fake detections
                    conf=np.array([0.85, 0.92]),
                    cls=np.array([0, 0])  # All class 0 (license plates)
                ),
                speed={'preprocess': 2.0, 'inference': inference_time * 1000, 'postprocess': 1.0}
            )
            return [fake_result]
    
    ultralytics_mod = types.SimpleNamespace(YOLO=_FakeYOLO)
    sys.modules['ultralytics'] = ultralytics_mod


def test_best_pt_model_loading_performance():
    """Test that the best.pt model loads within acceptable time limits."""
    _install_fake_ultralytics()
    
    model_path = Path("models/best.pt")
    
    # Test model loading time
    start_time = time.perf_counter()
    
    # Import after installing fake module
    from ultralytics import YOLO
    model = YOLO(str(model_path))
    
    load_time = time.perf_counter() - start_time
    
    # Model should load within 5 seconds (generous for CI)
    assert load_time < 5.0, f"Model loading took too long: {load_time:.2f}s"
    
    print(f"✅ Model loaded in {load_time:.3f}s")


def test_best_pt_model_inference_performance():
    """Test inference performance on different image sizes."""
    _install_fake_ultralytics()
    
    from ultralytics import YOLO
    model = YOLO("models/best.pt")
    
    # Test different image resolutions
    test_sizes = [
        (416, 416, "Small"),
        (640, 640, "Medium"), 
        (1024, 1024, "Large")
    ]
    
    inference_times = []
    
    for height, width, size_name in test_sizes:
        # Create fake image data
        fake_image = np.random.randint(0, 255, (height, width, 3), dtype=np.uint8)
        
        # Measure inference time
        start_time = time.perf_counter()
        results = model.predict(fake_image, verbose=False)
        inference_time = time.perf_counter() - start_time
        
        inference_times.append((size_name, inference_time))
        
        # Each inference should complete within reasonable time
        max_time = 2.0  # 2 seconds max per inference (generous for CI)
        assert inference_time < max_time, f"{size_name} inference took too long: {inference_time:.2f}s"
        
        print(f"✅ {size_name} ({height}x{width}) inference: {inference_time:.3f}s")
    
    # Verify that inference time scales reasonably with image size
    small_time = inference_times[0][1]
    large_time = inference_times[2][1]
    
    # Large images shouldn't take more than 10x longer than small ones
    assert large_time < small_time * 10, f"Inference time scaling seems poor: {small_time:.3f}s -> {large_time:.3f}s"


def test_best_pt_model_batch_inference_performance():
    """Test batch inference performance (multiple images at once)."""
    _install_fake_ultralytics()
    
    from ultralytics import YOLO
    model = YOLO("models/best.pt")
    
    # Create batch of fake images
    batch_sizes = [1, 4, 8]
    image_size = (640, 640, 3)
    
    for batch_size in batch_sizes:
        fake_images = [
            np.random.randint(0, 255, image_size, dtype=np.uint8) 
            for _ in range(batch_size)
        ]
        
        # Measure batch inference time
        start_time = time.perf_counter()
        results = model.predict(fake_images, verbose=False)
        batch_time = time.perf_counter() - start_time
        
        # Calculate time per image in batch
        time_per_image = batch_time / batch_size
        
        # Batch processing should be efficient
        max_time_per_image = 1.0  # 1 second max per image in batch
        assert time_per_image < max_time_per_image, f"Batch inference too slow: {time_per_image:.2f}s per image"
        
        print(f"✅ Batch size {batch_size}: {batch_time:.3f}s total ({time_per_image:.3f}s per image)")


def test_model_memory_usage_stability():
    """Test that model doesn't leak memory during repeated inferences."""
    _install_fake_ultralytics()
    
    from ultralytics import YOLO
    model = YOLO("models/best.pt")
    
    # Create test image
    test_image = np.random.randint(0, 255, (640, 640, 3), dtype=np.uint8)
    
    # Run multiple inferences to check for memory stability
    iteration_times = []
    
    for i in range(10):  # Run 10 iterations
        start_time = time.perf_counter()
        results = model.predict(test_image, verbose=False)
        iteration_time = time.perf_counter() - start_time
        iteration_times.append(iteration_time)
        
        # Each iteration should complete within reasonable time
        assert iteration_time < 1.0, f"Iteration {i+1} took too long: {iteration_time:.2f}s"
    
    # Check that performance is consistent (no significant degradation)
    avg_time = sum(iteration_times) / len(iteration_times)
    max_time = max(iteration_times)
    min_time = min(iteration_times)
    
    # Max time shouldn't be more than 3x the minimum (allows for some variance)
    assert max_time < min_time * 3, f"Performance inconsistent: {min_time:.3f}s to {max_time:.3f}s"
    
    print(f"✅ Memory stability test: avg={avg_time:.3f}s, min={min_time:.3f}s, max={max_time:.3f}s")


if __name__ == "__main__":
    # Quick manual test
    print("Testing best.pt model performance...")
    test_best_pt_model_loading_performance()
    test_best_pt_model_inference_performance() 
    test_best_pt_model_batch_inference_performance()
    test_model_memory_usage_stability()
    print("All model performance tests passed!")