import os
from dotenv import load_dotenv
from supabase import create_client, Client
import json
from datetime import datetime
from typing import Dict, List, Any
import numpy as np

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
    """Simple Supabase manager for SynerX"""
    
    def __init__(self):
        self.client = supabase
    
    def save_tracking_data(self, tracking_data: Dict[str, Any]) -> bool:
        """Upsert tracking data: update if tracker_id exists, insert if not. Always keep latest status, like CSV logic."""
        def to_py(val):
            if isinstance(val, np.generic):
                return val.item()
            return val
        try:
            tracker_id = to_py(tracking_data.get("tracker_id"))
            print(f"[DEBUG] save_tracking_data: tracker_id={tracker_id}")
            
            # Use upsert with unique constraint on tracker_id
            data_to_upsert = {
                "tracker_id": tracker_id,
                "vehicle_type": to_py(tracking_data.get("vehicle_type")),
                "status": to_py(tracking_data.get("status")),
                "compliance": to_py(tracking_data.get("compliance", 0)),
                "reaction_time": to_py(tracking_data.get("reaction_time")),
                "date": to_py(tracking_data.get("date", datetime.now().isoformat()))
            }
            
            try:
                result = self.client.table("tracking_results") \
                    .upsert(data_to_upsert, on_conflict="tracker_id") \
                    .execute()
                print(f"[DEBUG] Tracking upsert result: {result.data}")
                
                if result.data and len(result.data) > 0:
                    print(f"[DEBUG] Tracking data upserted successfully: {result.data[0]}")
                    return True
                else:
                    print(f"[WARNING] Tracking upsert returned empty result")
                    return False
                    
            except Exception as e:
                print(f"[ERROR] Failed to upsert tracking data: {e}")
                return False
                
        except Exception as e:
            print(f"[ERROR] Failed to save tracking data: {e}")
            return False
    
    def save_vehicle_count(self, vehicle_type: str, count: int, date: str = None) -> bool:
        """Upsert vehicle count: set to current total if exists, insert if not. Matches CSV logic exactly."""
        try:
            if date is None:
                date = datetime.now().strftime("%Y-%m-%d")

            print(f"[DEBUG] save_vehicle_count: type={vehicle_type}, count={count}, date={date}")

            # Use upsert with unique constraint on (vehicle_type, date)
            data_to_upsert = {
                "vehicle_type": vehicle_type,
                "count": count,
                "date": date
            }
            
            try:
                result = self.client.table("vehicle_counts") \
                    .upsert(data_to_upsert, on_conflict="vehicle_type,date") \
                    .execute()
                print(f"[DEBUG] Upsert result: {result.data}")
                
                if result.data and len(result.data) > 0:
                    print(f"[DEBUG] Vehicle count upserted successfully: {result.data[0]}")
                    return True
                else:
                    print(f"[WARNING] Upsert returned empty result")
                    return False
                    
            except Exception as e:
                print(f"[ERROR] Failed to upsert vehicle count: {e}")
                return False
                
        except Exception as e:
            print(f"[ERROR] Failed to upsert vehicle count: {e}")
            return False
    
    def get_tracking_data(self, limit: int = 1000) -> List[Dict]:
        """Retrieve tracking data from Supabase"""
        try:
            result = self.client.table("tracking_results").select("*").order("created_at", desc=True).limit(limit).execute()
            return result.data
        except Exception as e:
            print(f"[ERROR] Failed to retrieve tracking data: {e}")
            return []
    
    def get_vehicle_counts(self, limit: int = 1000) -> List[Dict]:
        """Retrieve vehicle count data from Supabase"""
        try:
            result = self.client.table("vehicle_counts").select("*").order("created_at", desc=True).limit(limit).execute()
            return result.data
        except Exception as e:
            print(f"[ERROR] Failed to retrieve vehicle counts: {e}")
            return []
    
    def upload_video_to_storage(self, file_path: str, file_name: str = None) -> str:
        """Upload video file to Supabase storage"""
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
    
    def test_vehicle_counts_table(self):
        """Test function to check vehicle_counts table access and current data"""
        try:
            print("[DEBUG] Testing vehicle_counts table access...")
            
            # Try to read all data
            result = self.client.table("vehicle_counts").select("*").execute()
            print(f"[DEBUG] Current vehicle_counts data: {result.data}")
            
            # Try to count rows
            count_result = self.client.table("vehicle_counts").select("*", count="exact").execute()
            print(f"[DEBUG] Total rows in vehicle_counts: {count_result.count}")
            
            return True
        except Exception as e:
            print(f"[ERROR] Failed to test vehicle_counts table: {e}")
            return False

# Create global instance
supabase_manager = SupabaseManager() 