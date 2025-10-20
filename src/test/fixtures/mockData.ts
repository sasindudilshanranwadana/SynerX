import { Video, TrackingResult, VehicleCount, ProcessingJob } from '../../lib/types';

export const mockVideo: Video = {
  id: 1,
  video_name: 'test-video',
  original_filename: 'test-video.mp4',
  file_size: 1024000,
  duration_seconds: 120,
  original_url: 'https://example.com/videos/test-video.mp4',
  processed_url: 'https://example.com/videos/test-video-processed.mp4',
  status: 'completed',
  total_vehicles: 100,
  compliance_rate: 90,
  processing_time_seconds: 60,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockVideos: Video[] = [
  mockVideo,
  {
    ...mockVideo,
    id: 2,
    video_name: 'test-video-2',
    original_filename: 'test-video-2.mp4',
    status: 'processing',
  },
  {
    ...mockVideo,
    id: 3,
    video_name: 'test-video-3',
    original_filename: 'test-video-3.mp4',
    status: 'uploaded',
  },
];

export const mockTrackingResult: TrackingResult = {
  tracker_id: 101,
  video_id: 1,
  vehicle_type: 'car',
  status: 'moving',
  compliance: 1,
  reaction_time: 2.5,
  weather_condition: 'clear',
  temperature: 25,
  humidity: 60,
  visibility: 10,
  date: new Date().toISOString().split('T')[0],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockTrackingResults: TrackingResult[] = [
  mockTrackingResult,
  {
    ...mockTrackingResult,
    tracker_id: 102,
    vehicle_type: 'truck',
    compliance: 0,
    reaction_time: undefined,
  },
  {
    ...mockTrackingResult,
    tracker_id: 103,
    vehicle_type: 'motorcycle',
    compliance: 1,
    reaction_time: 1.8,
  },
];

export const mockVehicleCount: VehicleCount = {
  id: 1,
  video_id: 1,
  vehicle_type: 'car',
  count: 10,
  date: new Date().toISOString().split('T')[0],
  created_at: new Date().toISOString(),
};

export const mockVehicleCounts: VehicleCount[] = [
  mockVehicleCount,
  {
    ...mockVehicleCount,
    id: 2,
    video_id: 2,
    vehicle_type: 'truck',
    count: 5,
  },
  {
    ...mockVehicleCount,
    id: 3,
    video_id: 1,
    vehicle_type: 'motorcycle',
    count: 3,
  },
];

export const mockProcessingJob: ProcessingJob = {
  id: 1,
  job_id: 'job-123',
  video_id: 1,
  status: 'completed',
  progress: 100,
  message: 'Processing completed successfully',
  processing_start_time: new Date(Date.now() - 60000).toISOString(),
  processing_end_time: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockProcessingJobs: ProcessingJob[] = [
  mockProcessingJob,
  {
    ...mockProcessingJob,
    id: 2,
    job_id: 'job-456',
    video_id: 2,
    status: 'processing',
    progress: 65,
    message: 'Processing video...',
    processing_end_time: undefined,
  },
  {
    ...mockProcessingJob,
    id: 3,
    job_id: 'job-789',
    video_id: 3,
    status: 'queued',
    progress: 0,
    message: 'Waiting in queue',
    processing_start_time: undefined,
    processing_end_time: undefined,
  },
];
