from supabase import create_client, Client
import os
from datetime import datetime
from typing import Dict, List, Any
import numpy as np

# Supabase configuration

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
            # Check if tracker_id already exists
            existing = self.client.table("tracking_results") \
                .select("id") \
                .eq("tracker_id", tracker_id) \
                .limit(1) \
                .execute()
            data_to_save = {
                "tracker_id": tracker_id,
                "vehicle_type": to_py(tracking_data.get("vehicle_type")),
                "status": to_py(tracking_data.get("status")),
                "compliance": to_py(tracking_data.get("compliance", 0)),
                "reaction_time": to_py(tracking_data.get("reaction_time")),
                "date": to_py(tracking_data.get("date", datetime.now().isoformat()))
            }
            if existing.data and len(existing.data) > 0:
                row = existing.data[0]
                self.client.table("tracking_results") \
                    .update(data_to_save) \
                    .eq("id", row["id"]) \
                    .execute()
            else:
                self.client.table("tracking_results").insert(data_to_save).execute()
            return True
        except Exception as e:
            print(f"[ERROR] Failed to save tracking data: {e}")
            return False
    
    def save_vehicle_count(self, vehicle_type: str, count: int, date: str = None) -> bool:
        """Upsert vehicle count: set to current total if exists, insert if not. Matches CSV logic exactly."""
        try:
            if date is None:
                date = datetime.now().strftime("%Y-%m-%d")

            print(f"[DEBUG] save_vehicle_count: type={vehicle_type}, count={count}, date={date}")

            # Check if a row exists for this vehicle_type and date
            try:
                existing = self.client.table("vehicle_counts") \
                    .select("id, count") \
                    .eq("vehicle_type", vehicle_type) \
                    .eq("date", date) \
                    .limit(1) \
                    .execute()
                print(f"[DEBUG] Existing data: {existing.data}")
            except Exception as e:
                print(f"[ERROR] Failed to query existing data: {e}")
                return False

            if existing.data and len(existing.data) > 0:
                # Row exists: set count to the current total
                row = existing.data[0]
                print(f"[DEBUG] Updating existing row {row['id']}: count {row.get('count')} -> {count}")
                try:
                    result = self.client.table("vehicle_counts") \
                        .update({"count": count}) \
                        .eq("id", row["id"]) \
                        .execute()
                    print(f"[DEBUG] Update result: {result.data}")
                    print(f"[DEBUG] Updated successfully")
                except Exception as e:
                    print(f"[ERROR] Failed to update: {e}")
                    return False
            else:
                # No row: insert new
                print(f"[DEBUG] Inserting new row: type={vehicle_type}, count={count}, date={date}")
                try:
                    data_to_insert = {
                        "vehicle_type": vehicle_type,
                        "count": count,
                        "date": date
                    }
                    result = self.client.table("vehicle_counts").insert(data_to_insert).execute()
                    print(f"[DEBUG] Insert result: {result.data}")
                    print(f"[DEBUG] Inserted successfully")
                except Exception as e:
                    print(f"[ERROR] Failed to insert: {e}")
                    return False
            return True
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