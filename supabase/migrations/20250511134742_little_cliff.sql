/*
  # Add storage RLS policies for video uploads

  1. Changes
    - Enable RLS on storage.objects table
    - Add policy to allow authenticated users to upload to videos bucket
    - Add policy to allow authenticated users to read from videos bucket
    - Add policy to allow authenticated users to update their own objects
    - Add policy to allow authenticated users to delete their own objects

  2. Security
    - Enables row level security on storage.objects
    - Restricts uploads to authenticated users only
    - Users can only access their own uploaded files
*/

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert into the "videos" bucket
CREATE POLICY "Allow uploads to videos bucket"
ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'videos' AND auth.role() = 'authenticated'
);

-- Allow users to read their own objects
CREATE POLICY "Allow users to read own objects in videos bucket"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'videos' 
  AND owner = auth.uid()
);

-- Allow users to update their own objects
CREATE POLICY "Allow users to update own objects in videos bucket"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'videos' 
  AND owner = auth.uid()
)
WITH CHECK (
  bucket_id = 'videos' 
  AND owner = auth.uid()
);

-- Allow users to delete their own objects
CREATE POLICY "Allow users to delete own objects in videos bucket"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'videos' 
  AND owner = auth.uid()
);