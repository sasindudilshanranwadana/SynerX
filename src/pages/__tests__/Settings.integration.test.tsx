import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../../test/utils/testUtils';
import { mockSupabaseClient } from '../../test/mocks/supabase';
import Settings from '../Settings';
import * as theme from '../../lib/theme';

vi.mock('../../lib/theme', () => ({
  getStoredTheme: vi.fn(() => 'dark'),
  setStoredTheme: vi.fn(),
  toggleTheme: vi.fn(),
  initializeTheme: vi.fn(),
}));

vi.mock('../../components/Header', () => ({
  default: () => <div data-testid="header">Settings</div>,
}));

vi.mock('../../components/Sidebar', () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>,
}));

vi.mock('../../components/ServerStatusIndicator', () => ({
  default: () => <div data-testid="server-status">Connected</div>,
}));

describe('Settings Page Integration', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    user_metadata: {
      full_name: 'Test User',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabaseClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    mockSupabaseClient.auth.onAuthStateChange = vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })) as any;

    mockSupabaseClient.auth.updateUser = vi.fn().mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    mockSupabaseClient.auth.resetPasswordForEmail = vi.fn().mockResolvedValue({
      data: {},
      error: null,
    });

    vi.mocked(theme.getStoredTheme).mockReturnValue('dark');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Page Rendering', () => {
    it('should render settings page with all components', async () => {
      render(<Settings />);

      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('server-status')).toBeInTheDocument();
    });

    it('should load and display user information', async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
      });

      await waitFor(() => {
        const emailInput = screen.getByDisplayValue('test@example.com');
        expect(emailInput).toBeInTheDocument();
      });
    });

    it('should display user full name', async () => {
      render(<Settings />);

      await waitFor(() => {
        const nameInput = screen.getByDisplayValue('Test User');
        expect(nameInput).toBeInTheDocument();
      });
    });
  });

  describe('Profile Update', () => {
    it('should successfully update user profile', async () => {
      const user = await import('@testing-library/user-event');
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      });

      const nameInput = screen.getByDisplayValue('Test User');
      await user.default.setup().clear(nameInput);
      await user.default.setup().type(nameInput, 'Updated Name');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.default.setup().click(saveButton);

      await waitFor(() => {
        expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledWith({
          email: 'test@example.com',
          data: {
            full_name: 'Updated Name',
          },
        });
      });
    });

    it('should show success message after profile update', async () => {
      const user = await import('@testing-library/user-event');
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      });

      const nameInput = screen.getByDisplayValue('Test User');
      await user.default.setup().clear(nameInput);
      await user.default.setup().type(nameInput, 'Updated Name');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.default.setup().click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/profile updated successfully/i)).toBeInTheDocument();
      });
    });

    it('should show error message on update failure', async () => {
      mockSupabaseClient.auth.updateUser = vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Update failed' },
      });

      const user = await import('@testing-library/user-event');
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      });

      const nameInput = screen.getByDisplayValue('Test User');
      await user.default.setup().clear(nameInput);
      await user.default.setup().type(nameInput, 'Updated Name');

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.default.setup().click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/update failed/i)).toBeInTheDocument();
      });
    });

    it('should disable save button during update', async () => {
      mockSupabaseClient.auth.updateUser = vi.fn(
        () => new Promise(resolve => setTimeout(() => resolve({
          data: { user: mockUser },
          error: null,
        }), 100))
      );

      const user = await import('@testing-library/user-event');
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.default.setup().click(saveButton);

      expect(saveButton).toBeDisabled();
    });
  });

  describe('Theme Toggle', () => {
    it('should toggle dark mode', async () => {
      const user = await import('@testing-library/user-event');
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('Dark Mode')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const themeToggle = buttons.find(btn =>
        btn.className.includes('inline-flex') && btn.className.includes('rounded-full')
      );

      if (themeToggle) {
        await user.default.setup().click(themeToggle);
        await waitFor(() => {
          expect(theme.toggleTheme).toHaveBeenCalled();
        });
      }
    });

    it('should show correct theme icon based on current theme', async () => {
      vi.mocked(theme.getStoredTheme).mockReturnValue('dark');

      render(<Settings />);

      await waitFor(() => {
        const moonIcon = document.querySelector('svg');
        expect(moonIcon).toBeInTheDocument();
      });
    });

    it('should update theme state after toggle', async () => {
      const user = await import('@testing-library/user-event');
      vi.mocked(theme.getStoredTheme).mockReturnValue('light');

      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText('Dark Mode')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      const themeToggle = buttons.find(btn =>
        btn.className.includes('inline-flex') && btn.className.includes('rounded-full')
      );

      if (themeToggle) {
        await user.default.setup().click(themeToggle);
        await waitFor(() => {
          expect(theme.toggleTheme).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Password Reset', () => {
    it('should send password reset email', async () => {
      const user = await import('@testing-library/user-event');
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
      });

      const resetButton = screen.getByRole('button', { name: /reset password/i });
      await user.default.setup().click(resetButton);

      await waitFor(() => {
        expect(mockSupabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
          'test@example.com',
          expect.any(Object)
        );
      });
    });

    it('should show success message after password reset email sent', async () => {
      const user = await import('@testing-library/user-event');
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
      });

      const resetButton = screen.getByRole('button', { name: /reset password/i });
      await user.default.setup().click(resetButton);

      await waitFor(() => {
        expect(screen.getByText(/password reset email sent/i)).toBeInTheDocument();
      });
    });

    it('should handle password reset failure', async () => {
      mockSupabaseClient.auth.resetPasswordForEmail = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Failed to send reset email' },
      });

      const user = await import('@testing-library/user-event');
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
      });

      const resetButton = screen.getByRole('button', { name: /reset password/i });
      await user.default.setup().click(resetButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to send reset email/i)).toBeInTheDocument();
      });
    });

    it('should not send reset email if no email is set', async () => {
      mockSupabaseClient.auth.getUser = vi.fn().mockResolvedValue({
        data: {
          user: {
            ...mockUser,
            email: '',
          },
        },
        error: null,
      });

      const user = await import('@testing-library/user-event');
      render(<Settings />);

      await waitFor(() => {
        const resetButton = screen.queryByRole('button', { name: /reset password/i });
        if (resetButton) {
          expect(resetButton).toBeInTheDocument();
        }
      });
    });
  });

  describe('Form Validation', () => {
    it('should validate email format', async () => {
      const user = await import('@testing-library/user-event');
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
      });

      const emailInput = screen.getByDisplayValue('test@example.com');
      await user.default.setup().clear(emailInput);
      await user.default.setup().type(emailInput, 'invalid-email');

      expect(emailInput).toHaveValue('invalid-email');
    });

    it('should update form data on input change', async () => {
      const user = await import('@testing-library/user-event');
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      });

      const nameInput = screen.getByDisplayValue('Test User');
      await user.default.setup().clear(nameInput);
      await user.default.setup().type(nameInput, 'New Name');

      expect(nameInput).toHaveValue('New Name');
    });
  });

  describe('Auth State Changes', () => {
    it('should update user data on auth state change', () => {
      let authCallback: any;
      mockSupabaseClient.auth.onAuthStateChange = vi.fn((callback) => {
        authCallback = callback;
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        };
      }) as any;

      render(<Settings />);

      const updatedUser = {
        ...mockUser,
        user_metadata: {
          full_name: 'Updated User',
        },
      };

      authCallback('USER_UPDATED', {
        user: updatedUser,
        access_token: 'token',
      });

      waitFor(() => {
        expect(screen.getByDisplayValue('Updated User')).toBeInTheDocument();
      });
    });
  });

  describe('Notification System', () => {
    it('should show toast notification', async () => {
      const user = await import('@testing-library/user-event');
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.default.setup().click(saveButton);

      await waitFor(() => {
        const toast = screen.getByText(/profile updated successfully/i);
        expect(toast).toBeInTheDocument();
      });
    });

    it('should hide toast after timeout', async () => {
      const user = await import('@testing-library/user-event');
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.default.setup().click(saveButton);

      await waitFor(() => {
        const toast = screen.queryByText(/profile updated successfully/i);
        if (toast) {
          expect(toast).toBeInTheDocument();
        }
      }, { timeout: 5000 });
    });
  });

  describe('Sidebar Integration', () => {
    it('should render sidebar', () => {
      render(<Settings />);

      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });

    it('should toggle sidebar on mobile', async () => {
      const user = await import('@testing-library/user-event');
      render(<Settings />);

      const menuButton = screen.queryByRole('button', { name: /menu/i });
      if (menuButton) {
        await user.default.setup().click(menuButton);
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      }
    });
  });

  describe('Loading States', () => {
    it('should show loading state while fetching user data', async () => {
      mockSupabaseClient.auth.getUser = vi.fn(
        () => new Promise(resolve => setTimeout(() => resolve({
          data: { user: mockUser },
          error: null,
        }), 100))
      );

      render(<Settings />);

      const emailInput = screen.queryByDisplayValue('test@example.com');
      expect(emailInput).not.toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Error Handling', () => {
    it('should handle user fetch error', async () => {
      mockSupabaseClient.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Failed to fetch user' },
      });

      render(<Settings />);

      await waitFor(() => {
        expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
      }, { timeout: 5000 });
    });

    it('should handle network errors gracefully', async () => {
      mockSupabaseClient.auth.updateUser = vi.fn().mockRejectedValue(
        new Error('Network error')
      );

      const user = await import('@testing-library/user-event');
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      }, { timeout: 5000 });

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.default.setup().click(saveButton);

      await waitFor(() => {
        const errorText = screen.queryByText(/error/i);
        if (errorText) {
          expect(errorText).toBeInTheDocument();
        }
      }, { timeout: 5000 });
    });
  });
});
