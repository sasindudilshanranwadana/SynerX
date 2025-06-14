/*
  # Set up storage bucket and policies for video uploads

  1. Changes
    - Create videos bucket
    - Enable RLS on storage.objects
    - Add policies for authenticated users
    - Add service role bypass policy

  2. Security
    - Private bucket (not public)
    - User-specific folder access
    - Full CRUD operations for authenticated users on their own files
*/

-- Create videos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow uploads to videos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read own objects in videos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete own objects in videos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Service role has full access to videos bucket" ON storage.objects;

-- Create policies for video uploads
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