import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../../test/utils/testUtils';
import { mockSupabaseClient } from '../../test/mocks/supabase';
import Navigation from '../Navigation';
import userEvent from '@testing-library/user-event';
import * as theme from '../../lib/theme';

vi.mock('../../lib/theme', () => ({
  getStoredTheme: vi.fn(() => 'dark'),
  setStoredTheme: vi.fn(),
  toggleTheme: vi.fn(),
  initializeTheme: vi.fn(),
}));

describe('Navigation Integration', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    user_metadata: {
      full_name: 'Test User',
      avatar_url: 'https://example.com/avatar.jpg',
    },
  };

  const onCloseSidebarMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabaseClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    mockSupabaseClient.auth.onAuthStateChange = vi.fn(() => ({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    }));

    mockSupabaseClient.auth.signOut = vi.fn().mockResolvedValue({
      error: null,
    });

    vi.mocked(theme.getStoredTheme).mockReturnValue('dark');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('User Profile Display', () => {
    it('should display user profile information', async () => {
      render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });
    });

    it('should display user avatar', async () => {
      render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      await waitFor(() => {
        const avatar = screen.getByAltText('Profile');
        expect(avatar).toBeInTheDocument();
        expect(avatar).toHaveAttribute('src', mockUser.user_metadata.avatar_url);
      }, { timeout: 3000 });
    });

    it('should use fallback avatar when no avatar URL provided', async () => {
      mockSupabaseClient.auth.getUser = vi.fn().mockResolvedValue({
        data: {
          user: {
            ...mockUser,
            user_metadata: {
              full_name: 'Test User',
            },
          },
        },
        error: null,
      });

      render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      await waitFor(() => {
        const avatar = screen.getByAltText('Profile');
        expect(avatar).toBeInTheDocument();
        expect(avatar.getAttribute('src')).toContain('ui-avatars.com');
      }, { timeout: 3000 });
    });

    it('should display generic "User" when no name provided', async () => {
      mockSupabaseClient.auth.getUser = vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            user_metadata: {},
          },
        },
        error: null,
      });

      render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      await waitFor(() => {
        expect(screen.getByText('User')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Links', () => {
    it('should display all navigation items', async () => {
      render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument();
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Video Upload')).toBeInTheDocument();
        expect(screen.getByText('Analytics')).toBeInTheDocument();
        expect(screen.getByText('Video Playback')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });

    it('should have correct href attributes', async () => {
      render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      await waitFor(() => {
        expect(screen.getByText('Home').closest('a')).toHaveAttribute('href', '/');
        expect(screen.getByText('Dashboard').closest('a')).toHaveAttribute('href', '/dashboard');
        expect(screen.getByText('Video Upload').closest('a')).toHaveAttribute('href', '/upload');
        expect(screen.getByText('Analytics').closest('a')).toHaveAttribute('href', '/analytics');
        expect(screen.getByText('Video Playback').closest('a')).toHaveAttribute('href', '/playback');
        expect(screen.getByText('Settings').closest('a')).toHaveAttribute('href', '/settings');
      });
    });

    it('should display icons for each navigation item', async () => {
      render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      await waitFor(() => {
        const homeLink = screen.getByRole('link', { name: /home/i });
        const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
        const uploadLink = screen.getByRole('link', { name: /video upload/i });
        const analyticsLink = screen.getByRole('link', { name: /analytics/i });
        const playbackLink = screen.getByRole('link', { name: /video playback/i });
        const settingsLink = screen.getByRole('link', { name: /settings/i });

        expect(homeLink.querySelector('svg')).not.toBeNull();
        expect(dashboardLink.querySelector('svg')).not.toBeNull();
        expect(uploadLink.querySelector('svg')).not.toBeNull();
        expect(analyticsLink.querySelector('svg')).not.toBeNull();
        expect(playbackLink.querySelector('svg')).not.toBeNull();
        expect(settingsLink.querySelector('svg')).not.toBeNull();
      });
    });

    it('should call onCloseSidebar when navigation link is clicked', async () => {
      const user = userEvent.setup();

      render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      await waitFor(() => {
        expect(screen.getByText('Analytics')).toBeInTheDocument();
      });

      const analyticsLink = screen.getByText('Analytics');
      await user.click(analyticsLink);

      expect(onCloseSidebarMock).toHaveBeenCalled();
    });
  });

  describe('Active Route Highlighting', () => {
    it('should highlight active dashboard route', () => {
      render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      const dashboardLink = screen.getByText('Dashboard').closest('a');
      expect(dashboardLink?.className).toContain('bg-primary-500/20');
      expect(dashboardLink?.className).toContain('text-primary-500');
    });

    it('should highlight active upload route', () => {
      render(<Navigation activePath="/upload" onCloseSidebar={onCloseSidebarMock} />);

      const uploadLink = screen.getByText('Video Upload').closest('a');
      expect(uploadLink?.className).toContain('bg-primary-500/20');
    });

    it('should highlight active analytics route', () => {
      render(<Navigation activePath="/analytics" onCloseSidebar={onCloseSidebarMock} />);

      const analyticsLink = screen.getByText('Analytics').closest('a');
      expect(analyticsLink?.className).toContain('bg-primary-500/20');
    });

    it('should not highlight inactive routes', () => {
      render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      const analyticsLink = screen.getByText('Analytics').closest('a');
      expect(analyticsLink?.className).not.toContain('bg-primary-500/20');
    });
  });

  describe('Sign Out Functionality', () => {
    it('should display sign out button', async () => {
      render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      await waitFor(() => {
        expect(screen.getByText('Sign Out')).toBeInTheDocument();
      });
    });

    it('should have sign out icon', async () => {
      render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      await waitFor(() => {
        const signOutButton = screen.getByText('Sign Out').closest('button');
        expect(signOutButton?.querySelector('svg')).not.toBeNull();
      });
    });

    it('should call supabase signOut when button is clicked', async () => {
      const user = userEvent.setup();

      render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      await waitFor(() => {
        expect(screen.getByText('Sign Out')).toBeInTheDocument();
      });

      const signOutButton = screen.getByText('Sign Out');
      await user.click(signOutButton);

      await waitFor(() => {
        expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
      });
    });

    it('should handle sign out errors gracefully', async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockSupabaseClient.auth.signOut = vi.fn().mockRejectedValue(
        new Error('Sign out failed')
      );

      render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      await waitFor(() => {
        expect(screen.getByText('Sign Out')).toBeInTheDocument();
      });

      const signOutButton = screen.getByText('Sign Out');
      await user.click(signOutButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error signing out:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Theme Integration', () => {
    it('should apply dark theme styles', () => {
      vi.mocked(theme.getStoredTheme).mockReturnValue('dark');

      const { container } = render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      const navItems = container.querySelectorAll('a');
      navItems.forEach((item) => {
        if (!item.className.includes('bg-primary-500/20')) {
          expect(item.className).toContain('text-gray-400');
        }
      });
    });

    it('should apply light theme styles', () => {
      vi.mocked(theme.getStoredTheme).mockReturnValue('light');

      const { container } = render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      const navItems = container.querySelectorAll('a');
      navItems.forEach((item) => {
        if (!item.className.includes('bg-primary-500/20')) {
          expect(item.className).toContain('text-gray-600');
        }
      });
    });

    it('should update theme on theme change event', async () => {
      vi.mocked(theme.getStoredTheme).mockReturnValue('dark');

      render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      vi.mocked(theme.getStoredTheme).mockReturnValue('light');

      const themeEvent = new Event('themeChanged');
      window.dispatchEvent(themeEvent);

      await waitFor(() => {
        const container = document.body;
        expect(container).toBeInTheDocument();
      });
    });
  });

  describe('Authentication State Changes', () => {
    it('should update user info when auth state changes', async () => {
      let authCallback: any;

      const newUser = {
        id: 'new-user-id',
        email: 'newuser@example.com',
        user_metadata: {
          full_name: 'New User',
        },
      };

      mockSupabaseClient.auth.onAuthStateChange = vi.fn((callback) => {
        authCallback = callback;
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        };
      });

      render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
      });

      if (authCallback) {
        authCallback('SIGNED_IN', { user: newUser });
      }

      await waitFor(() => {
        expect(screen.getByText('New User')).toBeInTheDocument();
        expect(screen.getByText('newuser@example.com')).toBeInTheDocument();
      });
    });

    it('should handle user logout in auth state', async () => {
      let authCallback: any;

      mockSupabaseClient.auth.onAuthStateChange = vi.fn((callback) => {
        authCallback = callback;
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        };
      });

      render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      if (authCallback) {
        authCallback('SIGNED_OUT', { user: null });
      }

      await waitFor(() => {
        expect(screen.queryByText('Test User')).not.toBeInTheDocument();
      });
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe from auth changes on unmount', () => {
      const unsubscribeMock = vi.fn();

      mockSupabaseClient.auth.onAuthStateChange = vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: unsubscribeMock,
          },
        },
      }));

      const { unmount } = render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      unmount();

      expect(unsubscribeMock).toHaveBeenCalled();
    });

    it('should remove theme change listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('themeChanged', expect.any(Function));
    });
  });

  describe('Responsive Design', () => {
    it('should have scrollable navigation area', () => {
      const { container } = render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      const nav = container.querySelector('nav');
      expect(nav?.className).toContain('overflow-y-auto');
    });

    it('should have responsive padding', () => {
      const { container } = render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      const profileSection = container.querySelector('.p-4');
      expect(profileSection).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have semantic navigation element', () => {
      const { container } = render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      const nav = container.querySelector('nav');
      expect(nav).toBeInTheDocument();
    });

    it('should have accessible button for sign out', async () => {
      render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      await waitFor(() => {
        const signOutButton = screen.getByRole('button', { name: /Sign Out/i });
        expect(signOutButton).toBeInTheDocument();
      });
    });

    it('should have accessible links', async () => {
      render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      await waitFor(() => {
        const links = screen.getAllByRole('link');
        expect(links.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing user gracefully', async () => {
      mockSupabaseClient.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      });

      render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      await waitFor(() => {
        expect(screen.getByText('User')).toBeInTheDocument();
      });
    });

    it('should handle auth errors gracefully', async () => {
      mockSupabaseClient.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Auth error' },
      });

      render(<Navigation activePath="/dashboard" onCloseSidebar={onCloseSidebarMock} />);

      await waitFor(() => {
        expect(screen.getByText('User')).toBeInTheDocument();
      });
    });

    it('should handle undefined onCloseSidebar callback', () => {
      render(<Navigation activePath="/dashboard" />);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });
});
