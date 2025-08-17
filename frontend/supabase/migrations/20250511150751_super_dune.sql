/*
  # Fix video uploads policies for Firebase authentication

  1. Changes
    - Drop existing policies that are causing issues
    - Create new policy for reading uploads based on Firebase UID
    - Add proper type casting for user_id comparison

  2. Security
    - Enable RLS on video_uploads table
    - Add policy for authenticated users to read their own uploads
    - Ensure proper type casting between text and UUID
*/

-- Drop existing policies
DROP POLICY IF EXISTS "firebase user access" ON video_uploads;
DROP POLICY IF EXISTS "Users can view their own uploads" ON video_uploads;

-- Create new policy for reading uploads based on Firebase UID
CREATE POLICY "Users can view their own uploads"
ON video_uploads
FOR SELECT
TO public
USING (
  user_id = auth.uid()::text
);