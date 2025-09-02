import os
from datetime import datetime
from config.config import Config
from clients.supabase_client import supabase_manager

class DataManager:
    """Handles all data operations for Supabase database in SynerX with video-based schema"""
    
    @staticmethod
    def initialize_csv_files():
        """Initialize method kept for compatibility but no longer creates CSV files"""
        print("[INFO] CSV initialization disabled - using database only")
        pass
    
    @staticmethod
    def initialize_tracker_sequence():
        """Initialize the tracker_id sequence to continue from the highest existing tracker_id"""
        try:
            # Get the highest tracker_id from database
            result = supabase_manager.client.table("tracking_results") \
                .select("tracker_id") \
                .order("tracker_id", desc=True) \
                .limit(1) \
                .execute()
            
            if result.data and len(result.data) > 0:
                highest_id = result.data[0]['tracker_id']
                
                # Try to set the sequence using direct SQL
                try:
                    # Use a custom RPC function to set the sequence
                    sequence_result = supabase_manager.client.rpc('setval', {
                        'sequence_name': 'tracker_id_seq',
                        'value': highest_id
                    }).execute()
                    print(f"[DEBUG] initialize_tracker_sequence: Set sequence to continue from {highest_id}")
                except:
                    # If RPC fails, we'll use the fallback method
                    print(f"[DEBUG] initialize_tracker_sequence: RPC failed, will use fallback method. Highest ID: {highest_id}")
                
                return highest_id
            else:
                print("[DEBUG] initialize_tracker_sequence: No existing data")
                return 0
                
        except Exception as e:
            print(f"[WARNING] Failed to initialize tracker sequence: {e}")
            return 0
    
    @staticmethod
    def get_next_tracker_id():
        """Get the next available tracker_id - robust approach that always works"""
        try:
            # Get the highest tracker_id from database
            highest_id = DataManager.get_highest_tracker_id()
            next_id = highest_id + 1
            
            print(f"[DEBUG] get_next_tracker_id: Highest existing: {highest_id}, Next will be: {next_id}")
            return next_id
                
        except Exception as e:
            print(f"[WARNING] Failed to get next tracker_id: {e}")
            return 1
    
    @staticmethod
    def get_highest_tracker_id():
        """Get only the highest tracker_id from database - much more efficient than loading all data"""
        try:
            # Get the highest tracker_id from database
            result = supabase_manager.client.table("tracking_results") \
                .select("tracker_id") \
                .order("tracker_id", desc=True) \
                .limit(1) \
                .execute()
            
            if result.data and len(result.data) > 0:
                highest_id = result.data[0]['tracker_id']
                print(f"[DEBUG] get_highest_tracker_id: Found highest tracker_id: {highest_id}")
                return highest_id
            else:
                print("[DEBUG] get_highest_tracker_id: No existing tracker_ids found")
                return 0
                
        except Exception as e:
            print(f"[WARNING] Failed to get highest tracker_id from database: {e}")
            return 0
    
    @staticmethod
    def read_existing_data(video_id: int = None):
        """Read existing tracking data from database, optionally filtered by video_id"""
        try:
            data = {}
            
            # Read from database with optional video_id filter
            db_data = supabase_manager.get_tracking_data(limit=1000, video_id=video_id)
            
            for row in db_data:
                if row.get('tracker_id'):
                    tracker_id_str = str(row['tracker_id'])
                    data[tracker_id_str] = {
                        "tracker_id": int(row['tracker_id']),
                        "video_id": row.get('video_id'),
                        "vehicle_type": row.get('vehicle_type', 'unknown'),
                        "status": row.get('status', 'moving'),
                        "compliance": int(row.get('compliance', 0)),
                        "reaction_time": float(row.get('reaction_time')) if row.get('reaction_time') else None,
                        "weather_condition": row.get('weather_condition'),
                        "temperature": float(row.get('temperature')) if row.get('temperature') else None,
                        "humidity": int(row.get('humidity')) if row.get('humidity') else None,
                        "visibility": float(row.get('visibility')) if row.get('visibility') else None,
                        "precipitation_type": row.get('precipitation_type'),
                        "wind_speed": float(row.get('wind_speed')) if row.get('wind_speed') else None,
                        "date": row.get('date', '')
                    }
                    print(f"[DEBUG] Loaded from DB: track_id={row['tracker_id']}, video_id={row.get('video_id')}, type={row.get('vehicle_type')}, status={row.get('status')}")
            
            print(f"[DEBUG] read_existing_data: Returning {len(data)} records from database")
            return data
                
        except Exception as e:
            print(f"[WARNING] Failed to read from database: {e}")
            return {}
    
    @staticmethod
    def read_existing_count_data(video_id: int = None):
        """Read existing vehicle count data from database, optionally filtered by video_id"""
        try:
            count_data = {}
            
            # Read from database with optional video_id filter
            db_vehicle_counts = supabase_manager.get_vehicle_counts(limit=1000, video_id=video_id)
            
            for row in db_vehicle_counts:
                try:
                    if not row.get('date') or not row.get('vehicle_type') or not row.get('count'):
                        continue
                    date_key = row['date'].split(' ')[0] if ' ' in row['date'] else row['date'].split('T')[0]
                    vehicle_type = row['vehicle_type']
                    if date_key not in count_data:
                        count_data[date_key] = {}
                    count_data[date_key][vehicle_type] = int(row['count'])
                except (ValueError, KeyError, AttributeError) as e:
                    continue
            
            print(f"[DEBUG] read_existing_count_data: Loaded from database: {count_data}")
            return count_data
                
        except Exception as e:
            print(f"[WARNING] Failed to read from database: {e}")
            return {}
    
    @staticmethod
    def update_files(history_dict, vehicle_counter, mode="api", video_id: int = None):
        """Update data - save to database only with video_id link"""
        tracking_success = DataManager.update_tracking_file(history_dict, mode, video_id)
        count_success = DataManager.update_count_file(vehicle_counter, mode, video_id)
        return tracking_success and count_success
    
    @staticmethod
    def update_tracking_file(history_dict, mode="api", changed_records=None, video_id: int = None):
        """Update tracking results - save to database only with video_id link"""
        try:
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            if history_dict:
                # Convert to list for batch save
                all_records = []
                for tid, data in history_dict.items():
                    data_with_date = data.copy()
                    data_with_date.setdefault("date", current_time)
                    all_records.append(data_with_date)
                
                # Save all records in one batch operation with video_id
                success = supabase_manager.save_tracking_data_batch(all_records, video_id)
                if success:
                    print(f"✅ {len(all_records)} tracking records saved to database in batch for video {video_id}")
                    return True
                else:
                    print(f"❌ Failed to save {len(all_records)} tracking records to database")
                    return False
            else:
                print("[INFO] No tracking records to save")
                return True
                
        except Exception as e:
            print(f"[ERROR] Failed to update tracking file: {e}")
            return False
    
    @staticmethod
    def update_count_file(vehicle_counter, mode="api", video_id: int = None):
        """Update vehicle count data - save to database only with video_id link"""
        try:
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            current_date = current_time.split(' ')[0]
            
            if vehicle_counter:
                # Convert to list for batch save
                vehicle_count_records = []
                for vehicle_type, count in vehicle_counter.items():
                    vehicle_count_records.append({
                        "vehicle_type": vehicle_type,
                        "count": count,
                        "date": current_date
                    })
                
                # Save all vehicle counts in one batch operation with video_id
                success = supabase_manager.save_vehicle_count_batch(vehicle_count_records, video_id)
                if success:
                    print(f"✅ {len(vehicle_count_records)} vehicle counts saved to database in batch for video {video_id}")
                    return True
                else:
                    print(f"❌ Failed to save {len(vehicle_count_records)} vehicle counts to database")
                    return False
            else:
                print("[INFO] No vehicle counts to save")
                return True
                
        except Exception as e:
            print(f"❌ Failed to update count data: {e}")
            return False
