/*
  # Update video_uploads table for direct upload

  1. Changes
    - Remove unused columns
    - Update status check constraint
    - Keep RLS policies unchanged
*/

-- Drop existing table
DROP TABLE IF EXISTS video_uploads;

-- Create video_uploads table with simplified schema
CREATE TABLE video_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  upload_date timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('uploading', 'completed', 'failed')),
  progress integer NOT NULL DEFAULT 0,
  drive_file_id text,
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE video_uploads ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER update_video_uploads_updated_at
    BEFORE UPDATE ON video_uploads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create policies for authenticated users
CREATE POLICY "Users can insert their own uploads"
ON video_uploads
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid()::text = user_id
);

CREATE POLICY "Users can view their own uploads"
ON video_uploads
FOR SELECT
TO authenticated
USING (
  auth.uid()::text = user_id
);

CREATE POLICY "Users can update their own uploads"
ON video_uploads
FOR UPDATE
TO authenticated
USING (
  auth.uid()::text = user_id
)
WITH CHECK (
  auth.uid()::text = user_id
);

CREATE POLICY "Users can delete their own uploads"
ON video_uploads
FOR DELETE
TO authenticated
USING (
  auth.uid()::text = user_id
);

-- Add service role bypass policy
CREATE POLICY "Service role bypass"
ON video_uploads
TO service_role
USING (true)
WITH CHECK (true);