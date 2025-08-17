-- Drop all existing policies
DROP POLICY IF EXISTS "Allow authenticated uploads to videos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read own videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete own videos" ON storage.objects;
DROP POLICY IF EXISTS "Service role has full access to videos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON video_uploads;
DROP POLICY IF EXISTS "Allow read for own uploads" ON video_uploads;
DROP POLICY IF EXISTS "Allow update for own uploads" ON video_uploads;
DROP POLICY IF EXISTS "Allow delete for own uploads" ON video_uploads;

-- Make videos bucket public
UPDATE storage.buckets
SET public = true
WHERE id = 'videos';

-- Disable RLS on video_uploads to allow direct access
ALTER TABLE video_uploads DISABLE ROW LEVEL SECURITY;

-- Create simple storage policies
CREATE POLICY "Allow all operations on videos bucket"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'videos')
WITH CHECK (bucket_id = 'videos');

-- Add service role bypass policy for storage
CREATE POLICY "Service role has full access to videos bucket"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'videos')
WITH CHECK (bucket_id = 'videos');