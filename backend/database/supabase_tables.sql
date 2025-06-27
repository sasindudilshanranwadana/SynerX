-- SynerX Database Tables for Supabase
-- Run this SQL in your Supabase SQL editor

-- Create tracking_results table
CREATE TABLE IF NOT EXISTS tracking_results (
    id BIGSERIAL PRIMARY KEY,
    tracker_id INTEGER NOT NULL UNIQUE,
    vehicle_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('moving', 'stationary')),
    compliance INTEGER NOT NULL DEFAULT 0 CHECK (compliance IN (0, 1)),
    reaction_time DECIMAL(5,2),
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vehicle_counts table
CREATE TABLE IF NOT EXISTS vehicle_counts (
    id BIGSERIAL PRIMARY KEY,
    vehicle_type VARCHAR(50) NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(vehicle_type, date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tracking_results_tracker_id ON tracking_results(tracker_id);
CREATE INDEX IF NOT EXISTS idx_tracking_results_date ON tracking_results(date);
CREATE INDEX IF NOT EXISTS idx_tracking_results_vehicle_type ON tracking_results(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_tracking_results_status ON tracking_results(status);

CREATE INDEX IF NOT EXISTS idx_vehicle_counts_date ON vehicle_counts(date);
CREATE INDEX IF NOT EXISTS idx_vehicle_counts_vehicle_type ON vehicle_counts(vehicle_type);

-- Enable Row Level Security (RLS)
ALTER TABLE tracking_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_counts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public access
CREATE POLICY "Allow public read access to tracking_results" ON tracking_results
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to tracking_results" ON tracking_results
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to tracking_results" ON tracking_results
    FOR UPDATE USING (true);

CREATE POLICY "Allow public read access to vehicle_counts" ON vehicle_counts
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to vehicle_counts" ON vehicle_counts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to vehicle_counts" ON vehicle_counts
    FOR UPDATE USING (true);

-- Storage bucket setup (run this manually in Supabase dashboard)
-- Go to Storage > Create bucket
-- Bucket name: videos
-- Public bucket: Yes
-- File size limit: 500MB
-- Allowed MIME types: video/mp4, video/avi, video/mov, video/wmv

-- Storage policies (run after creating the bucket)
CREATE POLICY "Allow public read access to videos" ON storage.objects
    FOR SELECT USING (bucket_id = 'videos');

CREATE POLICY "Allow public insert access to videos" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'videos');

CREATE POLICY "Allow public update access to videos" ON storage.objects
    FOR UPDATE USING (bucket_id = 'videos');

CREATE POLICY "Allow public delete access to videos" ON storage.objects
    FOR DELETE USING (bucket_id = 'videos');
