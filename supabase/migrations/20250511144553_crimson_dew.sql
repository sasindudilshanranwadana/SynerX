/*
  # Add RLS policies for video uploads

  1. Security Changes
    - Enable RLS on video_uploads table
    - Add policies for:
      - Inserting new uploads (authenticated users only)
      - Reading own uploads
      - Updating own uploads
      - Deleting own uploads
    
  2. Changes
    - Ensures users can only access their own video uploads
    - Maintains data isolation between users
*/

-- Enable RLS
ALTER TABLE video_uploads ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own uploads
CREATE POLICY "Allow insert for authenticated users"
ON video_uploads
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()::text
);

-- Allow users to read their own uploads
CREATE POLICY "Allow read for own uploads"
ON video_uploads
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()::text
);

-- Allow users to update their own uploads
CREATE POLICY "Allow update for own uploads"
ON video_uploads
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()::text
)
WITH CHECK (
  user_id = auth.uid()::text
);

-- Allow users to delete their own uploads
CREATE POLICY "Allow delete for own uploads"
ON video_uploads
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()::text
);