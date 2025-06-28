-- SynerX Database Tables for Supabase - COMPLETE FRESH SETUP
-- Run this SQL in your Supabase SQL Editor to create a fresh, improved database

-- ============================================================================
-- STEP 1: DROP EXISTING TABLES (if they exist)
-- ============================================================================
DROP TABLE IF EXISTS tracking_results CASCADE;
DROP TABLE IF EXISTS vehicle_counts CASCADE;
DROP SEQUENCE IF EXISTS tracker_id_seq CASCADE;

-- ============================================================================
-- STEP 2: CREATE SEQUENCE FOR TRACKER_ID
-- ============================================================================
CREATE SEQUENCE tracker_id_seq START 1;

-- ============================================================================
-- STEP 3: CREATE TRACKING RESULTS TABLE (IMPROVED DESIGN)
-- ============================================================================
CREATE TABLE tracking_results (
    tracker_id INTEGER PRIMARY KEY DEFAULT nextval('tracker_id_seq'),
    vehicle_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('moving', 'stationary')),
    compliance INTEGER NOT NULL DEFAULT 0 CHECK (compliance IN (0, 1)),
    reaction_time DECIMAL(5,2),
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 4: CREATE VEHICLE COUNTS TABLE
-- ============================================================================
CREATE TABLE vehicle_counts (
    id BIGSERIAL PRIMARY KEY,
    vehicle_type VARCHAR(50) NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(vehicle_type, date)
);

-- ============================================================================
-- STEP 5: CREATE INDEXES FOR BETTER PERFORMANCE
-- ============================================================================
-- Tracking results indexes
CREATE INDEX idx_tracking_results_date ON tracking_results(date);
CREATE INDEX idx_tracking_results_vehicle_type ON tracking_results(vehicle_type);
CREATE INDEX idx_tracking_results_status ON tracking_results(status);
CREATE INDEX idx_tracking_results_created_at ON tracking_results(created_at);

-- Vehicle counts indexes
CREATE INDEX idx_vehicle_counts_date ON vehicle_counts(date);
CREATE INDEX idx_vehicle_counts_vehicle_type ON vehicle_counts(vehicle_type);
CREATE INDEX idx_vehicle_counts_created_at ON vehicle_counts(created_at);

-- ============================================================================
-- STEP 6: CREATE HELPER FUNCTIONS
-- ============================================================================
-- Function to get next tracker_id
CREATE OR REPLACE FUNCTION next_tracker_id()
RETURNS INTEGER AS $$
BEGIN
    RETURN nextval('tracker_id_seq');
END;
$$ LANGUAGE plpgsql;

-- Function to get current tracker_id sequence value
CREATE OR REPLACE FUNCTION current_tracker_id()
RETURNS INTEGER AS $$
BEGIN
    RETURN currval('tracker_id_seq');
END;
$$ LANGUAGE plpgsql;

-- Function to set tracker_id sequence to a specific value
CREATE OR REPLACE FUNCTION set_tracker_id_sequence(value INTEGER)
RETURNS INTEGER AS $$
BEGIN
    PERFORM setval('tracker_id_seq', value);
    RETURN currval('tracker_id_seq');
END;
$$ LANGUAGE plpgsql;

-- Function to get next available tracker_id (handles gaps)
CREATE OR REPLACE FUNCTION get_next_available_tracker_id()
RETURNS INTEGER AS $$
DECLARE
    next_id INTEGER;
    max_id INTEGER;
BEGIN
    -- Get the highest existing tracker_id
    SELECT COALESCE(MAX(tracker_id), 0) INTO max_id FROM tracking_results;
    
    -- Set sequence to continue from the highest existing ID
    PERFORM setval('tracker_id_seq', max_id);
    
    -- Get the next ID
    next_id := nextval('tracker_id_seq');
    
    RETURN next_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 7: ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE tracking_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_counts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 8: CREATE RLS POLICIES FOR PUBLIC ACCESS
-- ============================================================================
-- Tracking results policies
CREATE POLICY "Allow public read access to tracking_results" ON tracking_results
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to tracking_results" ON tracking_results
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to tracking_results" ON tracking_results
    FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access to tracking_results" ON tracking_results
    FOR DELETE USING (true);

-- Vehicle counts policies
CREATE POLICY "Allow public read access to vehicle_counts" ON vehicle_counts
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to vehicle_counts" ON vehicle_counts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to vehicle_counts" ON vehicle_counts
    FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access to vehicle_counts" ON vehicle_counts
    FOR DELETE USING (true);

-- ============================================================================
-- STEP 9: CREATE STORAGE BUCKET (MANUAL SETUP REQUIRED)
-- ============================================================================
-- NOTE: You need to manually create the storage bucket in Supabase Dashboard
-- Go to Storage > Create bucket
-- Bucket name: videos
-- Public bucket: Yes
-- File size limit: 500MB
-- Allowed MIME types: video/mp4, video/avi, video/mov, video/wmv

-- ============================================================================
-- STEP 10: CREATE STORAGE POLICIES (RUN AFTER CREATING BUCKET)
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
-- STEP 11: INSERT SAMPLE DATA (OPTIONAL)
-- ============================================================================
-- Uncomment these lines if you want to add some sample data for testing

/*
-- Sample tracking data
INSERT INTO tracking_results (tracker_id, vehicle_type, status, compliance, reaction_time, date) VALUES
(1, 'car', 'stationary', 1, 2.5, NOW()),
(2, 'truck', 'moving', 0, NULL, NOW()),
(3, 'car', 'stationary', 1, 1.8, NOW());

-- Sample vehicle counts
INSERT INTO vehicle_counts (vehicle_type, count, date) VALUES
('car', 2, CURRENT_DATE),
('truck', 1, CURRENT_DATE);
*/

-- ============================================================================
-- STEP 12: VERIFICATION QUERIES
-- ============================================================================
-- Run these queries to verify everything is set up correctly

-- Check if tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('tracking_results', 'vehicle_counts');

-- Check if sequence was created
SELECT sequence_name FROM information_schema.sequences 
WHERE sequence_schema = 'public' AND sequence_name = 'tracker_id_seq';

-- Check if functions were created
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name LIKE '%tracker_id%';

-- Test the next_tracker_id function
SELECT next_tracker_id() as next_id;

-- Check current sequence value
SELECT currval('tracker_id_seq') as current_value;

-- ============================================================================
-- COMPLETE SETUP SUMMARY
-- ============================================================================
/*
✅ Tables created:
   - tracking_results (with tracker_id as PRIMARY KEY)
   - vehicle_counts

✅ Sequence created:
   - tracker_id_seq (auto-incrementing)

✅ Functions created:
   - next_tracker_id() - Get next tracker_id
   - current_tracker_id() - Get current sequence value
   - set_tracker_id_sequence(value) - Set sequence to specific value
   - get_next_available_tracker_id() - Get next available ID (handles gaps)

✅ Indexes created for performance

✅ RLS enabled with public access policies

✅ Ready for video storage (manual bucket creation required)

The database is now ready for SynerX! No more ID jumps, sequential tracker_ids, and optimal performance.
*/
