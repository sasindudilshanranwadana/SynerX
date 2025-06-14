-- Add model_type column to video_uploads table
ALTER TABLE video_uploads 
ADD COLUMN model_type text CHECK (model_type IN ('plate', 'vehicle'));