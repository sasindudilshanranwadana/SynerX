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

-- Allow all operations since we're using Firebase Auth
CREATE POLICY "Allow all operations"
  ON video_uploads
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);