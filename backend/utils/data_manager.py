import csv
import os
from datetime import datetime
from config.config import Config
from utils.supabase_manager import supabase_manager

class DataManager:
    """Handles all data operations (CSV and Supabase) for SynerX"""
    
    @staticmethod
    def initialize_csv_files():
        """Initialize CSV files with headers if they don't exist - kept for backward compatibility"""
        os.makedirs(os.path.dirname(Config.OUTPUT_CSV_PATH), exist_ok=True)
        
        tracking_fields = ["tracker_id", "vehicle_type", "status", "compliance", "reaction_time", "date"]
        count_fields = ["vehicle_type", "count", "date"]
        
        for path, fields in [(Config.OUTPUT_CSV_PATH, tracking_fields), (Config.COUNT_CSV_PATH, count_fields)]:
            if not os.path.exists(path) or os.path.getsize(path) == 0:
                with open(path, 'w', newline='') as f:
                    csv.DictWriter(f, fieldnames=fields).writeheader()
    
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
    def read_existing_data():
        """Read existing tracking data from Supabase - DEPRECATED: Use get_highest_tracker_id() instead"""
        try:
            data = {}
            tracking_data = supabase_manager.get_tracking_data(limit=10000)
            print(f"[DEBUG] read_existing_data: Got {len(tracking_data)} records from database")
            
            for row in tracking_data:
                if row.get('tracker_id'):
                    data[str(row['tracker_id'])] = {
                        "tracker_id": row['tracker_id'],
                        "vehicle_type": row.get('vehicle_type', 'unknown'),
                        "status": row.get('status', 'moving'),
                        "compliance": row.get('compliance', 0),
                        "reaction_time": row.get('reaction_time'),
                        "date": row.get('date', '')
                    }
                    print(f"[DEBUG] Loaded existing: track_id={row['tracker_id']}, type={row.get('vehicle_type')}, status={row.get('status')}")
            
            print(f"[DEBUG] read_existing_data: Returning {len(data)} records")
            return data
        except Exception as e:
            print(f"[WARNING] Failed to read from Supabase, falling back to CSV: {e}")
            # Fallback to CSV if Supabase fails
            data = {}
            if os.path.exists(Config.OUTPUT_CSV_PATH):
                with open(Config.OUTPUT_CSV_PATH, 'r', newline='') as file:
                    for row in csv.DictReader(file):
                        data[row['tracker_id']] = row
                        print(f"[DEBUG] Loaded from CSV fallback: track_id={row['tracker_id']}, type={row.get('vehicle_type')}, status={row.get('status')}")
            return data
    
    @staticmethod
    def read_existing_count_data():
        """Read existing vehicle count data from Supabase"""
        try:
            count_data = {}
            vehicle_counts = supabase_manager.get_vehicle_counts(limit=10000)
            
            for row in vehicle_counts:
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
            
            return count_data
        except Exception as e:
            print(f"[WARNING] Failed to read from Supabase, falling back to CSV: {e}")
            # Fallback to CSV if Supabase fails
            count_data = {}
            if os.path.exists(Config.COUNT_CSV_PATH):
                with open(Config.COUNT_CSV_PATH, 'r', newline='') as file:
                    for row in csv.DictReader(file):
                        try:
                            if not row['date'] or not row['vehicle_type'] or not row['count']:
                                continue
                            date_key = row['date'].split(' ')[0]
                            vehicle_type = row['vehicle_type']
                            if date_key not in count_data:
                                count_data[date_key] = {}
                            count_data[date_key][vehicle_type] = int(row['count'])
                        except (ValueError, KeyError, AttributeError) as e:
                            continue
            return count_data
    
    @staticmethod
    def update_files(history_dict, vehicle_counter, mode="local"):
        """Update data - save to CSV only in local mode, database only in API mode"""
        tracking_success = DataManager.update_tracking_file(history_dict, mode)
        count_success = DataManager.update_count_file(vehicle_counter, mode)
        return tracking_success and count_success
    
    @staticmethod
    def update_tracking_file(history_dict, mode="local"):
        """Update tracking results - save to CSV only in local mode, database only in API mode"""
        try:
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            success_count = 0
            
            if mode == "local":
                # Local mode: Save to CSV only
                with open(Config.OUTPUT_CSV_PATH, 'w', newline='') as f:
                    writer = csv.DictWriter(f, fieldnames=["tracker_id", "vehicle_type", "status", "compliance", "reaction_time", "date"])
                    writer.writeheader()
                    for tid, data in history_dict.items():
                        data_with_date = data.copy()
                        data_with_date.setdefault("date", current_time)
                        writer.writerow(data_with_date)
                
                print(f"✅ {len(history_dict)} tracking records saved to CSV")
                return True
            else:
                # API mode: Save to database only
                for tid, data in history_dict.items():
                    data_with_date = data.copy()
                    data_with_date.setdefault("date", current_time)
                    
                    if supabase_manager.save_tracking_data(data_with_date):
                        success_count += 1
                    else:
                        print(f"❌ Failed to save tracking data for vehicle {data.get('tracker_id')}")
                
                print(f"✅ {success_count}/{len(history_dict)} tracking records saved to database")
                return True
                
        except Exception as e:
            print(f"❌ Failed to update tracking data: {e}")
            return False
    
    @staticmethod
    def update_count_file(vehicle_counter, mode="local"):
        """Update vehicle count data - save to CSV only in local mode, database only in API mode"""
        try:
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            current_date = current_time.split(' ')[0]
            success_count = 0
            
            if mode == "local":
                # Local mode: Save to CSV only
                csv_exists = os.path.exists(Config.COUNT_CSV_PATH)
                
                # Read existing CSV data if file exists
                existing_csv_data = {}
                if csv_exists:
                    try:
                        with open(Config.COUNT_CSV_PATH, 'r', newline='') as f:
                            reader = csv.DictReader(f)
                            for row in reader:
                                if row.get('vehicle_type') and row.get('date'):
                                    # Use only the date part as key, not the full timestamp
                                    row_date = row['date'].split(' ')[0]
                                    key = f"{row['vehicle_type']}_{row_date}"
                                    existing_csv_data[key] = row
                    except Exception as e:
                        print(f"⚠️ Failed to read existing count CSV: {e}")
                
                # Update existing data with current vehicle counts
                for vehicle_type, count in vehicle_counter.items():
                    key = f"{vehicle_type}_{current_date}"
                    existing_csv_data[key] = {
                        "vehicle_type": vehicle_type,
                        "count": count,
                        "date": current_time
                    }
                
                # Write all data back to CSV (preserving all records)
                with open(Config.COUNT_CSV_PATH, 'w', newline='') as f:
                    writer = csv.DictWriter(f, fieldnames=["vehicle_type", "count", "date"])
                    writer.writeheader()
                    for record in existing_csv_data.values():
                        writer.writerow(record)
                
                print(f"✅ {len(vehicle_counter)} vehicle counts saved to CSV")
                return True
            else:
                # API mode: Save to database only
                for vehicle_type, count in vehicle_counter.items():
                    if supabase_manager.save_vehicle_count(vehicle_type, count, current_date):
                        success_count += 1
                    else:
                        print(f"❌ Failed to save {vehicle_type} count to database")
                
                print(f"✅ {success_count}/{len(vehicle_counter)} vehicle counts saved to database")
                return True
                
        except Exception as e:
            print(f"❌ Failed to update count data: {e}")
            return False
