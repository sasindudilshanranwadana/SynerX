import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import Dashboard from './Dashboard';

import { getStoredTheme } from '../lib/theme';

// --- Mocks ---

const { mockGetUser, mockSignOut, mockSupabaseSelect } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockSignOut: vi.fn(),
  mockSupabaseSelect: vi.fn(),
}));

const mockGetOverallAnalytics = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut,
    },
    from: vi.fn(() => ({
      select: mockSupabaseSelect,
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
  },
}));

vi.mock('../lib/database', () => ({
  getOverallAnalytics: mockGetOverallAnalytics,
}));

vi.mock('../lib/theme', () => ({
  getStoredTheme: vi.fn(() => 'dark'),
}));

vi.mock('react-router-dom', () => ({
  Link: (props: any) => <a {...props} href={props.to} />,
}));

vi.mock('../components/ServerStatusIndicator', () => ({
  default: () => <div data-testid="server-status-indicator" />,
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

// --- Mock Data ---

const mockUser = {
  email: 'test@example.com',
  user_metadata: { full_name: 'Test User', avatar_url: 'http://example.com/avatar.png' },
};

const mockBackendStats = {
  videosProcessed: 100,
  violations: 10,
  complianceRate: 90.0,
  avgReactionTime: 1.23,
};

const mockBackendActivity = [
  { event: 'Backend event 1', time: '1 minute ago', type: 'success' },
];

const mockDbAnalytics = {
  processedVideos: 50,
  violations: 5,
  complianceRate: 95.0,
  avgReactionTime: 2.34,
};

const mockDbVideos = [
  { video_id: 1, video_name: 'db-video-1.mp4', created_at: new Date().toISOString() },
];

// --- Test Suite ---

describe('Dashboard component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const runAsyncEffects = async () => {
    await act(async () => {
      await vi.runAllTimersAsync();
    });
  };

  it('renders loading skeletons initially', () => {
    render(<Dashboard />);
    expect(screen.getAllByRole('status', { name: /loading/i })).toHaveLength(4);
    expect(screen.getByText('Loading recent activity...')).toBeInTheDocument();
  });

  describe('Data Loading Scenarios', () => {
    it('loads and displays data successfully from the backend', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) }) // System Status
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ activities: mockBackendActivity }) }) // Recent Activity
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ stats: mockBackendStats }) }); // Analytics

      mockSupabaseSelect.mockResolvedValue({ data: [], error: null }); // DB health check

      render(<Dashboard />);
      await runAsyncEffects();

      // Check stats
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('90.0%')).toBeInTheDocument();
      expect(screen.getByText('1.23s')).toBeInTheDocument();

      // Check system status
      const operationalStatuses = screen.getAllByText('Operational');
      expect(operationalStatuses).toHaveLength(3);

      // Check recent activity
      expect(screen.getByText('Backend event 1')).toBeInTheDocument();
      expect(mockGetOverallAnalytics).not.toHaveBeenCalled();
    });

    it('falls back to database if backend fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Backend down')); // All fetch calls will fail
      mockSupabaseSelect
        .mockResolvedValueOnce({ data: [], error: null }) // DB health check (succeeds)
        .mockResolvedValueOnce({ data: mockDbVideos, error: null }); // DB recent activity
      mockGetOverallAnalytics.mockResolvedValue(mockDbAnalytics);

      render(<Dashboard />);
      await runAsyncEffects();

      // Check stats from DB
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('95.0%')).toBeInTheDocument();
      expect(screen.getByText('2.34s')).toBeInTheDocument();

      // Check system status (DB sync is up, others are down)
      expect(screen.getAllByText('Down')).toHaveLength(2);
      expect(screen.getByText('Operational')).toBeInTheDocument();

      // Check recent activity from DB
      expect(screen.getByText(/New video uploaded: db-video-1.mp4/i)).toBeInTheDocument();
    });

    it('shows error state if all data sources fail', async () => {
      mockFetch.mockRejectedValue(new Error('Backend down'));
      mockSupabaseSelect.mockResolvedValue({ data: null, error: new Error('DB down') });
      mockGetOverallAnalytics.mockRejectedValue(new Error('DB analytics down'));

      render(<Dashboard />);
      await runAsyncEffects();

      // Check stats are zero
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('0.0%')).toBeInTheDocument();
      expect(screen.getByText('0.00s')).toBeInTheDocument();

      // Check system status is all down
      expect(screen.getAllByText('Down')).toHaveLength(3);

      // Check recent activity error message
      expect(screen.getByText('Unable to load recent activity')).toBeInTheDocument();
    });
  });

  describe('User Info and Interaction', () => {
    it('displays user information correctly', async () => {
      render(<Dashboard />);
      await runAsyncEffects();

      expect(screen.getByText('Welcome back, Test')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      const avatars = screen.getAllByAltText('Profile');
      expect(avatars[0]).toHaveAttribute('src', mockUser.user_metadata.avatar_url);
    });

    it('handles user sign out', async () => {
      render(<Dashboard />);
      await runAsyncEffects();

      const signOutButton = screen.getByRole('button', { name: /Sign Out/i });
      fireEvent.click(signOutButton);

      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it('toggles sidebar on mobile view', async () => {
      render(<Dashboard />);
      await runAsyncEffects();

      const sidebar = screen.getByRole('complementary'); // <aside>
      expect(sidebar).toHaveClass('-translate-x-full');

      const menuButton = screen.getByRole('button', { name: /open menu/i });
      fireEvent.click(menuButton);

      expect(sidebar).not.toHaveClass('-translate-x-full');
      expect(sidebar).toHaveClass('translate-x-0');

      const closeButton = screen.getByRole('button', { name: /close menu/i });
      fireEvent.click(closeButton);
      expect(sidebar).toHaveClass('-translate-x-full');
    });
  });

  describe('Periodic Refresh and Theme', () => {
    it('refreshes data periodically', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      mockSupabaseSelect.mockResolvedValue({ data: [], error: null });

      render(<Dashboard />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1); // Initial load
      });
      expect(mockFetch).toHaveBeenCalledTimes(3); // status, activity, analytics

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000); // Advance by interval
      });

      expect(mockFetch).toHaveBeenCalledTimes(6); // Called again
    });

    it('updates theme when themeChanged event is fired', () => {
      (getStoredTheme as Mock).mockReturnValue('light');
      const { container } = render(<Dashboard />);
      expect(container.firstChild).toHaveClass('bg-gray-50');

      (getStoredTheme as Mock).mockReturnValue('dark');
      act(() => {
        window.dispatchEvent(new CustomEvent('themeChanged'));
      });

      expect(container.firstChild).toHaveClass('bg-[#0B1121]');
    });
  });
});