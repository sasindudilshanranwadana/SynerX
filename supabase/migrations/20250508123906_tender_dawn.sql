/*
  # Create video_uploads table

  1. New Tables
    - `video_uploads`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `file_name` (text)
      - `file_size` (bigint)
      - `upload_date` (timestamptz)
      - `status` (text)
      - `progress` (integer)
      - `drive_file_id` (text)
      - `drive_view_link` (text)
      - `processed_file_id` (text)
      - `error` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `video_uploads` table
    - Add policies for authenticated users to manage their own uploads
*/

CREATE TABLE IF NOT EXISTS video_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  upload_date timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('uploading', 'processing', 'completed', 'failed')),
  progress integer NOT NULL DEFAULT 0,
  drive_file_id text,
  drive_view_link text,
  processed_file_id text,
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE video_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own uploads"
  ON video_uploads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own uploads"
  ON video_uploads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own uploads"
  ON video_uploads
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_video_uploads_updated_at
  BEFORE UPDATE ON video_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();