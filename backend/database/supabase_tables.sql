-- SynerX Database Schema for Supabase
-- Traffic Analysis System - Video Processing & Tracking
-- ============================================================================
-- CLEAN UP EXISTING TABLES
-- ============================================================================
DROP TABLE IF EXISTS tracking_results CASCADE;
DROP TABLE IF EXISTS vehicle_counts CASCADE;
DROP TABLE IF EXISTS videos CASCADE;
DROP SEQUENCE IF EXISTS tracker_id_seq CASCADE;
-- ============================================================================
-- CREATE SEQUENCE
-- ============================================================================
CREATE SEQUENCE tracker_id_seq START 1;
-- ============================================================================
-- CREATE TABLES
-- ============================================================================
-- Videos table - stores video metadata and processing status
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
-- Tracking results table - individual vehicle tracking data
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
-- Vehicle counts table - aggregated vehicle counts per video
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
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================
-- Videos indexes
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_upload_date ON videos(upload_date);
CREATE INDEX idx_videos_created_at ON videos(created_at);
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
-- CREATE HELPER FUNCTIONS
-- ============================================================================
-- Tracker ID management functions
CREATE OR REPLACE FUNCTION next_tracker_id() RETURNS INTEGER AS $$ BEGIN RETURN nextval('tracker_id_seq');
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION current_tracker_id() RETURNS INTEGER AS $$ BEGIN RETURN currval('tracker_id_seq');
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION set_tracker_id_sequence(value INTEGER) RETURNS INTEGER AS $$ BEGIN PERFORM setval('tracker_id_seq', value);
RETURN currval('tracker_id_seq');
END;
$$ LANGUAGE plpgsql;
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
-- Video statistics update function
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
-- Get video with all related data as JSON
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
-- CREATE TRIGGERS
-- ============================================================================
-- Auto-update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Apply triggers to all tables
CREATE TRIGGER update_videos_updated_at BEFORE
UPDATE ON videos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tracking_results_updated_at BEFORE
UPDATE ON tracking_results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicle_counts_updated_at BEFORE
UPDATE ON vehicle_counts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_counts ENABLE ROW LEVEL SECURITY;
-- ============================================================================
-- CREATE RLS POLICIES (PUBLIC ACCESS)
-- ============================================================================
-- Videos policies
CREATE POLICY "Allow public read access to videos" ON videos FOR
SELECT USING (true);
CREATE POLICY "Allow public insert access to videos" ON videos FOR
INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to videos" ON videos FOR
UPDATE USING (true);
CREATE POLICY "Allow public delete access to videos" ON videos FOR DELETE USING (true);
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
-- VERIFICATION QUERIES
-- ============================================================================
-- Check if tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name IN ('videos', 'tracking_results', 'vehicle_counts');
-- Check if sequence was created
SELECT sequence_name
FROM information_schema.sequences
WHERE table_schema = 'public'
    AND sequence_name = 'tracker_id_seq';
-- Test tracker ID function
SELECT next_tracker_id() as next_id;