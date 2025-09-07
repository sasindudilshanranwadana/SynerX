-- SynerX Database Tables for Supabase - VIDEO-BASED STRUCTURE
-- Run this SQL in your Supabase SQL Editor to create a fresh, improved database
-- ============================================================================
-- STEP 1: DROP EXISTING TABLES (if they exist)
-- ============================================================================
DROP TABLE IF EXISTS tracking_results CASCADE;
DROP TABLE IF EXISTS vehicle_counts CASCADE;
DROP TABLE IF EXISTS videos CASCADE;
DROP SEQUENCE IF EXISTS tracker_id_seq CASCADE;
-- ============================================================================
-- STEP 2: CREATE SEQUENCE FOR TRACKER_ID
-- ============================================================================
CREATE SEQUENCE tracker_id_seq START 1;
-- ============================================================================
-- STEP 3: CREATE VIDEOS TABLE (NEW - PERSISTENT VIDEO STORAGE)
-- ============================================================================
CREATE TABLE videos (
    id SERIAL PRIMARY KEY,
    video_name VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    original_url TEXT,
    processed_url TEXT,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    file_size BIGINT,
    duration_seconds DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'uploaded' CHECK (
        status IN (
            'uploaded',
            'processing',
            'completed',
            'failed',
            'cancelled',
            'interrupted'
        )
    ),
    processing_start_time TIMESTAMP WITH TIME ZONE,
    processing_end_time TIMESTAMP WITH TIME ZONE,
    total_vehicles INTEGER DEFAULT 0,
    compliance_rate DECIMAL(5, 2) DEFAULT 0.0,
    processing_time_seconds DECIMAL(10, 2) DEFAULT 0.0,
    message TEXT,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- ============================================================================
-- STEP 4: ENHANCED VIDEOS TABLE (WITH PROCESSING TRACKING)
-- ============================================================================
-- The videos table now includes all processing tracking fields
-- No separate jobs table needed - background tasks handle job management
-- ============================================================================
-- STEP 5: CREATE TRACKING RESULTS TABLE (UPDATED WITH VIDEO_ID)
-- ============================================================================
CREATE TABLE tracking_results (
    tracker_id INTEGER PRIMARY KEY DEFAULT nextval('tracker_id_seq'),
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('moving', 'stationary')),
    compliance INTEGER NOT NULL DEFAULT 0 CHECK (compliance IN (0, 1)),
    reaction_time DECIMAL(5, 2),
    weather_condition VARCHAR(50),
    temperature DECIMAL(4, 1),
    humidity INTEGER CHECK (
        humidity >= 0
        AND humidity <= 100
    ),
    visibility DECIMAL(4, 1),
    precipitation_type VARCHAR(30),
    wind_speed DECIMAL(4, 1),
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- ============================================================================
-- STEP 6: CREATE VEHICLE COUNTS TABLE (UPDATED WITH VIDEO_ID)
-- ============================================================================
CREATE TABLE vehicle_counts (
    id BIGSERIAL PRIMARY KEY,
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(50) NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(video_id, vehicle_type, date)
);
-- ============================================================================
-- STEP 7: CREATE INDEXES FOR BETTER PERFORMANCE
-- ============================================================================
-- Videos table indexes
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_upload_date ON videos(upload_date);
-- job_id index removed (no jobs table needed)
CREATE INDEX idx_videos_created_at ON videos(created_at);
-- Jobs table indexes (REMOVED - no jobs table needed)
-- Tracking results indexes
CREATE INDEX idx_tracking_results_video_id ON tracking_results(video_id);
CREATE INDEX idx_tracking_results_date ON tracking_results(date);
CREATE INDEX idx_tracking_results_vehicle_type ON tracking_results(vehicle_type);
CREATE INDEX idx_tracking_results_status ON tracking_results(status);
CREATE INDEX idx_tracking_results_created_at ON tracking_results(created_at);
CREATE INDEX idx_tracking_results_weather ON tracking_results(weather_condition);
CREATE INDEX idx_tracking_results_temperature ON tracking_results(temperature);
CREATE INDEX idx_tracking_results_humidity ON tracking_results(humidity);
CREATE INDEX idx_tracking_results_visibility ON tracking_results(visibility);
-- Vehicle counts indexes
CREATE INDEX idx_vehicle_counts_video_id ON vehicle_counts(video_id);
CREATE INDEX idx_vehicle_counts_date ON vehicle_counts(date);
CREATE INDEX idx_vehicle_counts_vehicle_type ON vehicle_counts(vehicle_type);
CREATE INDEX idx_vehicle_counts_created_at ON vehicle_counts(created_at);
-- ============================================================================
-- STEP 8: CREATE HELPER FUNCTIONS
-- ============================================================================
-- Function to get next tracker_id
CREATE OR REPLACE FUNCTION next_tracker_id() RETURNS INTEGER AS $$ BEGIN RETURN nextval('tracker_id_seq');
END;
$$ LANGUAGE plpgsql;
-- Function to get current tracker_id sequence value
CREATE OR REPLACE FUNCTION current_tracker_id() RETURNS INTEGER AS $$ BEGIN RETURN currval('tracker_id_seq');
END;
$$ LANGUAGE plpgsql;
-- Function to set tracker_id sequence to a specific value
CREATE OR REPLACE FUNCTION set_tracker_id_sequence(value INTEGER) RETURNS INTEGER AS $$ BEGIN PERFORM setval('tracker_id_seq', value);
RETURN currval('tracker_id_seq');
END;
$$ LANGUAGE plpgsql;
-- Function to get next available tracker_id (handles gaps)
CREATE OR REPLACE FUNCTION get_next_available_tracker_id() RETURNS INTEGER AS $$
DECLARE next_id INTEGER;
max_id INTEGER;
BEGIN -- Get the highest existing tracker_id
SELECT COALESCE(MAX(tracker_id), 0) INTO max_id
FROM tracking_results;
-- Set sequence to continue from the highest existing ID
PERFORM setval('tracker_id_seq', max_id);
-- Get the next ID
next_id := nextval('tracker_id_seq');
RETURN next_id;
END;
$$ LANGUAGE plpgsql;
-- Function to update video processing stats
CREATE OR REPLACE FUNCTION update_video_stats(
        p_video_id INTEGER,
        p_total_vehicles INTEGER,
        p_compliance_rate DECIMAL,
        p_processing_time DECIMAL
    ) RETURNS VOID AS $$ BEGIN
UPDATE videos
SET total_vehicles = p_total_vehicles,
    compliance_rate = p_compliance_rate,
    processing_time_seconds = p_processing_time,
    processing_end_time = NOW(),
    updated_at = NOW()
WHERE id = p_video_id;
END;
$$ LANGUAGE plpgsql;
-- Function to get video with all related data
CREATE OR REPLACE FUNCTION get_video_with_results(p_video_id INTEGER) RETURNS TABLE(
        video_id INTEGER,
        video_name VARCHAR,
        status VARCHAR,
        total_vehicles INTEGER,
        compliance_rate DECIMAL,
        processing_time DECIMAL,
        tracking_data JSON,
        vehicle_counts JSON
    ) AS $$ BEGIN RETURN QUERY
SELECT v.id,
    v.video_name,
    v.status,
    v.total_vehicles,
    v.compliance_rate,
    v.processing_time_seconds,
    COALESCE(
        (
            SELECT json_agg(
                    json_build_object(
                        'tracker_id',
                        tr.tracker_id,
                        'vehicle_type',
                        tr.vehicle_type,
                        'status',
                        tr.status,
                        'compliance',
                        tr.compliance,
                        'reaction_time',
                        tr.reaction_time,
                        'weather_condition',
                        tr.weather_condition,
                        'temperature',
                        tr.temperature,
                        'humidity',
                        tr.humidity,
                        'visibility',
                        tr.visibility,
                        'precipitation_type',
                        tr.precipitation_type,
                        'wind_speed',
                        tr.wind_speed,
                        'date',
                        tr.date
                    )
                )
            FROM tracking_results tr
            WHERE tr.video_id = v.id
        ),
        '[]'::json
    ) as tracking_data,
    COALESCE(
        (
            SELECT json_agg(
                    json_build_object(
                        'vehicle_type',
                        vc.vehicle_type,
                        'count',
                        vc.count,
                        'date',
                        vc.date
                    )
                )
            FROM vehicle_counts vc
            WHERE vc.video_id = v.id
        ),
        '[]'::json
    ) as vehicle_counts
FROM videos v
WHERE v.id = p_video_id;
END;
$$ LANGUAGE plpgsql;
-- ============================================================================
-- STEP 9: CREATE TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Create triggers for updated_at
CREATE TRIGGER update_videos_updated_at BEFORE
UPDATE ON videos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Jobs table trigger removed (no jobs table needed)
CREATE TRIGGER update_tracking_results_updated_at BEFORE
UPDATE ON tracking_results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicle_counts_updated_at BEFORE
UPDATE ON vehicle_counts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ============================================================================
-- STEP 10: ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
-- Jobs table RLS removed (no jobs table needed)
ALTER TABLE tracking_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_counts ENABLE ROW LEVEL SECURITY;
-- ============================================================================
-- STEP 11: CREATE RLS POLICIES FOR PUBLIC ACCESS
-- ============================================================================
-- Videos policies
CREATE POLICY "Allow public read access to videos" ON videos FOR
SELECT USING (true);
CREATE POLICY "Allow public insert access to videos" ON videos FOR
INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to videos" ON videos FOR
UPDATE USING (true);
CREATE POLICY "Allow public delete access to videos" ON videos FOR DELETE USING (true);
-- Jobs policies removed (no jobs table needed)
-- Tracking results policies
CREATE POLICY "Allow public read access to tracking_results" ON tracking_results FOR
SELECT USING (true);
CREATE POLICY "Allow public insert access to tracking_results" ON tracking_results FOR
INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to tracking_results" ON tracking_results FOR
UPDATE USING (true);
CREATE POLICY "Allow public delete access to tracking_results" ON tracking_results FOR DELETE USING (true);
-- Vehicle counts policies
CREATE POLICY "Allow public read access to vehicle_counts" ON vehicle_counts FOR
SELECT USING (true);
CREATE POLICY "Allow public insert access to vehicle_counts" ON vehicle_counts FOR
INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to vehicle_counts" ON vehicle_counts FOR
UPDATE USING (true);
CREATE POLICY "Allow public delete access to vehicle_counts" ON vehicle_counts FOR DELETE USING (true);
-- ============================================================================
-- STEP 12: CREATE STORAGE BUCKET (MANUAL SETUP REQUIRED)
-- ============================================================================
-- NOTE: You need to manually create the storage bucket in Supabase Dashboard
-- Go to Storage > Create bucket
-- Bucket name: videos
-- Public bucket: Yes
-- File size limit: 500MB
-- Allowed MIME types: video/mp4, video/avi, video/mov, video/wmv
-- ============================================================================
-- STEP 13: CREATE STORAGE POLICIES (RUN AFTER CREATING BUCKET)
-- ============================================================================
-- Uncomment and run these after creating the 'videos' bucket in Supabase Dashboard
/*
 CREATE POLICY "Allow public read access to videos" ON storage.objects
 FOR SELECT USING (bucket_id = 'videos');
 
 CREATE POLICY "Allow public insert access to videos" ON storage.objects
 FOR INSERT WITH CHECK (bucket_id = 'videos');
 
 CREATE POLICY "Allow public update access to videos" ON storage.objects
 FOR UPDATE USING (bucket_id = 'videos');
 
 CREATE POLICY "Allow public delete access to videos" ON storage.objects
 FOR DELETE USING (bucket_id = 'videos');
 */
-- ============================================================================
-- STEP 13: ADD FOREIGN KEY CONSTRAINTS
-- ============================================================================
-- No foreign key constraints needed - job_id is just a reference field
-- Background tasks handle job management in memory
-- ============================================================================
-- STEP 13.5: UPDATE EXISTING DATABASE CONSTRAINTS (IF NEEDED)
-- ============================================================================
-- If you're updating an existing database that doesn't have the "interrupted" status,
-- run these commands to update the constraints:
-- Update videos table status constraint
ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_status_check;
ALTER TABLE videos
ADD CONSTRAINT videos_status_check CHECK (
        status IN (
            'uploaded',
            'processing',
            'completed',
            'failed',
            'cancelled',
            'interrupted'
        )
    );
-- Jobs table status constraint (REMOVED - no jobs table needed)
-- ============================================================================
-- STEP 14: INSERT SAMPLE DATA (OPTIONAL)
-- ============================================================================
-- Uncomment these lines if you want to add some sample data for testing
/*
 -- Sample video
 INSERT INTO videos (video_name, original_filename, status, total_vehicles, compliance_rate, processing_time_seconds) VALUES
 ('Sample Traffic Video', 'sample_traffic.mp4', 'completed', 5, 80.0, 45.5);
 
 -- Sample job (REMOVED - no jobs table needed)
 
 -- Sample tracking data
 INSERT INTO tracking_results (video_id, vehicle_type, status, compliance, reaction_time, weather_condition, temperature, humidity, visibility, precipitation_type, wind_speed, date) VALUES
 (1, 'car', 'stationary', 1, 2.5, 'clear', 22.5, 65, 10.0, 'none', 5.2, NOW()),
 (1, 'truck', 'moving', 0, NULL, 'rainy', 18.0, 85, 6.5, 'rain', 12.8, NOW()),
 (1, 'car', 'stationary', 1, 1.8, 'cloudy', 20.0, 70, 8.0, 'none', 8.5, NOW());
 
 -- Sample vehicle counts
 INSERT INTO vehicle_counts (video_id, vehicle_type, count, date) VALUES
 (1, 'car', 3, CURRENT_DATE),
 (1, 'truck', 2, CURRENT_DATE);
 */
-- ============================================================================
-- STEP 15: VERIFICATION QUERIES
-- ============================================================================
-- Run these queries to verify everything is set up correctly
-- Check if tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name IN (
        'videos',
        'tracking_results',
        'vehicle_counts'
    );
-- Check if sequence was created
SELECT sequence_name
FROM information_schema.sequences
WHERE sequence_schema = 'public'
    AND sequence_name = 'tracker_id_seq';
-- Check if functions were created
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name LIKE '%tracker_id%';
-- Test the next_tracker_id function
SELECT next_tracker_id() as next_id;
-- Check current sequence value
SELECT currval('tracker_id_seq') as current_value;
-- ============================================================================
-- COMPLETE SETUP SUMMARY
-- ============================================================================
/*
 ✅ Tables created:
 - videos (persistent video storage with processing stats and tracking)
 - tracking_results (vehicle tracking data linked to videos)
 - vehicle_counts (vehicle counts linked to videos)
 
 ✅ Video Statuses:
 - uploaded: Video uploaded, waiting for processing
 - processing: Currently being processed
 - completed: Processing finished successfully
 - failed: Processing failed with error
 - cancelled: Processing cancelled before data collection
 - interrupted: Processing stopped but partial data saved
 
 ✅ Processing Tracking:
 - job_id: Removed (no jobs table needed)
 - message: Current processing status message
 - error: Error details if processing failed
 
 ✅ Sequence created:
 - tracker_id_seq (auto-incrementing)
 
 ✅ Functions created:
 - next_tracker_id() - Get next tracker_id
 - current_tracker_id() - Get current sequence value
 - set_tracker_id_sequence(value) - Set sequence to specific value
 - get_next_available_tracker_id() - Get next available ID (handles gaps)
 - update_video_stats() - Update video processing statistics
 - get_video_with_results() - Get video with all related data
 
 ✅ Indexes created for performance
 
 ✅ Triggers created for automatic timestamp updates
 
 ✅ RLS enabled with public access policies
 
 ✅ Ready for video storage (manual bucket creation required)
 
 ✅ PERSISTENT DATA: Videos and tracking data survive restarts!
 
 The database is now ready for SynerX with persistent video storage!
 */
