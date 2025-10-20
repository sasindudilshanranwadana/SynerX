import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../test/utils/testUtils';
import '../test/mocks/supabase';
import { mockSupabaseClient } from '../test/mocks/supabase';
import App from '../App';

vi.mock('../lib/theme', () => ({
  initializeTheme: vi.fn(),
  getStoredTheme: vi.fn(() => 'dark'),
  setStoredTheme: vi.fn(),
}));

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading screen initially', () => {
    render(<App />, { withRouter: false });

    const loadingText = screen.getByText('Loading...');
    expect(loadingText).toBeInTheDocument();
  });

  it('renders landing page when no user is authenticated', async () => {
    mockSupabaseClient.auth.getSession = vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    });

    render(<App />, { withRouter: false });

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
  });

  it('initializes theme on mount', async () => {
    const { initializeTheme } = await import('../lib/theme');

    render(<App />, { withRouter: false });

    await waitFor(() => {
      expect(initializeTheme).toHaveBeenCalled();
    });
  });

  it('subscribes to auth state changes', async () => {
    render(<App />, { withRouter: false });

    await waitFor(() => {
      expect(mockSupabaseClient.auth.onAuthStateChange).toHaveBeenCalled();
    });
  });

  it('unsubscribes from auth changes on unmount', async () => {
    const unsubscribeMock = vi.fn();
    mockSupabaseClient.auth.onAuthStateChange = vi.fn(() => ({
      data: {
        subscription: {
          unsubscribe: unsubscribeMock,
        },
      },
    }));

    const { unmount } = render(<App />, { withRouter: false });

    unmount();

    await waitFor(() => {
      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });

  it('handles session retrieval errors gracefully', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockSupabaseClient.auth.getSession = vi.fn().mockResolvedValue({
      data: { session: null },
      error: { message: 'Session error' },
    });

    render(<App />, { withRouter: false });

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    consoleWarnSpy.mockRestore();
  });
});
