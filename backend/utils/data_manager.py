import csv
import os
from datetime import datetime
from config.config import Config
from clients.supabase_client import supabase_manager

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
        """Read existing tracking data from CSV in local mode, database in API mode"""
        try:
            data = {}
            
            # Read from CSV file (for local mode)
            if os.path.exists(Config.OUTPUT_CSV_PATH):
                with open(Config.OUTPUT_CSV_PATH, 'r', newline='') as file:
                    reader = csv.DictReader(file)
                    for row in reader:
                        if row.get('tracker_id'):
                            data[row['tracker_id']] = {
                                "tracker_id": int(row['tracker_id']),
                                "vehicle_type": row.get('vehicle_type', 'unknown'),
                                "status": row.get('status', 'moving'),
                                "compliance": int(row.get('compliance', 0)),
                                "reaction_time": float(row.get('reaction_time')) if row.get('reaction_time') else None,
                                "date": row.get('date', '')
                            }
                            print(f"[DEBUG] Loaded from CSV: track_id={row['tracker_id']}, type={row.get('vehicle_type')}, status={row.get('status')}")
                
                print(f"[DEBUG] read_existing_data: Returning {len(data)} records from CSV")
                return data
            else:
                print("[DEBUG] read_existing_data: No CSV file found")
                return data
                
        except Exception as e:
            print(f"[WARNING] Failed to read from CSV: {e}")
            return {}
    
    @staticmethod
    def read_existing_count_data():
        """Read existing vehicle count data from CSV in local mode, database in API mode"""
        try:
            count_data = {}
            
            # Read from CSV file first (for local mode)
            if os.path.exists(Config.COUNT_CSV_PATH):
                with open(Config.COUNT_CSV_PATH, 'r', newline='') as file:
                    reader = csv.DictReader(file)
                    for row in reader:
                        try:
                            if not row.get('date') or not row.get('vehicle_type') or not row.get('count'):
                                continue
                            date_key = row['date'].split(' ')[0]
                            vehicle_type = row['vehicle_type']
                            if date_key not in count_data:
                                count_data[date_key] = {}
                            count_data[date_key][vehicle_type] = int(row['count'])
                        except (ValueError, KeyError, AttributeError) as e:
                            continue
                
                print(f"[DEBUG] read_existing_count_data: Loaded from CSV: {count_data}")
                return count_data
            else:
                print("[DEBUG] read_existing_count_data: No CSV file found")
                return count_data
                
        except Exception as e:
            print(f"[WARNING] Failed to read from CSV: {e}")
            return {}
    
    @staticmethod
    def update_files(history_dict, vehicle_counter, mode="local"):
        """Update data - save to CSV only in local mode, database only in API mode"""
        tracking_success = DataManager.update_tracking_file(history_dict, mode)
        count_success = DataManager.update_count_file(vehicle_counter, mode)
        return tracking_success and count_success
    
    @staticmethod
    def update_tracking_file(history_dict, mode="local", changed_records=None):
        """Update tracking results - save to CSV only in local mode, database only in API mode"""
        try:
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            success_count = 0
            
            if mode == "local":
                # Local mode: Save to CSV only - rewrite entire file with current data
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
                
                print(f"✅ {success_count} tracking records saved to database")
                return success_count > 0
                
        except Exception as e:
            print(f"[ERROR] Failed to update tracking file: {e}")
            return False
    
    @staticmethod
    def update_count_file(vehicle_counter, mode="local"):
        """Update vehicle count data - save to CSV only in local mode, database only in API mode"""
        try:
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            current_date = current_time.split(' ')[0]
            success_count = 0
            
            if mode == "local":
                # Local mode: Save to CSV only - read existing counts and increment
                existing_counts = {}
                
                # Read existing CSV data if file exists
                if os.path.exists(Config.COUNT_CSV_PATH):
                    try:
                        with open(Config.COUNT_CSV_PATH, 'r', newline='') as f:
                            reader = csv.DictReader(f)
                            for row in reader:
                                if row.get('vehicle_type') and row.get('date') and row.get('count'):
                                    row_date = row['date'].split(' ')[0]
                                    if row_date == current_date:
                                        # This is today's data, use it as base
                                        existing_counts[row['vehicle_type']] = int(row['count'])
                                    else:
                                        # This is from a different date, keep it
                                        existing_counts[f"{row['vehicle_type']}_{row_date}"] = {
                                            "vehicle_type": row['vehicle_type'],
                                            "count": row['count'],
                                            "date": row['date']
                                        }
                    except Exception as e:
                        print(f"⚠️ Failed to read existing count CSV: {e}")
                
                # Update counts for current date
                updated_counts = {}
                for vehicle_type, new_count in vehicle_counter.items():
                    # Get existing count for today, or start from 0
                    existing_count = existing_counts.get(vehicle_type, 0)
                    # The new_count should be the total count, not an increment
                    updated_counts[vehicle_type] = new_count
                
                # Write all data back to CSV
                with open(Config.COUNT_CSV_PATH, 'w', newline='') as f:
                    writer = csv.DictWriter(f, fieldnames=["vehicle_type", "count", "date"])
                    writer.writeheader()
                    
                    # Write today's updated counts
                    for vehicle_type, count in updated_counts.items():
                        writer.writerow({
                            "vehicle_type": vehicle_type,
                            "count": count,
                            "date": current_time
                        })
                    
                    # Write historical data from other dates
                    for key, record in existing_counts.items():
                        if '_' in key:  # This is historical data
                            writer.writerow(record)
                
                print(f"✅ {len(updated_counts)} vehicle counts updated for {current_date}")
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
