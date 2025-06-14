-- Create videos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated uploads to videos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read own videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete own videos" ON storage.objects;
DROP POLICY IF EXISTS "Service role has full access to videos bucket" ON storage.objects;

-- Create new policies for video uploads
CREATE POLICY "Allow authenticated uploads to videos bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'videos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Allow users to read own videos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'videos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Allow users to delete own videos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'videos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Add service role bypass policy
CREATE POLICY "Service role has full access to videos bucket"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'videos')
WITH CHECK (bucket_id = 'videos');

-- Update video_uploads table policies
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON video_uploads;
DROP POLICY IF EXISTS "Allow read for own uploads" ON video_uploads;
DROP POLICY IF EXISTS "Allow update for own uploads" ON video_uploads;
DROP POLICY IF EXISTS "Allow delete for own uploads" ON video_uploads;

CREATE POLICY "Allow insert for authenticated users"
ON video_uploads
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()::text
);

CREATE POLICY "Allow read for own uploads"
ON video_uploads
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()::text
);

CREATE POLICY "Allow update for own uploads"
ON video_uploads
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()::text
)
WITH CHECK (
  user_id = auth.uid()::text
);

CREATE POLICY "Allow delete for own uploads"
ON video_uploads
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()::text
);