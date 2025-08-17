/*
  # Add RLS policy for Firebase users

  1. Security
    - Add RLS policy to allow Firebase users to read their own records in video_uploads table
    - Policy uses the Firebase UID stored in user_id column for access control
*/

CREATE POLICY "firebase user access"
ON video_uploads
FOR SELECT
TO public
USING (
  user_id = current_setting('request.jwt.claim.sub')::text
);