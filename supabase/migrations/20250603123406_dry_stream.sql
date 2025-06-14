/*
  # Update vehicle tracking results table

  1. Changes
    - Drop existing table
    - Create new table with proper columns for CSV data
    - Add appropriate indexes
    
  2. Security
    - Disable RLS for direct access
*/

DROP TABLE IF EXISTS vehicle_tracking_results;

CREATE TABLE vehicle_tracking_results (
  video_id uuid REFERENCES video_uploads(id) ON DELETE CASCADE,
  vehicle_count integer,
  average_reaction_time double precision,
  raw_count_csv text,
  raw_tracking_csv text,
  PRIMARY KEY (video_id)
);

-- Add index for faster lookups
CREATE INDEX idx_vehicle_tracking_video_id ON vehicle_tracking_results(video_id);

-- Disable RLS since we're using direct access
ALTER TABLE vehicle_tracking_results DISABLE ROW LEVEL SECURITY;