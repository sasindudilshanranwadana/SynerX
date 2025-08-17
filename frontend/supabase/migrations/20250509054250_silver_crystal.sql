/*
  # Fix video uploads RLS policies

  1. Changes
    - Update RLS policies for video_uploads table to allow authenticated users to insert their own uploads
    - Add policy for service role to bypass RLS

  2. Security
    - Enable RLS on video_uploads table
    - Add policy for authenticated users to insert their own uploads
    - Add policy for service role to bypass RLS
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert their own uploads" ON video_uploads;
DROP POLICY IF EXISTS "Users can view their own uploads" ON video_uploads;
DROP POLICY IF EXISTS "Users can update their own uploads" ON video_uploads;
DROP POLICY IF EXISTS "Users can delete their own uploads" ON video_uploads;

-- Enable RLS
ALTER TABLE video_uploads ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can insert their own uploads"
ON video_uploads
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid()::text = user_id
);

CREATE POLICY "Users can view their own uploads"
ON video_uploads
FOR SELECT
TO authenticated
USING (
  auth.uid()::text = user_id
);

CREATE POLICY "Users can update their own uploads"
ON video_uploads
FOR UPDATE
TO authenticated
USING (
  auth.uid()::text = user_id
)
WITH CHECK (
  auth.uid()::text = user_id
);

CREATE POLICY "Users can delete their own uploads"
ON video_uploads
FOR DELETE
TO authenticated
USING (
  auth.uid()::text = user_id
);

-- Add bypass policy for service role
CREATE POLICY "Service role bypass"
ON video_uploads
TO service_role
USING (true)
WITH CHECK (true);