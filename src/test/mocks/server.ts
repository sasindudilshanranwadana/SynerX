import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Health check endpoint
  http.post('http://localhost:8000/health', () => {
    return HttpResponse.json({
      message: 'SynerX API is running!',
      status: 'connected',
    });
  }),

  // Video upload endpoint
  http.post('http://localhost:8000/video/upload', () => {
    return HttpResponse.json({
      job_id: 'test-job-123',
      video_id: 456,
      queue_position: 0,
      original_url: 'https://example.com/video.mp4',
    });
  }),

  // RunPod job management endpoints
  http.post('http://localhost:8000/jobs/clear-completed', () => {
    return HttpResponse.json({ success: true, cleared: 5 });
  }),

  http.post('http://localhost:8000/jobs/shutdown', () => {
    return HttpResponse.json({ success: true, shutdown: 3 });
  }),

  http.post('http://localhost:8000/jobs/shutdown/:jobId', ({ params }) => {
    return HttpResponse.json({
      success: true,
      job_id: params.jobId,
    });
  }),

  // RunPod analysis endpoint
  http.post('http://localhost:8000/analysis', () => {
    return HttpResponse.json({
      weather_analysis: {},
      basic_correlations: {},
      recommendations: [],
      complianceRate: 0.93,
      findings: [],
      summary: 'Analysis complete',
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
      items: [
        {
          id: 1,
          timestamp: new Date().toISOString(),
          vehicleType: 'car',
          compliant: true,
        },
      ],
    });
  }),
];

export const server = setupServer(...handlers);
