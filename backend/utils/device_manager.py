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
        """Clear GPU memory if using CUDA"""
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            return True
        return False
    
    @staticmethod
    def handle_gpu_memory_error(func, *args, **kwargs):
        """Handle GPU out of memory errors by clearing cache and retrying"""
        try:
            return func(*args, **kwargs)
        except RuntimeError as e:
            if "out of memory" in str(e).lower() and torch.cuda.is_available():
                print(f"[WARNING] GPU out of memory. Clearing cache and retrying...")
                torch.cuda.empty_cache()
                return func(*args, **kwargs)
            else:
                raise e
