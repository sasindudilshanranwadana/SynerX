import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Settings from './Settings';

// --- Hoisted Mocks ---
const { mockGetUser, mockOnAuthStateChange, mockUpdateUser, mockResetPasswordForEmail } = vi.hoisted(() => {
  const getUser = vi.fn().mockResolvedValue({
    data: { 
      user: {
        id: '123',
        email: 'test@example.com',
        user_metadata: { full_name: 'Test User' }
      }
    }
  });
  
  const onAuthStateChange = vi.fn().mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } }
  });
  
  const updateUser = vi.fn().mockResolvedValue({ error: null });
  const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
  
  return {
    mockGetUser: getUser,
    mockOnAuthStateChange: onAuthStateChange,
    mockUpdateUser: updateUser,
    mockResetPasswordForEmail: resetPasswordForEmail
  };
});

const { mockGetStoredTheme, mockToggleTheme } = vi.hoisted(() => {
  const getStoredTheme = vi.fn().mockReturnValue('light');
  const toggleTheme = vi.fn().mockReturnValue('dark');
  
  return {
    mockGetStoredTheme: getStoredTheme,
    mockToggleTheme: toggleTheme
  };
});

// --- Module Mocks ---
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
      updateUser: mockUpdateUser,
      resetPasswordForEmail: mockResetPasswordForEmail
    }
  }
}));

vi.mock('../lib/theme', () => ({
  getStoredTheme: mockGetStoredTheme,
  toggleTheme: mockToggleTheme
}));

vi.mock('../components/Header', () => ({ 
  default: ({ title, onToggleSidebar }: any) => (
    <header data-testid="header">
      <h1 data-testid="header-title">{title}</h1>
      <button onClick={onToggleSidebar}>Toggle Sidebar</button>
    </header>
  )
}));

vi.mock('../components/Sidebar', () => ({ 
  default: ({ activePath, isOpen, onClose }: any) => (
    <aside data-testid="sidebar" data-open={isOpen} data-active={activePath}>
      <button onClick={onClose}>Close</button>
    </aside>
  )
}));

vi.mock('../components/ServerStatusIndicator', () => ({ 
  default: () => <div data-testid="server-status">Server Status</div>
}));

// --- Test Data ---
const mockUser = {
  id: '123',
  email: 'test@example.com',
  user_metadata: { full_name: 'Test User' }
};

describe('Settings Component', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    
    // Reset default mock implementations
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    });
    mockUpdateUser.mockResolvedValue({ error: null });
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    mockGetStoredTheme.mockReturnValue('light');
    mockToggleTheme.mockReturnValue('dark');
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('renders initial layout and loads user data', async () => {
    render(<Settings />);
    
    // Check if header is rendered
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('header-title')).toHaveTextContent('Settings');
    
    // Check if sidebar is rendered
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    
    // Check if server status is rendered
    expect(screen.getByTestId('server-status')).toBeInTheDocument();
    
    // Wait for user data to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
    });
    
    // Verify getUser was called
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });

  it('updates user profile when form is submitted', async () => {
    render(<Settings />);
    
    // Wait for user data to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    });
    
    // Update form fields
    const displayNameInput = screen.getByDisplayValue('Test User');
    const emailInput = screen.getByDisplayValue('test@example.com');
    
    await act(async () => {
      fireEvent.change(displayNameInput, { target: { value: 'Updated Name' } });
      fireEvent.change(emailInput, { target: { value: 'updated@example.com' } });
    });
    
    // Submit form
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    });
    
    // Verify updateUser was called with correct data
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        email: 'updated@example.com',
        data: { full_name: 'Updated Name' }
      });
    });
    
    // Check for success notification
    await waitFor(() => {
      expect(screen.getByText('Profile updated successfully')).toBeInTheDocument();
    });
  });

  it('displays error notification when profile update fails', async () => {
    // Mock updateUser to return an error
    mockUpdateUser.mockResolvedValue({ error: { message: 'Update failed' } });
    
    render(<Settings />);
    
    // Wait for user data to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    });
    
    // Submit form
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    });
    
    // Check for error notification
    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeInTheDocument();
    });
  });

  it('toggles theme when dark mode button is clicked', async () => {
    render(<Settings />);
    
    // Find and click the theme toggle button
    const themeToggle = screen.getByRole('button', { name: '' }); // The button doesn't have text, just a visual toggle
    
    await act(async () => {
      fireEvent.click(themeToggle);
    });
    
    // Verify toggleTheme was called
    expect(mockToggleTheme).toHaveBeenCalledWith('light');
  });

  it('sends password reset email when reset button is clicked', async () => {
    render(<Settings />);
    
    // Wait for user data to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
    });
    
    // Click the reset password button
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reset password/i }));
    });
    
    // Verify resetPasswordForEmail was called
    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        { redirectTo: `${window.location.origin}/auth` }
      );
    });
    
    // Check for success notification
    await waitFor(() => {
      expect(screen.getByText('Password reset email sent successfully')).toBeInTheDocument();
    });
  });

  it('displays error when trying to reset password without email', async () => {
    render(<Settings />);
    
    // Wait for user data to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
    });
    
    // Clear the email field
    await act(async () => {
      fireEvent.change(screen.getByDisplayValue('test@example.com'), { target: { value: '' } });
    });
    
    // Click the reset password button
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reset password/i }));
    });
    
    // Check for error notification
    await waitFor(() => {
      expect(screen.getByText('Please enter your email address first')).toBeInTheDocument();
    });
    
    // Verify resetPasswordForEmail was NOT called
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('displays error notification when password reset fails', async () => {
    // Mock resetPasswordForEmail to return an error
    mockResetPasswordForEmail.mockResolvedValue({ error: { message: 'Reset failed' } });
    
    render(<Settings />);
    
    // Wait for user data to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
    });
    
    // Click the reset password button
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reset password/i }));
    });
    
    // Check for error notification
    await waitFor(() => {
      expect(screen.getByText('Reset failed')).toBeInTheDocument();
    });
  });

  it('shows loading state when saving profile', async () => {
    // Mock updateUser to take longer
    mockUpdateUser.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ error: null }), 100)));
    
    render(<Settings />);
    
    // Wait for user data to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    });
    
    // Get the save button before clicking it
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    
    // Submit form
    await act(async () => {
      fireEvent.click(saveButton);
    });
    
    // Check for loading state - the button text changes to "Saving..."
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    
    // Fast-forward timers
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    // Check for success notification
    await waitFor(() => {
      expect(screen.getByText('Profile updated successfully')).toBeInTheDocument();
    });
  });

  it('shows loading state when resetting password', async () => {
    // Mock resetPasswordForEmail to take longer
    mockResetPasswordForEmail.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ error: null }), 100)));
    
    render(<Settings />);
    
    // Wait for user data to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
    });
    
    // Get the reset button before clicking it
    const resetButton = screen.getByRole('button', { name: /reset password/i });
    
    // Click the reset password button
    await act(async () => {
      fireEvent.click(resetButton);
    });
    
    // Check for loading state - the button text changes to "Sending..."
    expect(screen.getByText('Sending...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled();
    
    // Fast-forward timers
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    // Check for success notification
    await waitFor(() => {
      expect(screen.getByText('Password reset email sent successfully')).toBeInTheDocument();
    });
  });

  it('toggles sidebar when header button is clicked', async () => {
    render(<Settings />);
    
    // Click the toggle sidebar button in header
    await act(async () => {
      fireEvent.click(screen.getByText('Toggle Sidebar'));
    });
    
    // Check if sidebar is now open
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'true');
  });

  it('closes sidebar when close button is clicked', async () => {
    render(<Settings />);
    
    // First open the sidebar
    await act(async () => {
      fireEvent.click(screen.getByText('Toggle Sidebar'));
    });
    
    // Then close it
    await act(async () => {
      fireEvent.click(screen.getByText('Close'));
    });
    
    // Check if sidebar is now closed
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'false');
  });

  it('handles auth state change', async () => {
    render(<Settings />);
    
    // Wait for initial user data to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    });
    
    // Get the onAuthStateChange callback
    const authCallback = mockOnAuthStateChange.mock.calls[0][0];
    
    // Simulate auth state change with new user
    const newUser = {
      id: '456',
      email: 'newuser@example.com',
      user_metadata: { full_name: 'New User' }
    };
    
    await act(async () => {
      authCallback('SIGNED_IN', { user: newUser });
    });
    
    // Check if form fields are updated with new user data
    await waitFor(() => {
      expect(screen.getByDisplayValue('New User')).toBeInTheDocument();
      expect(screen.getByDisplayValue('newuser@example.com')).toBeInTheDocument();
    });
  });

  it('displays toast notification and auto-hides after timeout', async () => {
    render(<Settings />);
    
    // Wait for user data to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    });
    
    // Submit form to trigger notification
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    });
    
    // Check for notification
    await waitFor(() => {
      expect(screen.getByText('Profile updated successfully')).toBeInTheDocument();
    });
    
    // Fast-forward timers to trigger auto-hide
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    
    // Check if notification is hidden
    expect(screen.queryByText('Profile updated successfully')).not.toBeInTheDocument();
  });
});