/*
  # Configure storage bucket for video uploads

  1. Changes
    - Create videos bucket if it doesn't exist
    - Enable RLS on storage.objects
    - Add policies for video uploads with user isolation
  
  2. Security
    - Enable RLS
    - Add policies for authenticated users
    - Ensure users can only access their own files
*/

-- Create videos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name)
VALUES ('videos', 'videos')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow uploads to videos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read own objects in videos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete own objects in videos bucket" ON storage.objects;

-- Allow authenticated users to upload to videos bucket
CREATE POLICY "Allow uploads to videos bucket"
ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'videos' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own objects
CREATE POLICY "Allow users to read own objects in videos bucket"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'videos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own objects
CREATE POLICY "Allow users to delete own objects in videos bucket"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'videos' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);