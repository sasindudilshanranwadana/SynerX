import os
from dotenv import load_dotenv
from supabase import create_client, Client
import json
from datetime import datetime
from typing import Dict, List, Any
import numpy as np
import shutil
import subprocess
from pathlib import Path
import threading

# Load environment variables from .env file
load_dotenv()

# Get Supabase credentials from environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY in environment variables. Please check your .env file.")

# Create Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class SupabaseManager:
    """Supabase manager for SynerX with new video-based schema"""
    
    def __init__(self):
        self.client = supabase
    
    def create_video_record(self, video_data: Dict[str, Any]) -> int:
        """Create a new video record and return the video_id"""
        def to_py(val):
            if isinstance(val, np.generic):
                return val.item()
            return val
        
        try:
            data_to_insert = {
                "video_name": to_py(video_data.get("video_name", "Unknown Video")),
                "original_filename": to_py(video_data.get("original_filename", "unknown.mp4")),
                "original_url": to_py(video_data.get("original_url")),
                "processed_url": to_py(video_data.get("processed_url")),
                "file_size": to_py(video_data.get("file_size", 0)),
                "duration_seconds": to_py(video_data.get("duration_seconds", 0.0)),
                "status": "uploaded"
            }
            
            result = self.client.table("videos").insert(data_to_insert).execute()
            
            if result.data and len(result.data) > 0:
                video_id = result.data[0]['id']
                print(f"✅ Video record created with ID: {video_id}")
                return video_id
            else:
                print("❌ Failed to create video record")
                return None
                
        except Exception as e:
            print(f"❌ Error creating video record: {e}")
            return None
    
    def update_video_status(self, video_id: int, status: str, processed_url: str = None, job_id: int = None, processing_end_time: str = None) -> bool:
        """Update video status and other fields in the videos table"""
        try:
            update_data = {
                "status": status,
                "updated_at": datetime.now().isoformat()
            }
            
            if processed_url:
                update_data["processed_url"] = processed_url
                update_data["processing_end_time"] = datetime.now().isoformat()
            
            if job_id:
                update_data["job_id"] = job_id
                
            if processing_end_time:
                update_data["processing_end_time"] = processing_end_time
            
            result = self.client.table("videos") \
                .update(update_data) \
                .eq("id", video_id) \
                .execute()
            
            if result.data and len(result.data) > 0:
                print(f"✅ Video {video_id} status updated to '{status}'")
                return True
            else:
                print(f"❌ Failed to update video {video_id} status")
                return False
                
        except Exception as e:
            print(f"❌ Error updating video status: {e}")
            return False
    
    def update_video_status_preserve_timing(self, video_id: int, status: str, **kwargs) -> bool:
        """Update video status while preserving existing timing fields"""
        try:
            # First get current video data to preserve timing fields
            current_video = self.get_video_data(video_id)
            if not current_video:
                print(f"❌ Could not retrieve current video data for {video_id}")
                return False
            
            update_data = {
                "status": status,
                "updated_at": datetime.now().isoformat()
            }
            
            # Preserve existing timing fields if not explicitly provided
            if "processing_start_time" not in kwargs and current_video.get("processing_start_time"):
                update_data["processing_start_time"] = current_video["processing_start_time"]
                print(f"[DEBUG] Preserving processing_start_time: {current_video['processing_start_time']}")
            
            # Add any additional fields provided
            update_data.update(kwargs)
            
            result = self.client.table("videos") \
                .update(update_data) \
                .eq("id", video_id) \
                .execute()
            
            if result.data and len(result.data) > 0:
                print(f"✅ Video {video_id} status updated to '{status}' with timing preserved")
                return True
            else:
                print(f"❌ Failed to update video {video_id} status")
                return False
                
        except Exception as e:
            print(f"❌ Error updating video status with timing preservation: {e}")
            return False
    
    def save_tracking_data(self, tracking_data: Dict[str, Any], video_id: int) -> bool:
        """Save tracking data with video_id link"""
        def to_py(val):
            if isinstance(val, np.generic):
                return val.item()
            return val
        
        try:
            tracker_id = to_py(tracking_data.get("tracker_id"))
            
            # Use upsert with unique constraint on tracker_id
            data_to_upsert = {
                "tracker_id": tracker_id,
                "video_id": video_id,  # Link to video
                "vehicle_type": to_py(tracking_data.get("vehicle_type")),
                "status": to_py(tracking_data.get("status")),
                "compliance": to_py(tracking_data.get("compliance", 0)),
                "reaction_time": to_py(tracking_data.get("reaction_time")),
                "weather_condition": to_py(tracking_data.get("weather_condition")),
                "temperature": to_py(tracking_data.get("temperature")),
                "humidity": to_py(tracking_data.get("humidity")),
                "visibility": to_py(tracking_data.get("visibility")),
                "precipitation_type": to_py(tracking_data.get("precipitation_type")),
                "wind_speed": to_py(tracking_data.get("wind_speed")),
                "date": to_py(tracking_data.get("date", datetime.now().isoformat()))
            }
            
            # Log weather data being sent to database
            print(f"[INFO] Saving to DB - Vehicle {tracker_id}: {data_to_upsert.get('vehicle_type')} | Weather: {data_to_upsert.get('weather_condition')}, {data_to_upsert.get('temperature')}°C, {data_to_upsert.get('humidity')}% humidity")
            
            try:
                result = self.client.table("tracking_results") \
                    .upsert(data_to_upsert, on_conflict="tracker_id") \
                    .execute()
                
                if result.data and len(result.data) > 0:
                    print(f"✅ Vehicle {tracker_id} ({data_to_upsert['vehicle_type']}) saved to database successfully")
                    return True
                else:
                    print(f"❌ Failed to save vehicle {tracker_id} to database")
                    return False
            
            except Exception as e:
                print(f"❌ Database error saving vehicle {tracker_id}: {e}")
                return False
            
        except Exception as e:
            print(f"❌ Error processing vehicle data: {e}")
            return False
    
    def save_tracking_data_batch(self, tracking_data_list: List[Dict[str, Any]], video_id: int) -> bool:
        """Save multiple tracking records in one batch operation with video_id link"""
        def to_py(val):
            if isinstance(val, np.generic):
                return val.item()
            return val
        
        try:
            if not tracking_data_list:
                print("[INFO] No records to save in batch")
                return True
            
            # Convert all records to proper format with video_id
            data_to_upsert = []
            for tracking_data in tracking_data_list:
                tracker_id = to_py(tracking_data.get("tracker_id"))
                
                data_to_upsert.append({
                    "tracker_id": tracker_id,
                    "video_id": video_id,  # Link to video
                    "vehicle_type": to_py(tracking_data.get("vehicle_type")),
                    "status": to_py(tracking_data.get("status")),
                    "compliance": to_py(tracking_data.get("compliance", 0)),
                    "reaction_time": to_py(tracking_data.get("reaction_time")),
                    "weather_condition": to_py(tracking_data.get("weather_condition")),
                    "temperature": to_py(tracking_data.get("temperature")),
                    "humidity": to_py(tracking_data.get("humidity")),
                    "visibility": to_py(tracking_data.get("visibility")),
                    "precipitation_type": to_py(tracking_data.get("precipitation_type")),
                    "wind_speed": to_py(tracking_data.get("wind_speed")),
                    "date": to_py(tracking_data.get("date", datetime.now().isoformat()))
                })
            
            # Log batch operation
            print(f"[INFO] Batch saving {len(data_to_upsert)} records to database for video {video_id}...")
            
            # ONE database call for ALL records
            result = self.client.table("tracking_results") \
                .upsert(data_to_upsert, on_conflict="tracker_id") \
                .execute()
            
            if result.data and len(result.data) > 0:
                print(f"✅ Successfully saved {len(data_to_upsert)} records in batch for video {video_id}")
                return True
            else:
                print(f"❌ Batch save failed - no data returned")
                return False
            
        except Exception as e:
            print(f"❌ Batch save failed: {e}")
            return False
    
    def save_vehicle_count_batch(self, vehicle_counts: List[Dict[str, Any]], video_id: int) -> bool:
        """Save multiple vehicle counts in one batch operation with video_id link"""
        try:
            if not vehicle_counts:
                print("[INFO] No vehicle counts to save in batch")
                return True
            
            # Convert all records to proper format with video_id
            data_to_upsert = []
            for count_data in vehicle_counts:
                data_to_upsert.append({
                    "video_id": video_id,  # Link to video
                    "vehicle_type": count_data.get("vehicle_type"),
                    "count": count_data.get("count"),
                    "date": count_data.get("date", datetime.now().strftime("%Y-%m-%d"))
                })
            
            # Log batch operation
            print(f"[INFO] Batch saving {len(data_to_upsert)} vehicle counts to database for video {video_id}...")
            
            # ONE database call for ALL vehicle counts
            result = self.client.table("vehicle_counts") \
                .upsert(data_to_upsert, on_conflict="video_id,vehicle_type,date") \
                .execute()
            
            if result.data and len(result.data) > 0:
                print(f"✅ Successfully saved {len(data_to_upsert)} vehicle counts in batch for video {video_id}")
                return True
            else:
                print(f"❌ Batch save failed - no data returned")
                return False
            
        except Exception as e:
            print(f"❌ Batch save failed: {e}")
            return False
    
    def save_vehicle_count(self, vehicle_type: str, count: int, date: str = None, video_id: int = None) -> bool:
        """Upsert vehicle count with video_id link"""
        try:
            if date is None:
                date = datetime.now().strftime("%Y-%m-%d")

            # Use upsert with unique constraint on (video_id, vehicle_type, date)
            data_to_upsert = {
                "video_id": video_id,
                "vehicle_type": vehicle_type,
                "count": count,
                "date": date
            }
            
            try:
                result = self.client.table("vehicle_counts") \
                    .upsert(data_to_upsert, on_conflict="video_id,vehicle_type,date") \
                    .execute()
                
                if result.data and len(result.data) > 0:
                    print(f"✅ {vehicle_type} count ({count}) saved to database successfully for video {video_id}")
                    return True
                else:
                    print(f"❌ Failed to save {vehicle_type} count to database")
                    return False
                    
            except Exception as e:
                print(f"❌ Database error saving {vehicle_type} count: {e}")
                return False
                
        except Exception as e:
            print(f"❌ Error processing {vehicle_type} count: {e}")
            return False
    
    def get_tracking_data(self, limit: int = 1000, video_id: int = None) -> List[Dict]:
        """Retrieve tracking data from Supabase, optionally filtered by video_id"""
        try:
            query = self.client.table("tracking_results").select("*").order("created_at", desc=True)
            
            if video_id is not None:
                query = query.eq("video_id", video_id)
            
            result = query.limit(limit).execute()
            return result.data
        except Exception as e:
            print(f"[ERROR] Failed to retrieve tracking data: {e}")
            return []
    
    def get_vehicle_counts(self, limit: int = 1000, video_id: int = None) -> List[Dict]:
        """Retrieve vehicle count data from Supabase, optionally filtered by video_id"""
        try:
            query = self.client.table("vehicle_counts").select("*").order("created_at", desc=True)
            
            if video_id is not None:
                query = query.eq("video_id", video_id)
            
            result = query.limit(limit).execute()
            return result.data
        except Exception as e:
            print(f"[ERROR] Failed to retrieve vehicle counts: {e}")
            return []
    
    def get_video_data(self, video_id: int) -> Dict:
        """Get video data with all related information"""
        try:
            result = self.client.rpc('get_video_with_results', {'p_video_id': video_id}).execute()
            if result.data and len(result.data) > 0:
                return result.data[0]
            return None
        except Exception as e:
            print(f"[ERROR] Failed to get video data: {e}")
            return None
    
    def update_video_stats(self, video_id: int, total_vehicles: int, compliance_rate: float, processing_time: float) -> bool:
        """Update video processing statistics using the database function"""
        try:
            result = self.client.rpc('update_video_stats', {
                'p_video_id': video_id,
                'p_total_vehicles': total_vehicles,
                'p_compliance_rate': compliance_rate,
                'p_processing_time': processing_time
            }).execute()
            
            print(f"✅ Video {video_id} stats updated: {total_vehicles} vehicles, {compliance_rate}% compliance, {processing_time}s")
            return True
        except Exception as e:
            print(f"❌ Failed to update video stats: {e}")
            return False
    
    def upload_video_to_storage(self, file_path: str, file_name: str = None) -> str:
        """Upload video file to Supabase storage (simple upload)."""
        try:
            if file_name is None:
                file_name = os.path.basename(file_path)
            
            # Read the file
            with open(file_path, 'rb') as f:
                file_data = f.read()
            
            # Upload to Supabase storage
            result = self.client.storage.from_("videos").upload(
                path=file_name,
                file=file_data,
                file_options={"content-type": "video/mp4"}
            )
            
            # Get the public URL
            public_url = self.client.storage.from_("videos").get_public_url(file_name)
            return public_url
            
        except Exception as e:
            print(f"[ERROR] Failed to upload video: {e}")
            return None

    def _run_ffmpeg_compress(self, input_path: str, output_path: str, height: int = 720, crf: int = 26, preset: str = "faster") -> bool:
        """Compress a video using ffmpeg. Returns True on success."""
        try:
            # Ensure output directory exists
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            cmd = [
                "ffmpeg",
                "-y",
                "-i", input_path,
                "-vf", f"scale=-2:{height}",
                "-c:v", "libx264",
                "-preset", preset,
                "-crf", str(crf),
                "-c:a", "aac",
                "-b:a", "128k",
                output_path,
            ]
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            return True
        except FileNotFoundError:
            print("[ERROR] ffmpeg not found on PATH. Please install ffmpeg and ensure it's available.")
            return False
        except subprocess.CalledProcessError as e:
            print(f"[ERROR] ffmpeg compression failed: {e}")
            return False

    def compress_and_upload_in_background(self, video_id: int, local_input_path: str, output_height: int = 720, crf: int = 26) -> None:
        """Start a background thread to compress the local video and upload to Supabase Storage.

        On success, updates the video's processed_url and status.
        """
        def _worker():
            try:
                input_path = Path(local_input_path)
                if not input_path.exists():
                    print(f"[ERROR] Input video not found for compression: {local_input_path}")
                    return

                temp_dir = Path("backend") / "processed"
                temp_dir.mkdir(parents=True, exist_ok=True)
                output_name = f"{input_path.stem}_compressed.mp4"
                output_path = temp_dir / output_name

                print(f"[COMPRESS] Starting compression for video {video_id} -> {output_path}")
                ok = self._run_ffmpeg_compress(str(input_path), str(output_path), height=output_height, crf=crf)
                if not ok:
                    self.update_video_status_preserve_timing(video_id, status="compression_failed")
                    return

                public_url = self.upload_video_to_storage(str(output_path), file_name=output_name)
                if not public_url:
                    self.update_video_status_preserve_timing(video_id, status="upload_failed")
                    return

                self.update_video_status_preserve_timing(video_id, status="compressed", processed_url=public_url)
                print(f"[COMPRESS] Completed for video {video_id}. URL: {public_url}")
            except Exception as e:
                print(f"[ERROR] Unexpected error in compression worker: {e}")

        thread = threading.Thread(target=_worker, daemon=True)
        thread.start()
    


# Create global instance
supabase_manager = SupabaseManager() 
