// Database Types matching Supabase schema
export interface Video {
  id: number;
  video_name: string;
  original_filename: string;
  original_url?: string;
  processed_url?: string;
  upload_date?: string;
  file_size?: number;
  duration_seconds?: number;
  status?: 'uploaded' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
  processing_start_time?: string;
  processing_end_time?: string;
  total_vehicles?: number;
  compliance_rate?: number;
  processing_time_seconds?: number;
  message?: string;
  error?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TrackingResult {
  tracker_id: number;
  video_id: number;
  vehicle_type: string;
  status: 'moving' | 'stationary';
  compliance: 0 | 1;
  reaction_time?: number;
  weather_condition?: string;
  temperature?: number;
  humidity?: number;
  visibility?: number;
  precipitation_type?: string;
  wind_speed?: number;
  date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface VehicleCount {
  id: number;
  video_id: number;
  vehicle_type: string;
  count: number;
  date: string;
  created_at?: string;
}

export interface VideoUploadData {
  video_name: string;
  original_filename: string;
  original_url?: string;
  file_size?: number;
  duration_seconds?: number;
}

export interface TrackingResultInsert {
  video_id: number;
  vehicle_type: string;
  status: 'moving' | 'stationary';
  compliance: 0 | 1;
  reaction_time?: number;
  weather_condition?: string;
  temperature?: number;
  humidity?: number;
  visibility?: number;
  precipitation_type?: string;
  wind_speed?: number;
  date?: string;
}

export interface VehicleCountInsert {
  video_id: number;
  vehicle_type: string;
  count: number;
  date: string;
}

// Enhanced Job Management Types for Database Integration
export interface ProcessingJob {
  id: number;
  video_id: number;
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message?: string;
  processing_start_time?: string;
  processing_end_time?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProcessingJobInsert {
  video_id: number;
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  message?: string;
  processing_start_time?: string;
  processing_end_time?: string;
}

// Job Management Types
export interface Job {
  job_id: string;
  file_name: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message?: string;
  elapsed_time: number;
  created_at?: string;
  updated_at?: string;
}

export interface JobsSummary {
  total_jobs: number;
  queue_length: number;
  queue_processor_running: boolean;
}

export interface JobsResponse {
  status: string;
  summary: JobsSummary;
  all_jobs: Job[];
}

export interface StreamFrame {
  type: 'frame';
  frame_data: string; // base64 encoded image
}