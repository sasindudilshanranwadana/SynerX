-- Create table for vehicle tracking results
CREATE TABLE IF NOT EXISTS vehicle_tracking_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid REFERENCES video_uploads(id) ON DELETE CASCADE,
  vehicle_count integer DEFAULT 0,
  speed_violations integer DEFAULT 0,
  average_speed float DEFAULT 0,
  timestamps jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_vehicle_tracking_video_id 
ON vehicle_tracking_results(video_id);

-- Disable RLS for now since we're using Firebase auth
ALTER TABLE vehicle_tracking_results DISABLE ROW LEVEL SECURITY;