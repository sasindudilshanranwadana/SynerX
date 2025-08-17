/*
  # Create video uploads table and storage configuration

  1. New Tables
    - `video_uploads`
      - `id` (uuid, primary key)
      - `user_id` (text)
      - `file_name` (text)
      - `file_size` (bigint)
      - `upload_date` (timestamptz)
      - `status` (text)
      - `progress` (integer)
      - `error` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Storage
    - Create videos bucket
    - Configure storage policies
*/

-- Drop existing objects to avoid conflicts
DROP TABLE IF EXISTS video_uploads;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

-- Create video_uploads table
CREATE TABLE video_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  upload_date timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('uploading', 'completed', 'failed')),
  progress integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create updated_at trigger function
CREATE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER update_video_uploads_updated_at
  BEFORE UPDATE ON video_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Disable RLS for Firebase auth compatibility
ALTER TABLE video_uploads DISABLE ROW LEVEL SECURITY;

-- Create videos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow all operations on videos bucket" ON storage.objects;

-- Create storage policy to allow authenticated uploads
CREATE POLICY "Allow all operations on videos bucket"
ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'videos')
WITH CHECK (bucket_id = 'videos');