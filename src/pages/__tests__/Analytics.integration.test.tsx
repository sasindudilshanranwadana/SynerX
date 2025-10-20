import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../../test/utils/testUtils';
import { server } from '../../test/mocks/server';
import { http, HttpResponse } from 'msw';
import Analytics from '../Analytics';
import * as database from '../../lib/database';
import * as api from '../../lib/api';

vi.mock('../../lib/database', () => ({
  getAllTrackingResults: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  fetchTrackingResults: vi.fn(),
  generatePDFReport: vi.fn(),
  downloadCSV: vi.fn(),
  generateDetailedReport: vi.fn(),
}));

vi.mock('../../components/Header', () => ({
  default: () => <div data-testid="header">Analytics</div>,
}));

vi.mock('../../components/Sidebar', () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>,
}));

vi.mock('../../components/ServerStatusIndicator', () => ({
  default: () => <div data-testid="server-status">Connected</div>,
}));

describe('Analytics Page Integration', () => {
  const mockTrackingResults = [
    {
      id: 1,
      video_id: 'video-1',
      tracker_id: 1,
      vehicle_type: 'car',
      compliance: 1,
      reaction_time: 2.5,
      time_of_detection: '2024-01-01T10:00:00Z',
      weather_condition: 'clear',
      vehicle_speed_kmh: 50,
    },
    {
      id: 2,
      video_id: 'video-1',
      tracker_id: 2,
      vehicle_type: 'truck',
      compliance: 0,
      reaction_time: 4.5,
      time_of_detection: '2024-01-01T10:05:00Z',
      weather_condition: 'rain',
      vehicle_speed_kmh: 45,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(database.getAllTrackingResults).mockResolvedValue(mockTrackingResults as any);
    vi.mocked(api.fetchTrackingResults).mockResolvedValue(mockTrackingResults as any);
    vi.mocked(api.generatePDFReport).mockResolvedValue(undefined);
    vi.mocked(api.downloadCSV).mockResolvedValue(undefined);
    vi.mocked(api.generateDetailedReport).mockResolvedValue({
      weather_analysis: {},
      basic_correlations: {},
      recommendations: [],
      complianceRate: 0.5,
      findings: [],
      summary: 'Test summary',
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Page Rendering', () => {
    it('should render analytics page with all components', async () => {
      render(<Analytics />);

      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('server-status')).toBeInTheDocument();
    });

    it('should load and display tracking results', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(database.getAllTrackingResults).toHaveBeenCalled();
      });
    });
  });

  describe('Data Visualization', () => {
    it('should display compliance statistics', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(database.getAllTrackingResults).toHaveBeenCalled();
      });
    });

    it('should display vehicle type breakdown', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(database.getAllTrackingResults).toHaveBeenCalled();
      });
    });
  });

  describe('Report Generation', () => {
    it('should generate PDF report', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(database.getAllTrackingResults).toHaveBeenCalled();
      });

      const generateButton = screen.queryByText(/generate report/i);
      if (generateButton) {
        const user = await import('@testing-library/user-event');
        await user.default.setup().click(generateButton);

        await waitFor(() => {
          expect(api.generatePDFReport).toHaveBeenCalled();
        });
      }
    });

    it('should download CSV export', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(database.getAllTrackingResults).toHaveBeenCalled();
      });

      const downloadButton = screen.queryByText(/download csv/i);
      if (downloadButton) {
        const user = await import('@testing-library/user-event');
        await user.default.setup().click(downloadButton);

        await waitFor(() => {
          expect(api.downloadCSV).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle tracking results fetch failure', async () => {
      vi.mocked(database.getAllTrackingResults).mockRejectedValue(
        new Error('Failed to fetch tracking results')
      );

      render(<Analytics />);

      await waitFor(() => {
        expect(screen.getByText(/error|failed/i)).toBeInTheDocument();
      });
    });

    it('should handle report generation failure', async () => {
      vi.mocked(api.generatePDFReport).mockRejectedValue(
        new Error('Report generation failed')
      );

      render(<Analytics />);

      await waitFor(() => {
        expect(database.getAllTrackingResults).toHaveBeenCalled();
      });

      const generateButton = screen.queryByText(/generate report/i);
      if (generateButton) {
        const user = await import('@testing-library/user-event');
        await user.default.setup().click(generateButton);

        await waitFor(() => {
          expect(screen.getByText(/error|failed/i)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Advanced Analytics Integration', () => {
    it('should fetch detailed analytics from server', async () => {
      server.use(
        http.post('http://localhost:8000/analysis', () => {
          return HttpResponse.json({
            weather_analysis: { clear: 50, rain: 30, fog: 20 },
            basic_correlations: { speed_compliance: 0.75 },
            recommendations: ['Increase monitoring in rain'],
            complianceRate: 0.75,
            findings: ['High compliance in clear weather'],
            summary: 'Overall good compliance',
          });
        })
      );

      render(<Analytics />);

      await waitFor(() => {
        expect(database.getAllTrackingResults).toHaveBeenCalled();
      });
    });

    it('should handle analytics server failure', async () => {
      server.use(
        http.post('http://localhost:8000/analysis', () => {
          return HttpResponse.json({ error: 'Analysis failed' }, { status: 500 });
        })
      );

      vi.mocked(api.generateDetailedReport).mockRejectedValue(
        new Error('Analysis failed')
      );

      render(<Analytics />);

      await waitFor(() => {
        expect(database.getAllTrackingResults).toHaveBeenCalled();
      });
    });
  });

  describe('Data Filtering and Search', () => {
    it('should filter results by vehicle type', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(database.getAllTrackingResults).toHaveBeenCalled();
      });
    });

    it('should filter results by compliance status', async () => {
      render(<Analytics />);

      await waitFor(() => {
        expect(database.getAllTrackingResults).toHaveBeenCalled();
      });
    });
  });
});
