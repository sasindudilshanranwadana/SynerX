import torch

class DeviceManager:
    """Manages device selection and GPU operations"""
    
    @staticmethod
    def get_device():
        """Get the best available device (CUDA GPU or CPU)"""
        if torch.cuda.is_available():
            return "cuda"
        return "cpu"
    
    @staticmethod
    def get_gpu_info():
        """Get GPU information if available"""
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            return f"CUDA GPU: {gpu_name}"
        return "CPU (CUDA not available)"
    
    @staticmethod
    def clear_gpu_memory():
        """Clear GPU memory if using CUDA with optimization"""
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            # Force garbage collection for better memory management
            import gc
            gc.collect()
            return True
        return False
    
    @staticmethod
    def get_memory_info():
        """Get GPU memory information if available"""
        if torch.cuda.is_available():
            allocated = torch.cuda.memory_allocated() / 1024**3  # GB
            cached = torch.cuda.memory_reserved() / 1024**3  # GB
            return f"GPU Memory: {allocated:.2f}GB allocated, {cached:.2f}GB cached"
        return "CPU mode - no GPU memory info"
    
    @staticmethod
    def handle_gpu_memory_error(func, *args, **kwargs):
        """Handle GPU out of memory errors by clearing cache and retrying"""
        try:
            return func(*args, **kwargs)
        except RuntimeError as e:
            if "out of memory" in str(e).lower() and torch.cuda.is_available():
                print(f"[WARNING] GPU out of memory. Clearing cache and retrying...")
                print(f"[INFO] {DeviceManager.get_memory_info()}")
                torch.cuda.empty_cache()
                import gc
                gc.collect()
                return func(*args, **kwargs)
            else:
                raise e
