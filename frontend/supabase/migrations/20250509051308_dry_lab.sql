/*
  # Recreate video_uploads table with proper RLS policies

  1. Changes
    - Drop existing video_uploads table
    - Recreate video_uploads table with same schema
    - Add appropriate RLS policies
    
  2. Security
    - Enable RLS on video_uploads table
    - Add policies for:
      - Insert: Authenticated users can insert their own uploads
      - Select: Users can view their own uploads
      - Update: Users can update their own uploads
      - Delete: Users can delete their own uploads
    - All policies are scoped to the user's own records
*/

-- Drop existing table
DROP TABLE IF EXISTS video_uploads;

-- Recreate table with same schema
CREATE TABLE video_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  upload_date timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  progress integer NOT NULL DEFAULT 0,
  drive_file_id text,
  drive_view_link text,
  processed_file_id text,
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT video_uploads_status_check CHECK (status = ANY (ARRAY['uploading'::text, 'processing'::text, 'completed'::text, 'failed'::text]))
);

-- Enable RLS
ALTER TABLE video_uploads ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER update_video_uploads_updated_at 
  BEFORE UPDATE ON video_uploads 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
CREATE POLICY "Users can insert their own uploads"
  ON video_uploads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can view their own uploads"
  ON video_uploads
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own uploads"
  ON video_uploads
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own uploads"
  ON video_uploads
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);