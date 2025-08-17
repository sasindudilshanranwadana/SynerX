-- Disable RLS on video_uploads table
ALTER TABLE video_uploads DISABLE ROW LEVEL SECURITY;

-- Make videos bucket public
UPDATE storage.buckets
SET public = true
WHERE id = 'videos';

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow authenticated uploads to videos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read own videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete own videos" ON storage.objects;
DROP POLICY IF EXISTS "Service role has full access to videos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow all operations on videos bucket" ON storage.objects;

-- Create simple storage policy to allow all operations
CREATE POLICY "Allow all operations on videos bucket"
ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'videos')
WITH CHECK (bucket_id = 'videos');