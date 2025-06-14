/*
  # Fix Storage RLS Policies

  1. Changes
    - Enable RLS on storage.objects table
    - Add policies for authenticated users to:
      - Upload files to the analytics bucket
      - Read files from the analytics bucket
      - Delete their own uploaded files
    
  2. Security
    - Only authenticated users can access the analytics bucket
    - Users can only delete files they uploaded
    - All authenticated users can read analytics files
*/

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to upload files to analytics bucket
CREATE POLICY "Allow authenticated uploads to analytics"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'analytics' 
  AND auth.role() = 'authenticated'
);

-- Policy to allow authenticated users to read analytics files
CREATE POLICY "Allow authenticated reads from analytics"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'analytics'
  AND auth.role() = 'authenticated'
);

-- Policy to allow users to delete their own uploaded files
CREATE POLICY "Allow users to delete their own analytics files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'analytics'
  AND owner = auth.uid()
);