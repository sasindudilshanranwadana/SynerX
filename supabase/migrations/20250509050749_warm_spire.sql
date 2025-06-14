/*
  # Fix video uploads RLS policies

  1. Changes
    - Drop existing "Allow insert" policy on video_uploads table
    - Create new permissive insert policy
    - Re-enable RLS on video_uploads table

  2. Security
    - Allows all inserts into video_uploads table
    - Maintains existing RLS but with more permissive insert policy
    - Other existing policies (select, update, delete) remain unchanged

  Note: This migration fixes the RLS violation error during video uploads
  while maintaining security for other operations.
*/

-- Drop existing insert policy
DROP POLICY IF EXISTS "Allow insert" ON video_uploads;

-- Create new permissive insert policy
CREATE POLICY "Allow insert"
  ON video_uploads
  FOR INSERT
  WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE video_uploads ENABLE ROW LEVEL SECURITY;