import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import Dashboard from './Dashboard';

import { getStoredTheme } from '../lib/theme';

// --- Mocks ---

const { mockGetUser, mockSignOut, mockSupabaseSelect, mockGetOverallAnalytics } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockSignOut: vi.fn(),
  mockSupabaseSelect: vi.fn(),
  mockGetOverallAnalytics: vi.fn(),
}));

// FIX: Create a fully chainable mock for Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut,
    },
    from: vi.fn(() => ({
      select: mockSupabaseSelect,
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
  const mockSetInterval = vi.fn();
  const mockClearInterval = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Set up all mocks before any tests run
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockGetOverallAnalytics.mockResolvedValue(mockDbAnalytics);
    
    // Make the select mock chainable by default
    mockSupabaseSelect.mockImplementation(() => ({
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockDbVideos, error: null }),
    }));
    
    // Provide a robust fetch mock implementation
    mockFetch.mockImplementation((url) => {
      const urlString = url.toString();
      const response = {
        ok: true,
        status: 200,
        json: async () => ({
          activities: urlString.includes('/recent-activity') ? [] : undefined,
          stats: urlString.includes('/analysis/complete') ? {} : undefined,
          status: urlString.endsWith('/') ? 'operational' : undefined
        })
      };
      return Promise.resolve(response);
    });

    // Mock timers
    vi.stubGlobal('setInterval', mockSetInterval);
    vi.stubGlobal('clearInterval', mockClearInterval);
    
    // Wait for any initial async operations
    await Promise.resolve();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const runAsyncEffects = async () => {
    await act(async () => {
      // Run any pending promise callbacks
      await Promise.resolve();
      // Run any timers that were scheduled
      await vi.runAllTimersAsync();
      // Run any remaining promise callbacks
      await Promise.resolve();
    });
  };

  // No changes needed for this test, it should pass now.
  it('renders loading skeletons initially', async () => {
    render(<Dashboard />);
    expect(screen.getAllByTestId('loading-skeleton')).toHaveLength(4);
    expect(screen.getByText('Loading recent activity...')).toBeInTheDocument();
  });

  describe('Data Loading Scenarios', () => {
    it('loads and displays data successfully from the backend', async () => {
      // Use a more complete mock implementation
      mockFetch.mockImplementation((url) => {
        const urlString = url.toString();
        if (urlString.includes('/recent-activity')) {
          return Promise.resolve({ 
            ok: true, 
            json: () => Promise.resolve({ activities: mockBackendActivity }) 
          });
        }
        if (urlString.includes('/analysis/complete')) {
          return Promise.resolve({ 
            ok: true, 
            json: () => Promise.resolve({ stats: mockBackendStats }) 
          });
        }
        // Root endpoint for system status
        if (urlString.endsWith('/')) {
          return Promise.resolve({ 
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'operational' }) 
          });
        }
        return Promise.reject(new Error('Invalid endpoint'));
      });

      // DB connection check inside loadSystemStatus will succeed
      // Ensure select(...) returns an object with a limit method so the chain
      // supabase.from(...).select(...).limit(1) works as expected.
      mockSupabaseSelect.mockImplementation(() => ({
        limit: vi.fn().mockResolvedValue({ data: [], error: null })
      }));

      render(<Dashboard />);
      await runAsyncEffects();

      // Assert backend stats
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      
      // Assert all systems are operational
      expect(screen.getAllByText('Operational')).toHaveLength(3);
      
      // Assert backend activity
      expect(screen.getByText('Backend event 1')).toBeInTheDocument();
    });

    it('falls back to database if backend fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Backend down'));
      // Ensure the chained Supabase call for recent activity returns data
      mockSupabaseSelect.mockImplementation(() => ({
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockDbVideos, error: null }),
      }));
      mockGetOverallAnalytics.mockResolvedValue(mockDbAnalytics);

      render(<Dashboard />);
      await runAsyncEffects();

      // Assert DB stats
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();

      // Assert system status is all down
      expect(screen.getAllByText('Down')).toHaveLength(3);

      // Assert DB activity
      expect(screen.getByText(/New video uploaded: db-video-1.mp4/i)).toBeInTheDocument();
    });

    // No changes needed for this test
    it('shows error state if all data sources fail', async () => {
      mockFetch.mockRejectedValue(new Error('Backend down'));
      mockSupabaseSelect.mockResolvedValue({ data: null, error: new Error('DB down') });
      mockGetOverallAnalytics.mockRejectedValue(new Error('DB analytics down'));

      render(<Dashboard />);
      await runAsyncEffects();

      // Check stats are zero
      const processedCard = screen.getByText('Videos Processed').closest('div');
      const violationsCard = screen.getByText('Violations Detected').closest('div');
      
      expect(within(processedCard!).getByText('0')).toBeInTheDocument();
      expect(within(violationsCard!).getByText('0')).toBeInTheDocument();
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

      // Find the mobile header, then the button inside it.
      const mobileHeader = sidebar.previousElementSibling as HTMLElement;
      const menuButton = within(mobileHeader).getByRole('button');
      
      fireEvent.click(menuButton);

      expect(sidebar).not.toHaveClass('-translate-x-full');
      expect(sidebar).toHaveClass('translate-x-0');

      // The same button now acts as the close button.
      fireEvent.click(menuButton);
      expect(sidebar).toHaveClass('-translate-x-full');
    });
  });

  describe('Periodic Refresh and Theme', () => {
    it('refreshes data periodically', async () => {
      let intervalCallback: () => void = () => {};
      mockSetInterval.mockImplementation((callback) => {
        intervalCallback = callback;
        return 123;
      });

      render(<Dashboard />);
      await runAsyncEffects(); // Initial load
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Manually trigger the captured interval callback
      await act(async () => {
        intervalCallback();
      });
      await runAsyncEffects(); // Let the new data load

      expect(mockFetch).toHaveBeenCalledTimes(6);
    });

    // No changes needed for this test
    it('updates theme when themeChanged event is fired', async () => {
      (getStoredTheme as Mock).mockReturnValue('light');
      const { container } = render(<Dashboard />);
      await runAsyncEffects();
      expect(container.firstChild).toHaveClass('bg-gray-50');

      (getStoredTheme as Mock).mockReturnValue('dark');
      act(() => {
        window.dispatchEvent(new CustomEvent('themeChanged'));
      });

      expect(container.firstChild).toHaveClass('bg-[#0B1121]');
    });
  });
});