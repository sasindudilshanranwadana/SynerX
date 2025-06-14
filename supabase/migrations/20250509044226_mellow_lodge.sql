/*
  # Update video_uploads table user_id type

  1. Changes
    - Drop existing policies
    - Drop foreign key constraint
    - Change user_id column type from UUID to TEXT
    - Recreate policies with proper type casting
  
  2. Security
    - Recreate RLS policies with TEXT comparison
    - Ensure RLS remains enabled
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own uploads" ON video_uploads;
DROP POLICY IF EXISTS "Users can insert their own uploads" ON video_uploads;
DROP POLICY IF EXISTS "Users can update their own uploads" ON video_uploads;

-- Drop foreign key constraint if it exists
ALTER TABLE video_uploads 
DROP CONSTRAINT IF EXISTS video_uploads_user_id_fkey;

-- Change column type
ALTER TABLE video_uploads 
ALTER COLUMN user_id TYPE TEXT;

-- Recreate policies with TEXT comparison
CREATE POLICY "Users can view their own uploads"
  ON video_uploads
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own uploads"
  ON video_uploads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own uploads"
  ON video_uploads
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id);

-- Ensure RLS is enabled
ALTER TABLE video_uploads ENABLE ROW LEVEL SECURITY;