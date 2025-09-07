from pydantic import BaseModel
from typing import Dict, List, Optional, Any

# Response models for better API documentation
class JobStatusResponse(BaseModel):
    status: str
    message: str
    removed_count: Optional[int] = None
    remaining_jobs: Optional[int] = None
    error: Optional[str] = None

class CleanupResponse(BaseModel):
    status: str
    message: str
    cleaned_count: Optional[int] = None
    error: Optional[str] = None

class QueueStatusResponse(BaseModel):
    status: str
    queue_processor_running: bool
    queue_length: int
    total_jobs: int
    status_counts: Dict[str, int]
    queue_details: List[Dict[str, Any]]
