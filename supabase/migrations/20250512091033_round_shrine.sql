-- Create video_uploads table
CREATE TABLE IF NOT EXISTS video_uploads (
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

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS update_video_uploads_updated_at ON video_uploads;

-- Create or replace trigger function
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