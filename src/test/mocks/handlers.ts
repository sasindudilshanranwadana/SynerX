import { http, HttpResponse } from 'msw';

export const handlers = [
  // Health check endpoint
  http.get('/api/health', () => {
    return HttpResponse.json({
      message: 'SynerX API is running!',
      status: 'ok',
    });
  }),

  // Analytics endpoint
  http.get('/api/analytics', () => {
    return HttpResponse.json({
      totalVehicles: 100,
      compliantVehicles: 90,
      violations: 10,
      complianceRate: 90,
      avgReactionTime: 2.5,
      vehicleTypes: {
        car: 60,
        truck: 30,
        motorcycle: 10,
      },
      weatherConditions: {
        clear: 70,
        rain: 20,
        fog: 10,
      },
    });
  }),

  // Dashboard endpoint
  http.get('/api/dashboard', () => {
    return HttpResponse.json({
      totalVideos: 10,
      processedVideos: 8,
      totalVehicles: 500,
      violations: 50,
      complianceRate: 90,
      avgReactionTime: 2.5,
      recentActivity: [
        {
          id: '1',
          video_name: 'test-video.mp4',
          status: 'completed',
          created_at: new Date().toISOString(),
        },
      ],
    });
  }),

  // Playback endpoint
  http.get('/api/playback/videos', () => {
    return HttpResponse.json({
      videos: [
        {
          id: 'video-1',
          video_name: 'Test Video 1',
          status: 'completed',
          processed_url: 'http://example.com/processed1.mp4',
          original_url: 'http://example.com/original1.mp4',
          created_at: '2024-01-01T10:00:00Z',
        },
      ],
    });
  }),

  // Settings endpoint
  http.patch('/api/settings/profile', () => {
    return HttpResponse.json({
      success: true,
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        user_metadata: {
          full_name: 'Updated Name',
        },
      },
    });
  }),

  // Upload endpoint
  http.post('/api/upload', () => {
    return HttpResponse.json({
      success: true,
      video_id: 'video-123',
      url: 'http://example.com/uploaded-video.mp4',
    });
  }),

  // RunPod health check
  http.post('https://api.runpod.ai/v2/*/health', () => {
    return HttpResponse.json({
      message: 'SynerX API is running!',
      status: 'ok',
    });
  }),

  // RunPod processing
  http.post('https://api.runpod.ai/v2/*/runsync', () => {
    return HttpResponse.json({
      job_id: 'job-123',
      status: 'queued',
      video_id: 'video-123',
    });
  }),

  // RunPod video upload
  http.post('http://localhost:8000/video/upload', () => {
    return HttpResponse.json({
      job_id: 'job-123',
      status: 'queued',
      video_id: 'video-123',
    });
  }),

  // RunPod analysis endpoint
  http.post('http://localhost:8000/analysis', () => {
    return HttpResponse.json({
      weather_analysis: {
        clear: 70,
        rain: 20,
        fog: 10,
      },
      complianceRate: 90,
      totalVehicles: 100,
      violations: 10,
    });
  }),

  // Job management endpoints
  http.post('http://localhost:8000/jobs/clear-completed', () => {
    return HttpResponse.json({
      success: true,
      message: 'Cleared completed jobs',
    });
  }),

  http.post('http://localhost:8000/jobs/shutdown', () => {
    return HttpResponse.json({
      success: true,
      message: 'All jobs shutdown',
    });
  }),

  http.post('http://localhost:8000/jobs/shutdown/:jobId', () => {
    return HttpResponse.json({
      success: true,
      message: 'Job shutdown',
    });
  }),
];
