import time
import numpy as np
from datetime import datetime
from collections import Counter
from config.config import Config
from utils.annotation_manager import AnnotationManager
from utils.weather_manager import weather_manager

class VehicleProcessor:
    """Handles vehicle detection processing and tracking logic"""
    
    def __init__(self, vehicle_tracker, data_manager, mode):
        self.vehicle_tracker = vehicle_tracker
        self.data_manager = data_manager
        self.mode = mode
        self.counted_ids = set()
        self.vehicle_type_counter = Counter()
        self.changed_records = {}
        self.session_tracker_ids = set()
        self.session_vehicle_counts = Counter()
        self.tracker_types = {}
        self.stop_zone_history_dict = {}
        self.tracker_id_offset = 0
        
    def initialize_data(self):
        """Initialize tracking data based on mode"""
        if self.mode == "local":
            self.data_manager.initialize_csv_files()
            self.stop_zone_history_dict = self.data_manager.read_existing_data()
            print("[INFO] Local mode: Using CSV files for data storage")
        else:
            self.data_manager.initialize_csv_files()  # Still initialize CSV for backup
            self.stop_zone_history_dict = {}
            print("[INFO] API mode: Using database for data storage")
        
        # Initialize weather cache
        self._weather_cache = None
        self._weather_cache_time = None
    
    def load_existing_counts(self):
        """Load existing vehicle counts based on mode"""
        current_date = datetime.now().strftime("%Y-%m-%d")
        
        if self.mode == "local":
            self._load_counts_from_csv(current_date)
        else:
            self._load_counts_from_database(current_date)
    
    def _load_counts_from_csv(self, current_date):
        """Load counts from CSV file"""
        try:
            existing_count_data = self.data_manager.read_existing_count_data()
            if current_date in existing_count_data:
                self.vehicle_type_counter.update(existing_count_data[current_date])
                print(f"[INFO] Loaded existing counts for today: {dict(self.vehicle_type_counter)}")
            else:
                print(f"[INFO] No existing counts for today, starting fresh")
        except Exception as e:
            print(f"[WARNING] Failed to load counts from CSV: {e}")
    
    def _load_counts_from_database(self, current_date):
        """Load counts from database"""
        try:
            from clients.supabase_client import supabase_manager
            db_vehicle_counts = supabase_manager.get_vehicle_counts(limit=1000)
            for row in db_vehicle_counts:
                if row.get('date') and row.get('vehicle_type') and row.get('count'):
                    row_date = row['date'].split(' ')[0] if ' ' in row['date'] else row['date'].split('T')[0]
                    if row_date == current_date:
                        vehicle_type = row['vehicle_type']
                        count = int(row['count'])
                        self.vehicle_type_counter[vehicle_type] = count
            print(f"[INFO] Loaded counts from database: {dict(self.vehicle_type_counter)}")
        except Exception as e:
            print(f"[WARNING] Failed to load counts from database: {e}")
    
    def setup_tracker_offset(self):
        """Setup tracker ID offset for continuation"""
        if self.mode == "api":
            next_tracker_id = self.data_manager.get_next_tracker_id()
            self.tracker_id_offset = next_tracker_id - 1
            if next_tracker_id > 1:
                print(f"[INFO] Continuing from tracker ID: {next_tracker_id}")
            else:
                print(f"[INFO] Starting fresh with tracker ID: {next_tracker_id}")
        else:
            # Local mode: Load existing stationary vehicles and mark existing vehicles as counted
            for track_id, data in self.stop_zone_history_dict.items():
                if data.get('status') == 'stationary':
                    self.vehicle_tracker.stationary_vehicles.add(int(track_id))
                if data.get('tracker_id'):
                    self.counted_ids.add(int(data.get('tracker_id')))
            
            max_track_id = max((int(tid) for tid in self.stop_zone_history_dict.keys() if tid.isdigit()), default=0)
            self.tracker_id_offset = max_track_id
            if max_track_id > 0:
                print(f"[INFO] Continuing from tracker ID: {self.tracker_id_offset + 1}")
    
    def process_detections(self, detections, anchor_pts, transformed_pts):
        """Process vehicle detections and update tracking data"""
        top_labels, bottom_labels = [], []
        
        for track_id, orig_pt, trans_pt, class_id in zip(
            detections.tracker_id, anchor_pts, transformed_pts, detections.class_id
        ):
            vehicle_type = Config.CLASS_NAMES.get(class_id, "unknown")
            self.tracker_types[track_id] = vehicle_type
            
            previous_status = self.vehicle_tracker.status_cache.get(track_id, "")
            current_status = "moving"
            compliance = 0
            
            self.vehicle_tracker.position_history[track_id].append(trans_pt)
            
            # Process stop zone logic
            if AnnotationManager.point_inside_polygon(orig_pt, Config.STOP_ZONE_POLYGON):
                current_status, compliance = self._process_stop_zone_vehicle(
                    track_id, vehicle_type, trans_pt, current_status, compliance
                )
            else:
                self.vehicle_tracker.position_history[track_id].clear()
                if track_id in self.vehicle_tracker.entry_times and track_id not in self.vehicle_tracker.reaction_times:
                    self.vehicle_tracker.reaction_times[track_id] = None
            
            # Maintain stationary status once achieved
            if track_id in self.vehicle_tracker.stationary_vehicles:
                current_status = "stationary"
                compliance = 1
            
            # Update status and labels
            self._update_vehicle_status(
                track_id, vehicle_type, previous_status, current_status
            )
            
            self.vehicle_tracker.status_cache[track_id] = current_status
            
            # Prepare labels
            top_labels.append(f"{vehicle_type} {current_status}" if current_status != "moving" else vehicle_type)
            bottom_labels.append(f"#{track_id}")
            
            # Update history dictionary for vehicles in stop zone
            if AnnotationManager.point_inside_polygon(orig_pt, Config.STOP_ZONE_POLYGON):
                self._update_tracking_history(
                    track_id, vehicle_type, current_status, compliance
                )
        
        return top_labels, bottom_labels
    
    def _process_stop_zone_vehicle(self, track_id, vehicle_type, trans_pt, current_status, compliance):
        """Process vehicle in stop zone"""
        
        # Count vehicle if first time in zone
        if track_id not in self.counted_ids:
            self._count_new_vehicle(track_id, vehicle_type)
        
        # Record entry time
        if track_id not in self.vehicle_tracker.entry_times:
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            self.vehicle_tracker.entry_times[track_id] = time.time()
            print(f"[DEBUG] Vehicle {track_id} ({vehicle_type}) entered stop zone at {current_time}")
            
            record_key = (track_id, "entered")
            if record_key not in self.vehicle_tracker.written_records:
                self.vehicle_tracker.written_records.add(record_key)
                # csv_update_needed = True # Removed
        
        # Check if stationary
        if len(self.vehicle_tracker.position_history[track_id]) >= Config.FRAME_BUFFER:
            if self._is_vehicle_stationary(track_id):
                current_status, compliance = "stationary", 1
                
                if track_id not in self.vehicle_tracker.reaction_times:
                    reaction_time = round(time.time() - self.vehicle_tracker.entry_times[track_id], 2)
                    self.vehicle_tracker.reaction_times[track_id] = reaction_time
                    print(f"[DEBUG] Vehicle {track_id} ({vehicle_type}) became stationary after {reaction_time}s")
        
        return current_status, compliance
    
    def _count_new_vehicle(self, track_id, vehicle_type):
        """Count a new vehicle entering the stop zone"""
        print(f"[DEBUG] New vehicle counted: track_id={track_id}, type={vehicle_type}")
        print(f"[DEBUG] Before increment: {vehicle_type} = {self.vehicle_type_counter[vehicle_type]}")
        
        self.vehicle_type_counter[vehicle_type] += 1
        self.counted_ids.add(track_id)
        self.session_tracker_ids.add(track_id)
        self.session_vehicle_counts[vehicle_type] += 1
        
        print(f"[DEBUG] After increment: {vehicle_type} = {self.vehicle_type_counter[vehicle_type]}")
        print(f"[DEBUG] Total counted vehicles: {len(self.counted_ids)}")
        
        # Update vehicle counts in real-time
        self._update_vehicle_counts_realtime(vehicle_type)
    
    def _update_vehicle_counts_realtime(self, vehicle_type):
        """Update vehicle counts in real-time based on mode"""
        if self.mode == "local":
            self.data_manager.update_count_file(self.vehicle_type_counter, self.mode)
            print(f"[INFO] Vehicle counts updated in real-time: {dict(self.vehicle_type_counter)}")
        else:
            from clients.supabase_client import supabase_manager
            current_date = datetime.now().strftime("%Y-%m-%d")
            supabase_manager.save_vehicle_count(vehicle_type, self.vehicle_type_counter[vehicle_type], current_date)
            print(f"[INFO] Vehicle count updated in database: {vehicle_type} = {self.vehicle_type_counter[vehicle_type]}")
    
    def _is_vehicle_stationary(self, track_id):
        """Check if vehicle is stationary based on velocity"""
        displacements = np.array([
            np.linalg.norm(self.vehicle_tracker.position_history[track_id][i] - 
                         self.vehicle_tracker.position_history[track_id][i - 1])
            for i in range(1, len(self.vehicle_tracker.position_history[track_id]))
        ])
        weights = np.linspace(1, 2, len(displacements))
        avg_velocity = np.average(displacements, weights=weights)
        
        return avg_velocity < Config.VELOCITY_THRESHOLD
    
    def _update_vehicle_status(self, track_id, vehicle_type, previous_status, current_status):
        """Update vehicle status and handle status changes"""
        if previous_status != current_status and previous_status != "":
            print(f"[DEBUG] Vehicle {track_id} ({vehicle_type}) status changed: {previous_status} -> {current_status}")
            if current_status == "stationary" or track_id not in self.vehicle_tracker.stationary_vehicles:
                record_key = (track_id, current_status)
                if record_key not in self.vehicle_tracker.written_records:
                    self.vehicle_tracker.written_records.add(record_key)
                    
                    if current_status == "stationary":
                        self.vehicle_tracker.stationary_vehicles.add(track_id)
                        print(f"[DEBUG] Vehicle {track_id} added to stationary vehicles list")
        
        return
    
    def _update_tracking_history(self, track_id, vehicle_type, current_status, compliance):
        """Update tracking history for vehicles in stop zone"""
        existing_record = self.stop_zone_history_dict.get(str(track_id))
        should_update = False
        
        if existing_record is None:
            should_update = True
            print(f"[DEBUG] New vehicle in stop zone: track_id={track_id}, type={vehicle_type}")
        elif (existing_record.get('status') != current_status or 
              existing_record.get('compliance') != compliance or
              existing_record.get('reaction_time') != self.vehicle_tracker.reaction_times.get(track_id)):
            should_update = True
            print(f"[DEBUG] Status changed for vehicle: track_id={track_id}, status={existing_record.get('status')} -> {current_status}, compliance={existing_record.get('compliance')} -> {compliance}")
        
        if should_update:
            # Only fetch weather data when we actually need to update/save the record
            print(f"[INFO] Fetching weather data for vehicle {track_id} ({vehicle_type}) - saving to database")
            weather_data = self._get_current_weather_data()
            
            current_record = {
                "tracker_id": track_id,
                "vehicle_type": vehicle_type,
                "status": current_status,
                "compliance": compliance,
                "reaction_time": self.vehicle_tracker.reaction_times.get(track_id),
                "weather_condition": weather_data.get('weather_condition'),
                "temperature": weather_data.get('temperature'),
                "humidity": weather_data.get('humidity'),
                "visibility": weather_data.get('visibility'),
                "precipitation_type": weather_data.get('precipitation_type'),
                "wind_speed": weather_data.get('wind_speed'),
                "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            
            self.stop_zone_history_dict[str(track_id)] = current_record
            self.changed_records[str(track_id)] = current_record
            print(f"[DEBUG] Added/updated vehicle {track_id} in changed records. Changed records: {len(self.changed_records)}")
    
        return
    
    def save_all_data_at_end(self):
        """Save all collected data in one batch at the end of processing"""
        if self.mode == "local":
            # Local mode: Save all collected data to CSV in one batch
            if self.changed_records:
                print(f"[INFO] Saving {len(self.changed_records)} records to CSV in final batch...")
                
                # Update the stop_zone_history_dict with all collected records
                for track_id_str, data in self.changed_records.items():
                    self.stop_zone_history_dict[track_id_str] = data
                
                # Save all data to CSV in one operation
                if self.data_manager.update_tracking_file(self.stop_zone_history_dict, self.mode):
                    print(f"[INFO] Successfully saved {len(self.changed_records)} records to CSV in final batch")
                else:
                    print(f"[ERROR] Failed to save {len(self.changed_records)} records to CSV")
                
                # Clear the collected records
                self.changed_records.clear()
            else:
                print("[INFO] No records to save at end of processing")
        else:
            # API mode: Save all collected data in one batch
            if self.changed_records:
                from clients.supabase_client import supabase_manager
                print(f"[INFO] Saving {len(self.changed_records)} records in final batch...")
                
                # Convert to list for batch save
                all_records = []
                for track_id_str, data in self.changed_records.items():
                    all_records.append(data)
                
                # Save all records in one batch operation
                success = supabase_manager.save_tracking_data_batch(all_records)
                if success:
                    print(f"[INFO] Successfully saved {len(all_records)} records in final batch")
                else:
                    print(f"[ERROR] Failed to save {len(all_records)} records in final batch")
                
                # Clear the collected records
                self.changed_records.clear()
            else:
                print("[INFO] No records to save at end of processing")
    
    def get_session_data(self):
        """Get session data for return"""
        session_data = {}
        current_date = datetime.now().strftime("%Y-%m-%d")
        
        if self.mode == "api":
            session_data = self._get_api_session_data(current_date)
        else:
            session_data = self._get_local_session_data(current_date)
        
        return session_data
    
    def _get_api_session_data(self, current_date):
        """Get session data for API mode"""
        from clients.supabase_client import supabase_manager
        
        session_tracking_data = []
        try:
            if self.session_tracker_ids:
                for tracker_id in self.session_tracker_ids:
                    result = supabase_manager.client.table("tracking_results") \
                        .select("*") \
                        .eq("tracker_id", tracker_id) \
                        .execute()
                    if result.data:
                        session_tracking_data.extend(result.data)
                
                print(f"[INFO] Session tracking data: {len(session_tracking_data)} records for tracker_ids: {list(self.session_tracker_ids)}")
            else:
                print("[INFO] No session tracking data (no vehicles processed)")
        except Exception as e:
            print(f"[WARNING] Failed to get session tracking data: {e}")
        
        session_vehicle_counts_formatted = []
        for vehicle_type, count in self.session_vehicle_counts.items():
            session_vehicle_counts_formatted.append({
                "vehicle_type": vehicle_type,
                "count": count,
                "date": current_date
            })
        
        return {
            "tracking_data": session_tracking_data,
            "vehicle_counts": session_vehicle_counts_formatted
        }
    
    def _get_current_weather_data(self):
        """Get current weather data for the location (cached per session)"""
        # Get location coordinates from config
        lat = getattr(Config, 'LOCATION_LAT', -37.740585)  # Melbourne coordinates
        lon = getattr(Config, 'LOCATION_LON', 144.731637)  # Melbourne coordinates
        
        # Check if we have cached weather data that's still fresh (less than 15 minutes old)
        current_time = datetime.now()
        if (hasattr(self, '_weather_cache') and self._weather_cache is not None and 
            hasattr(self, '_weather_cache_time') and self._weather_cache_time is not None):
            time_diff = (current_time - self._weather_cache_time).total_seconds()
            if time_diff < 900:  # 15 minutes cache (increased from 5 minutes)
                return self._weather_cache
        
        # Fetch fresh weather data only once per session
        print(f"[INFO] Fetching fresh weather data for location: {lat}, {lon}")
        try:
            weather_data = weather_manager.get_weather_for_analysis(lat, lon)
            print(f"[INFO] Weather data: {weather_data.get('weather_condition')}, {weather_data.get('temperature')}°C, {weather_data.get('humidity')}% humidity")
            
            # Cache the weather data for the entire session
            self._weather_cache = weather_data
            self._weather_cache_time = current_time
            
            return weather_data
        except Exception as e:
            print(f"[WARNING] Failed to fetch weather data: {e}")
            # Return default weather data if API fails
            return {
                'weather_condition': 'unknown',
                'temperature': 20.0,
                'humidity': 50,
                'visibility': 10.0,
                'precipitation_type': 'none',
                'wind_speed': 5.0
            }
    
    def _get_local_session_data(self, current_date):
        """Get session data for local mode"""
        session_tracking_data = []
        try:
            if self.session_tracker_ids:
                csv_data = self.data_manager.read_existing_data()
                for track_id_str, data in csv_data.items():
                    if data.get('tracker_id') in self.session_tracker_ids:
                        session_record = {
                            "tracker_id": data.get('tracker_id'),
                            "vehicle_type": data.get('vehicle_type'),
                            "status": data.get('status'),
                            "compliance": data.get('compliance'),
                            "reaction_time": data.get('reaction_time'),
                            "date": data.get('date'),
                            "created_at": data.get('date'),
                            "updated_at": data.get('date')
                        }
                        session_tracking_data.append(session_record)
                
                print(f"[INFO] Session tracking data: {len(session_tracking_data)} records for tracker_ids: {list(self.session_tracker_ids)}")
            else:
                print("[INFO] No session tracking data (no vehicles processed)")
        except Exception as e:
            print(f"[WARNING] Failed to get session tracking data from CSV: {e}")
        
        session_vehicle_counts_formatted = []
        for vehicle_type, count in self.session_vehicle_counts.items():
            session_vehicle_counts_formatted.append({
                "vehicle_type": vehicle_type,
                "count": count,
                "date": current_date
            })
        
        return {
            "tracking_data": session_tracking_data,
            "vehicle_counts": session_vehicle_counts_formatted
        }
