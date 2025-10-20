/*
  # Fix video uploads RLS policies

  1. Changes
    - Drop existing RLS policies for video_uploads table
    - Add new RLS policies that properly handle authenticated users
    
  2. Security
    - Enable RLS on video_uploads table
    - Add policies for:
      - Authenticated users can insert their own uploads
      - Users can view their own uploads
      - Users can update their own uploads
      - Users can delete their own uploads
      - Service role has full access bypass
*/

-- First drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Service role bypass" ON video_uploads;
DROP POLICY IF EXISTS "Users can delete their own uploads" ON video_uploads;
DROP POLICY IF EXISTS "Users can insert their own uploads" ON video_uploads;
DROP POLICY IF EXISTS "Users can update their own uploads" ON video_uploads;
DROP POLICY IF EXISTS "Users can view their own uploads" ON video_uploads;

-- Re-create policies with proper conditions
CREATE POLICY "Service role bypass"
ON video_uploads
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view their own uploads"
ON video_uploads
AS PERMISSIVE
FOR SELECT
TO authenticated
USING ((auth.uid())::text = user_id);

CREATE POLICY "Users can insert their own uploads"
ON video_uploads
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "Users can update their own uploads"
ON video_uploads
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING ((auth.uid())::text = user_id)
WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "Users can delete their own uploads"
ON video_uploads
AS PERMISSIVE
FOR DELETE
TO authenticated
USING ((auth.uid())::text = user_id);