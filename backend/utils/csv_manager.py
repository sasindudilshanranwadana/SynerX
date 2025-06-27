import csv
import os
from datetime import datetime
from config.config import Config
from supabase_client import supabase_manager

class CSVManager:
    """Handles all CSV file operations with Supabase integration"""
    
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
    def read_existing_data():
        """Read existing tracking data from Supabase"""
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
    def update_files(history_dict, vehicle_counter):
        """Update data - save to Supabase and local CSV for backup"""
        tracking_success = CSVManager.update_tracking_file(history_dict)
        count_success = CSVManager.update_count_file(vehicle_counter)
        return tracking_success and count_success
    
    @staticmethod
    def update_tracking_file(history_dict):
        """Update tracking results - save to Supabase and local CSV for backup"""
        try:
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            success_count = 0
            
            print(f"[DEBUG] update_tracking_file called with {len(history_dict)} records")
            
            # Save all records in history_dict to Supabase (these are already filtered for new/changed)
            for tid, data in history_dict.items():
                data_with_date = data.copy()
                data_with_date.setdefault("date", current_time)
                
                print(f"[DEBUG] Saving tracking data to DB: track_id={data.get('tracker_id')}, type={data.get('vehicle_type')}, status={data.get('status')}")
                
                if supabase_manager.save_tracking_data(data_with_date):
                    success_count += 1
                    print(f"[DEBUG] Successfully saved tracking data for track_id={data.get('tracker_id')}")
                else:
                    print(f"[DEBUG] Failed to save tracking data for track_id={data.get('tracker_id')}")
            
            # Save to local CSV for backup - write all records from history_dict
            with open(Config.OUTPUT_CSV_PATH, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=["tracker_id", "vehicle_type", "status", "compliance", "reaction_time", "date"])
                writer.writeheader()
                for tid, data in history_dict.items():
                    data_with_date = data.copy()
                    data_with_date.setdefault("date", current_time)
                    writer.writerow(data_with_date)
            
            print(f"[DEBUG] Saved {len(history_dict)} total records to CSV backup")
            print(f"[INFO] Saved {success_count}/{len(history_dict)} tracking records to Supabase")
            return True
        except Exception as e:
            print(f"[WARNING] Failed to update tracking data: {e}")
            return False
    
    @staticmethod
    def update_count_file(vehicle_counter):
        """Update vehicle count data - save to Supabase and local CSV for backup"""
        try:
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            current_date = current_time.split(' ')[0]
            success_count = 0
            
            print(f"[DEBUG] update_count_file called with: {dict(vehicle_counter)}")
            
            # Save to Supabase
            for vehicle_type, count in vehicle_counter.items():
                print(f"[DEBUG] Saving to DB: vehicle_type={vehicle_type}, count={count}, date={current_date}")
                if supabase_manager.save_vehicle_count(vehicle_type, count, current_date):
                    success_count += 1
                    print(f"[DEBUG] Successfully saved {vehicle_type}: {count}")
                else:
                    print(f"[DEBUG] Failed to save {vehicle_type}: {count}")
            
            # Save to local CSV for backup - preserve existing data
            csv_exists = os.path.exists(Config.COUNT_CSV_PATH)
            
            # Read existing CSV data if file exists
            existing_csv_data = {}
            if csv_exists:
                try:
                    with open(Config.COUNT_CSV_PATH, 'r', newline='') as f:
                        reader = csv.DictReader(f)
                        for row in reader:
                            if row.get('vehicle_type') and row.get('date'):
                                key = f"{row['vehicle_type']}_{row['date']}"
                                existing_csv_data[key] = row
                except Exception as e:
                    print(f"[WARNING] Failed to read existing count CSV: {e}")
            
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
            
            print(f"[DEBUG] Updated count CSV with current data, total records: {len(existing_csv_data)}")
            print(f"[INFO] Saved {success_count}/{len(vehicle_counter)} vehicle counts to Supabase")
            return True
        except Exception as e:
            print(f"[WARNING] Failed to update count data: {e}")
            return False
