/*
  # Create analytics storage bucket

  1. New Storage Bucket
    - Create 'analytics' bucket for storing CSV files
  
  2. Security
    - Enable public access for authenticated users
    - Add policies for:
      - Authenticated users can upload files
      - Authenticated users can read files
      - Authenticated users can delete their own files
*/

-- Create the analytics bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('analytics', 'analytics', false);

-- Policy to allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'analytics');

-- Policy to allow authenticated users to read files
CREATE POLICY "Allow authenticated users to read files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'analytics');

-- Policy to allow authenticated users to delete their own files
CREATE POLICY "Allow authenticated users to delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'analytics' AND auth.uid() = owner);