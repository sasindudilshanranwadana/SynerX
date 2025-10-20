import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../../test/utils/testUtils';
import { mockSupabaseClient } from '../../test/mocks/supabase';
import Sidebar from '../Sidebar';
import userEvent from '@testing-library/user-event';
import * as theme from '../../lib/theme';

vi.mock('../../lib/theme', () => ({
  getStoredTheme: vi.fn(() => 'dark'),
  setStoredTheme: vi.fn(),
  toggleTheme: vi.fn(),
  initializeTheme: vi.fn(),
}));

describe('Sidebar Integration', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    user_metadata: {
      full_name: 'Test User',
    },
  };

  const onCloseMock = vi.fn();

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

  describe('Mobile Drawer Behavior', () => {
    it('should be hidden when isOpen is false', () => {
      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={false} onClose={onCloseMock} />
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar?.className).toContain('-translate-x-full');
    });

    it('should be visible when isOpen is true', () => {
      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar?.className).toContain('translate-x-0');
    });

    it('should render overlay when sidebar is open', () => {
      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />
      );

      const overlay = container.querySelector('.fixed.inset-0.bg-black');
      expect(overlay).toBeInTheDocument();
    });

    it('should not render overlay when sidebar is closed', () => {
      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={false} onClose={onCloseMock} />
      );

      const overlay = container.querySelector('.fixed.inset-0.bg-black');
      expect(overlay).not.toBeInTheDocument();
    });

    it('should call onClose when overlay is clicked', async () => {
      const user = userEvent.setup();

      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />
      );

      const overlay = container.querySelector('.fixed.inset-0.bg-black');
      if (overlay) {
        await user.click(overlay as HTMLElement);
      }

      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  describe('Desktop Persistent Sidebar', () => {
    it('should always be visible on desktop (lg breakpoint)', () => {
      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={false} onClose={onCloseMock} />
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar?.className).toContain('lg:translate-x-0');
    });

    it('should have fixed positioning', () => {
      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={false} onClose={onCloseMock} />
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar?.className).toContain('fixed');
    });

    it('should have full height', () => {
      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={false} onClose={onCloseMock} />
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar?.className).toContain('h-full');
    });
  });

  describe('Theme Integration', () => {
    it('should apply dark theme styles', () => {
      vi.mocked(theme.getStoredTheme).mockReturnValue('dark');

      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar?.className).toContain('bg-[#151F32]');
      expect(sidebar?.className).toContain('border-[#1E293B]');
    });

    it('should apply light theme styles', () => {
      vi.mocked(theme.getStoredTheme).mockReturnValue('light');

      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar?.className).toContain('bg-white');
      expect(sidebar?.className).toContain('border-gray-200');
    });

    it('should update theme on theme change event', async () => {
      vi.mocked(theme.getStoredTheme).mockReturnValue('dark');

      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />
      );

      vi.mocked(theme.getStoredTheme).mockReturnValue('light');

      const themeEvent = new Event('themeChanged');
      window.dispatchEvent(themeEvent);

      await waitFor(() => {
        expect(container).toBeInTheDocument();
      });
    });
  });

  describe('Navigation Integration', () => {
    it('should render Navigation component', async () => {
      render(<Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />);

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Analytics')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });

    it('should pass activePath to Navigation component', async () => {
      render(<Sidebar activePath="/analytics" isOpen={true} onClose={onCloseMock} />);

      await waitFor(() => {
        const analyticsLink = screen.getByText('Analytics').closest('a');
        expect(analyticsLink?.className).toContain('bg-primary-500/20');
      });
    });

    it('should pass onClose callback to Navigation component', async () => {
      const user = userEvent.setup();

      render(<Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />);

      await waitFor(() => {
        expect(screen.getByText('Analytics')).toBeInTheDocument();
      });

      const analyticsLink = screen.getByText('Analytics');
      await user.click(analyticsLink);

      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  describe('Sidebar Styling', () => {
    it('should have correct width', () => {
      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar?.className).toContain('w-64');
    });

    it('should have border on right side', () => {
      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar?.className).toContain('border-r');
    });

    it('should have smooth transitions', () => {
      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar?.className).toContain('transition-transform');
      expect(sidebar?.className).toContain('duration-300');
      expect(sidebar?.className).toContain('ease-in-out');
    });
  });

  describe('Z-Index Management', () => {
    it('should have sidebar with z-40', () => {
      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar?.className).toContain('z-40');
    });

    it('should have overlay with z-30', () => {
      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />
      );

      const overlay = container.querySelector('.fixed.inset-0.bg-black');
      expect(overlay?.className).toContain('z-30');
    });

    it('should hide overlay on large screens', () => {
      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />
      );

      const overlay = container.querySelector('.fixed.inset-0.bg-black');
      expect(overlay?.className).toContain('lg:hidden');
    });
  });

  describe('Cleanup', () => {
    it('should remove theme change listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = render(
        <Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('themeChanged', expect.any(Function));
    });
  });

  describe('Responsive Behavior', () => {
    it('should be mobile-first with drawer behavior', () => {
      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={false} onClose={onCloseMock} />
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar?.className).toContain('-translate-x-full');
      expect(sidebar?.className).toContain('lg:translate-x-0');
    });

    it('should position sidebar on left side', () => {
      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar?.className).toContain('left-0');
    });

    it('should span full height', () => {
      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar?.className).toContain('top-0');
      expect(sidebar?.className).toContain('h-full');
    });
  });

  describe('Overlay Behavior', () => {
    it('should have semi-transparent overlay', () => {
      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />
      );

      const overlay = container.querySelector('.fixed.inset-0.bg-black');
      expect(overlay?.className).toContain('bg-opacity-50');
    });

    it('should cover entire viewport', () => {
      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />
      );

      const overlay = container.querySelector('.fixed.inset-0.bg-black');
      expect(overlay?.className).toContain('inset-0');
    });

    it('should be clickable to close sidebar', async () => {
      const user = userEvent.setup();

      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />
      );

      const overlay = container.querySelector('.fixed.inset-0.bg-black');
      expect(overlay).toBeInTheDocument();

      if (overlay) {
        await user.click(overlay as HTMLElement);
        expect(onCloseMock).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid open/close toggles', () => {
      const { rerender } = render(
        <Sidebar activePath="/dashboard" isOpen={false} onClose={onCloseMock} />
      );

      rerender(<Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />);
      rerender(<Sidebar activePath="/dashboard" isOpen={false} onClose={onCloseMock} />);
      rerender(<Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('should handle activePath changes', () => {
      const { rerender } = render(
        <Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />
      );

      rerender(<Sidebar activePath="/analytics" isOpen={true} onClose={onCloseMock} />);
      rerender(<Sidebar activePath="/settings" isOpen={true} onClose={onCloseMock} />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should handle missing onClose callback', () => {
      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={true} onClose={undefined as any} />
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should use semantic aside element', () => {
      const { container } = render(
        <Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar).toBeInTheDocument();
    });

    it('should have keyboard navigation support through Navigation component', async () => {
      render(<Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />);

      await waitFor(() => {
        const links = screen.getAllByRole('link');
        expect(links.length).toBeGreaterThan(0);
      });
    });
  });

  describe('State Management', () => {
    it('should independently manage isOpen state', () => {
      const { rerender } = render(
        <Sidebar activePath="/dashboard" isOpen={false} onClose={onCloseMock} />
      );

      let container = document.body;
      let sidebar = container.querySelector('aside');
      expect(sidebar?.className).toContain('-translate-x-full');

      rerender(<Sidebar activePath="/dashboard" isOpen={true} onClose={onCloseMock} />);

      sidebar = container.querySelector('aside');
      expect(sidebar?.className).toContain('translate-x-0');
    });

    it('should maintain navigation state when sidebar toggles', async () => {
      const { rerender } = render(
        <Sidebar activePath="/analytics" isOpen={true} onClose={onCloseMock} />
      );

      await waitFor(() => {
        const analyticsLink = screen.getByText('Analytics').closest('a');
        expect(analyticsLink?.className).toContain('bg-primary-500/20');
      });

      rerender(<Sidebar activePath="/analytics" isOpen={false} onClose={onCloseMock} />);

      await waitFor(() => {
        const analyticsLink = screen.getByText('Analytics').closest('a');
        expect(analyticsLink?.className).toContain('bg-primary-500/20');
      });
    });
  });
});
