import csv
import os
from datetime import datetime
from config.config import Config

class CSVManager:
    """Handles all CSV file operations"""
    
    @staticmethod
    def initialize_csv_files():
        """Initialize CSV files with headers if they don't exist"""
        os.makedirs(os.path.dirname(Config.OUTPUT_CSV_PATH), exist_ok=True)
        
        tracking_fields = ["tracker_id", "vehicle_type", "status", "compliance", "reaction_time", "date"]
        count_fields = ["vehicle_type", "count", "date"]
        
        for path, fields in [(Config.OUTPUT_CSV_PATH, tracking_fields), (Config.COUNT_CSV_PATH, count_fields)]:
            if not os.path.exists(path) or os.path.getsize(path) == 0:
                with open(path, 'w', newline='') as f:
                    csv.DictWriter(f, fieldnames=fields).writeheader()
    
    @staticmethod
    def read_existing_data():
        """Read existing tracking data from CSV"""
        data = {}
        if os.path.exists(Config.OUTPUT_CSV_PATH):
            with open(Config.OUTPUT_CSV_PATH, 'r', newline='') as file:
                for row in csv.DictReader(file):
                    data[row['tracker_id']] = row
        return data
    
    @staticmethod
    def read_existing_count_data():
        """Read existing vehicle count data from CSV"""
        count_data = {}
        if os.path.exists(Config.COUNT_CSV_PATH):
            with open(Config.COUNT_CSV_PATH, 'r', newline='') as file:
                for row in csv.DictReader(file):
                    date_key = row['date'].split(' ')[0]  # Extract date part only (YYYY-MM-DD)
                    vehicle_type = row['vehicle_type']
                    if date_key not in count_data:
                        count_data[date_key] = {}
                    count_data[date_key][vehicle_type] = int(row['count'])
        return count_data
    
    @staticmethod
    def update_files(history_dict, vehicle_counter):
        """Update CSV files with current data - kept for backward compatibility"""
        tracking_success = CSVManager.update_tracking_file(history_dict)
        count_success = CSVManager.update_count_file(vehicle_counter)
        return tracking_success and count_success
    
    @staticmethod
    def update_tracking_file(history_dict):
        """Update only the tracking results CSV file"""
        try:
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            # Update tracking results
            with open(Config.OUTPUT_CSV_PATH, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=["tracker_id", "vehicle_type", "status", "compliance", "reaction_time", "date"])
                writer.writeheader()
                for tid, data in history_dict.items():
                    data_with_date = data.copy()
                    data_with_date.setdefault("date", current_time)
                    writer.writerow(data_with_date)
            
            return True
        except Exception as e:
            print(f"[WARNING] Failed to update tracking CSV file: {e}")
            return False
    
    @staticmethod
    def update_count_file(vehicle_counter):
        """Update only the vehicle count CSV file"""
        try:
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            current_date = current_time.split(' ')[0]  # Extract date part only (YYYY-MM-DD)
            
            # Read existing count data
            existing_count_data = CSVManager.read_existing_count_data()
            
            # Update vehicle counts with date-based logic
            updated_count_data = {}
            
            # Copy all existing data from other dates
            for date_key, vehicle_counts in existing_count_data.items():
                if date_key != current_date:  # Keep other dates as is
                    updated_count_data[date_key] = vehicle_counts.copy()
            
            # For current date, use the vehicle_counter values directly (they already include existing counts)
            updated_count_data[current_date] = dict(vehicle_counter)
            
            # Write updated count data back to CSV
            with open(Config.COUNT_CSV_PATH, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=["vehicle_type", "count", "date"])
                writer.writeheader()
                for date_key, vehicle_counts in updated_count_data.items():
                    for v_type, count in vehicle_counts.items():
                        writer.writerow({
                            "vehicle_type": v_type, 
                            "count": count, 
                            "date": f"{date_key} 23:59:59"  # Use end of day timestamp
                        })
            
            return True
        except Exception as e:
            print(f"[WARNING] Failed to update count CSV file: {e}")
            return False
