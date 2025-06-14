/*
  # Fix storage policy for video uploads

  1. Changes
    - Add policy to allow authenticated users to upload to their own folders
    - Use proper path comparison for folder names
    - Enable RLS on storage.objects table

  2. Security
    - Ensures users can only upload to their own folders
    - Requires authentication
    - Restricts uploads to videos bucket only
*/

-- Make sure RLS is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow users to upload to their own folder" ON storage.objects;

-- Create new policy with fixed path comparison
CREATE POLICY "Allow users to upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'videos'
  AND auth.uid() IS NOT NULL 
  AND (storage.foldername(name))[1] = auth.uid()::text
);