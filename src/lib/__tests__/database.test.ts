import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabaseClient } from '../../test/mocks/supabase';
import { mockVideo, mockVideos, mockTrackingResult, mockVehicleCount } from '../../test/fixtures/mockData';
import {
  insertVideo,
  updateVideo,
  deleteVideo,
  getVideoById,
  getAllVideos,
  getVideosByStatus,
  insertTrackingResults,
  getTrackingResultsByVideo,
  insertVehicleCounts,
  getVehicleCountsByVideo,
  getVideoAnalytics,
  getOverallAnalytics,
} from '../database';

describe('Database Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Video Operations', () => {
    it('insertVideo should create a new video record', async () => {
      const mockReturn = { data: mockVideo, error: null };
      mockSupabaseClient.from = vi.fn(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockReturn),
      })) as any;

      const result = await insertVideo({
        video_name: mockVideo.video_name,
        original_filename: mockVideo.original_filename,
        file_size: mockVideo.file_size,
        original_url: mockVideo.original_url,
      });

      expect(result).toEqual(mockVideo);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('videos');
    });

    it('updateVideo should update video record', async () => {
      const updates = { status: 'completed' as const };
      const mockReturn = { data: { ...mockVideo, ...updates }, error: null };

      mockSupabaseClient.from = vi.fn(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockReturn),
      })) as any;

      const result = await updateVideo(mockVideo.id, updates);

      expect(result.status).toBe('completed');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('videos');
    });

    it('deleteVideo should remove video record', async () => {
      const mockReturn = { error: null };

      mockSupabaseClient.from = vi.fn(() => ({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue(mockReturn),
      })) as any;

      await expect(deleteVideo(mockVideo.id)).resolves.not.toThrow();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('videos');
    });

    it('getVideoById should return video by id', async () => {
      const mockReturn = { data: mockVideo, error: null };

      mockSupabaseClient.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockReturn),
      })) as any;

      const result = await getVideoById(mockVideo.id);

      expect(result).toEqual(mockVideo);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('videos');
    });

    it('getAllVideos should return all videos', async () => {
      const mockReturn = { data: mockVideos, error: null };

      mockSupabaseClient.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue(mockReturn),
      })) as any;

      const result = await getAllVideos();

      expect(result).toEqual(mockVideos);
      expect(result.length).toBe(mockVideos.length);
    });

    it('getVideosByStatus should filter videos by status', async () => {
      const completedVideos = mockVideos.filter(v => v.status === 'completed');
      const mockReturn = { data: completedVideos, error: null };

      mockSupabaseClient.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue(mockReturn),
      })) as any;

      const result = await getVideosByStatus('completed');

      expect(result).toEqual(completedVideos);
    });
  });

  describe('Tracking Results Operations', () => {
    it('insertTrackingResults should create tracking records', async () => {
      const mockResults = [mockTrackingResult];
      const mockReturn = { data: mockResults, error: null };

      mockSupabaseClient.from = vi.fn(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue(mockReturn),
      })) as any;

      const result = await insertTrackingResults([
        {
          video_id: mockTrackingResult.video_id,
          tracker_id: mockTrackingResult.tracker_id,
          vehicle_type: mockTrackingResult.vehicle_type,
          bbox: mockTrackingResult.bbox,
          compliance: mockTrackingResult.compliance,
          reaction_time: mockTrackingResult.reaction_time,
          time_of_detection: mockTrackingResult.time_of_detection,
        },
      ]);

      expect(result).toEqual(mockResults);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('tracking_results');
    });

    it('getTrackingResultsByVideo should return results for specific video', async () => {
      const mockResults = [mockTrackingResult];
      const mockReturn = { data: mockResults, error: null };

      mockSupabaseClient.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue(mockReturn),
      })) as any;

      const result = await getTrackingResultsByVideo(mockVideo.id);

      expect(result).toEqual(mockResults);
    });
  });

  describe('Vehicle Counts Operations', () => {
    it('insertVehicleCounts should create vehicle count records', async () => {
      const mockCounts = [mockVehicleCount];
      const mockReturn = { data: mockCounts, error: null };

      mockSupabaseClient.from = vi.fn(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue(mockReturn),
      })) as any;

      const result = await insertVehicleCounts([
        {
          video_id: mockVehicleCount.video_id,
          date: mockVehicleCount.date,
          total_vehicles: mockVehicleCount.total_vehicles,
          compliant_vehicles: mockVehicleCount.compliant_vehicles,
          non_compliant_vehicles: mockVehicleCount.non_compliant_vehicles,
        },
      ]);

      expect(result).toEqual(mockCounts);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('vehicle_counts');
    });

    it('getVehicleCountsByVideo should return counts for specific video', async () => {
      const mockCounts = [mockVehicleCount];
      const mockReturn = { data: mockCounts, error: null };

      mockSupabaseClient.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue(mockReturn),
      })) as any;

      const result = await getVehicleCountsByVideo(mockVideo.id);

      expect(result).toEqual(mockCounts);
    });
  });

  describe('Analytics Operations', () => {
    it('getVideoAnalytics should calculate analytics for a video', async () => {
      const mockTrackingResults = [
        { ...mockTrackingResult, compliance: 1, reaction_time: 2.5 },
        { ...mockTrackingResult, id: 2, compliance: 0, reaction_time: null },
      ];
      const mockVehicleCounts = [mockVehicleCount];

      mockSupabaseClient.from = vi.fn((table: string) => {
        if (table === 'tracking_results') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockTrackingResults, error: null }),
          };
        }
        if (table === 'vehicle_counts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockVehicleCounts, error: null }),
          };
        }
        return {};
      }) as any;

      const result = await getVideoAnalytics(mockVideo.id);

      expect(result.totalVehicles).toBe(2);
      expect(result.violations).toBe(1);
      expect(result.complianceRate).toBe(50);
      expect(result.avgReactionTime).toBe(2.5);
    });

    it('getOverallAnalytics should calculate overall statistics', async () => {
      mockSupabaseClient.from = vi.fn((table: string) => {
        if (table === 'videos') {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockVideos, error: null }),
          };
        }
        if (table === 'tracking_results') {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [mockTrackingResult], error: null }),
          };
        }
        if (table === 'vehicle_counts') {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [mockVehicleCount], error: null }),
          };
        }
        return {};
      }) as any;

      const result = await getOverallAnalytics();

      expect(result.totalVideos).toBe(mockVideos.length);
      expect(result.processedVideos).toBeGreaterThanOrEqual(0);
      expect(result.totalVehicles).toBeGreaterThanOrEqual(0);
    });
  });
});
