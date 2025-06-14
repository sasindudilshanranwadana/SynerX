/*
  # Update vehicle tracking results table

  1. Changes
    - Drop existing table
    - Create new table with proper schema for both count and tracking data
    - Add index for faster lookups
    - Disable RLS for direct access
*/

-- Drop existing table
DROP TABLE IF EXISTS vehicle_tracking_results;

-- Create new table with updated schema
CREATE TABLE vehicle_tracking_results (
  video_id uuid REFERENCES video_uploads(id) ON DELETE CASCADE,
  vehicle_count integer DEFAULT 0,
  average_reaction_time double precision DEFAULT 0,
  raw_count_csv text,
  raw_tracking_csv text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (video_id)
);

-- Add index for faster lookups
CREATE INDEX idx_vehicle_tracking_video_id ON vehicle_tracking_results(video_id);

-- Create trigger for updated_at
CREATE TRIGGER update_vehicle_tracking_updated_at
  BEFORE UPDATE ON vehicle_tracking_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Disable RLS since we're using direct access
ALTER TABLE vehicle_tracking_results DISABLE ROW LEVEL SECURITY;