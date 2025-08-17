/*
  # Add storage bucket policies

  1. Changes
    - Create analytics storage bucket if it doesn't exist
    - Enable RLS for analytics bucket
    - Add policies for authenticated users to:
      - Upload files
      - Read files
      - Delete files
*/

-- Create analytics bucket if it doesn't exist
INSERT INTO storage.buckets (id, name)
SELECT 'analytics', 'analytics'
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'analytics'
);

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'analytics'
  AND auth.role() = 'authenticated'
);

-- Policy for authenticated users to read files
CREATE POLICY "Authenticated users can read files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'analytics'
  AND auth.role() = 'authenticated'
);

-- Policy for authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'analytics'
  AND auth.role() = 'authenticated'
);