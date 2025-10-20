/*
  # Create processing jobs table for job management

  1. New Tables
    - `processing_jobs`
      - `id` (bigint, primary key, auto-increment)
      - `video_id` (integer, foreign key to videos table)
      - `job_id` (text, unique identifier from external processing service)
      - `status` (text, processing status with constraints)
      - `progress` (integer, processing progress 0-100)
      - `message` (text, optional status message)
      - `processing_start_time` (timestamptz, when processing started)
      - `processing_end_time` (timestamptz, when processing completed)
      - `created_at` (timestamptz, record creation time)
      - `updated_at` (timestamptz, last update time)

  2. Security
    - Enable RLS on `processing_jobs` table
    - Add policies for public access (matching existing pattern)

  3. Indexes
    - Index on video_id for efficient lookups
    - Index on job_id for external service integration
    - Index on status for filtering
    - Index on created_at for sorting

  4. Constraints
    - Foreign key constraint to videos table
    - Check constraint for valid status values
    - Check constraint for progress range (0-100)
    - Unique constraint on job_id
</*/

-- Create processing_jobs table
CREATE TABLE IF NOT EXISTS processing_jobs (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  video_id integer NOT NULL,
  job_id text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  progress integer DEFAULT 0,
  message text,
  processing_start_time timestamptz,
  processing_end_time timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add foreign key constraint
ALTER TABLE processing_jobs 
ADD CONSTRAINT processing_jobs_video_id_fkey 
FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE;

-- Add check constraints
ALTER TABLE processing_jobs 
ADD CONSTRAINT processing_jobs_status_check 
CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled'));

ALTER TABLE processing_jobs 
ADD CONSTRAINT processing_jobs_progress_check 
CHECK (progress >= 0 AND progress <= 100);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_processing_jobs_video_id ON processing_jobs(video_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_job_id ON processing_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at ON processing_jobs(created_at);

-- Enable Row Level Security
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (matching existing pattern for public access)
CREATE POLICY "Allow public read access to processing_jobs"
  ON processing_jobs
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to processing_jobs"
  ON processing_jobs
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to processing_jobs"
  ON processing_jobs
  FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Allow public delete access to processing_jobs"
  ON processing_jobs
  FOR DELETE
  TO public
  USING (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_processing_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_processing_jobs_updated_at
  BEFORE UPDATE ON processing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_processing_jobs_updated_at();