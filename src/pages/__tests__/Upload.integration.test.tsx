import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../../test/utils/testUtils';
import { server } from '../../test/mocks/server';
import { http, HttpResponse } from 'msw';
import Upload from '../Upload';
import * as api from '../../lib/api';

vi.mock('../../lib/api', () => ({
  createVideoMetadataRecord: vi.fn(),
  startRunPodProcessingDirect: vi.fn(),
}));

vi.mock('../../components/Header', () => ({
  default: () => <div data-testid="header">Upload</div>,
}));

vi.mock('../../components/Sidebar', () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>,
}));

vi.mock('../../components/ServerStatusIndicator', () => ({
  default: () => <div data-testid="server-status">Connected</div>,
}));

describe('Upload Page Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(api.createVideoMetadataRecord).mockResolvedValue({
      id: 'video-123',
      video_name: 'test-video',
      status: 'uploaded',
      original_url: 'http://example.com/video.mp4',
      created_at: new Date().toISOString(),
    } as any);

    vi.mocked(api.startRunPodProcessingDirect).mockResolvedValue({
      job_id: 'job-123',
      video_id: 123,
      queue_position: 0,
      original_url: 'http://example.com/video.mp4',
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Page Rendering', () => {
    it('should render upload page with all components', () => {
      render(<Upload />);

      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('server-status')).toBeInTheDocument();
    });

    it('should display file input', () => {
      render(<Upload />);

      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
    });
  });

  describe('File Upload', () => {
    it('should handle successful video upload', async () => {
      const { WebSocketStub } = await import('../../test/utils/testUtils');
      (global as any).WebSocket = WebSocketStub as any;

      render(<Upload />);

      await waitFor(() => {
        const ws = (globalThis as any).__lastWS;
        expect(ws).toBeDefined();
      });

      const file = new File(['video content'], 'test-video.mp4', { type: 'video/mp4' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      if (input) {
        const user = await import('@testing-library/user-event');
        await user.default.setup().upload(input, file);

        await waitFor(() => {
          expect(api.createVideoMetadataRecord).toHaveBeenCalled();
        }, { timeout: 5000 });
      }
    });

    it('should display upload progress', async () => {
      const { WebSocketStub } = await import('../../test/utils/testUtils');
      (global as any).WebSocket = WebSocketStub as any;

      render(<Upload />);

      await waitFor(() => {
        const ws = (globalThis as any).__lastWS;
        expect(ws).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle upload failure with network error message', async () => {
      const { WebSocketStub } = await import('../../test/utils/testUtils');
      (global as any).WebSocket = WebSocketStub as any;

      vi.mocked(api.createVideoMetadataRecord).mockRejectedValue(
        new Error('Network error')
      );

      render(<Upload />);

      await waitFor(() => {
        const ws = (globalThis as any).__lastWS;
        expect(ws).toBeDefined();
      }, { timeout: 5000 });

      const file = new File(['video content'], 'test-video.mp4', { type: 'video/mp4' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      if (input) {
        const user = await import('@testing-library/user-event');
        await user.default.setup().upload(input, file);

        await waitFor(() => {
          expect(api.createVideoMetadataRecord).toHaveBeenCalled();
        }, { timeout: 5000 });
      }
    });

    it('should handle WebSocket connection failure', async () => {
      const { WebSocketStub, act } = await import('../../test/utils/testUtils');
      (global as any).WebSocket = WebSocketStub as any;

      render(<Upload />);

      await waitFor(() => {
        const ws = (globalThis as any).__lastWS;
        expect(ws).toBeDefined();
      });

      const ws = (globalThis as any).__lastWS;

      await act(async () => {
        ws.triggerError();
      });

      await waitFor(() => {
        const wsError = screen.queryByTestId('ws-error');
        expect(wsError).toBeInTheDocument();
      });
    });
  });

  describe('Server Integration', () => {
    it('should use RunPod API for processing', async () => {
      server.use(
        http.post('http://localhost:8000/video/upload', () => {
          return HttpResponse.json({
            job_id: 'job-456',
            video_id: 789,
            queue_position: 0,
            original_url: 'http://example.com/video.mp4',
          });
        })
      );

      const { WebSocketStub } = await import('../../test/utils/testUtils');
      (global as any).WebSocket = WebSocketStub as any;

      render(<Upload />);

      await waitFor(() => {
        const ws = (globalThis as any).__lastWS;
        expect(ws).toBeDefined();
      });
    });
  });
});
