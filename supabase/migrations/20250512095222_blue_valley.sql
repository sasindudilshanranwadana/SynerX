-- Drop existing table
DROP TABLE IF EXISTS video_uploads;

-- Create video_uploads table with simplified schema
CREATE TABLE video_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  upload_date timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('uploading', 'completed', 'failed')),
  progress integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
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

-- Disable RLS
ALTER TABLE video_uploads DISABLE ROW LEVEL SECURITY;

-- Create videos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow all operations on videos bucket" ON storage.objects;

-- Create simple storage policy
CREATE POLICY "Allow all operations on videos bucket"
ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'videos')
WITH CHECK (bucket_id = 'videos');