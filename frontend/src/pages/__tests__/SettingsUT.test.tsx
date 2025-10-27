// Settings.test.tsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Settings from '../Settings';

// Hoisted mocks using the correct pattern
const { 
  mockUnsubscribe,
  mockSubscription,
  mockGetUser,
  mockOnAuthStateChange,
  mockUpdateUser,
  mockResetPasswordForEmail,
  mockGetSession,
  mockGetStoredTheme,
  mockToggleTheme
} = vi.hoisted(() => {
  const mockUnsubscribe = vi.fn();
  return {
    mockUnsubscribe,
    mockSubscription: { unsubscribe: mockUnsubscribe },
    mockGetUser: vi.fn(() => Promise.resolve({ 
      data: { user: { 
        id: '123', 
        email: 'user@example.com', 
        user_metadata: { full_name: 'Test User' } 
      }},
      error: null
    })),
    mockOnAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: mockUnsubscribe } }
    })),
    mockUpdateUser: vi.fn(() => Promise.resolve({ error: null })),
    mockResetPasswordForEmail: vi.fn(() => Promise.resolve({ error: null })),
    mockGetSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    mockGetStoredTheme: vi.fn(() => 'light'),
    mockToggleTheme: vi.fn((current) => current === 'light' ? 'dark' : 'light')
  };
});

// Properly hoisted module mocks
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
      updateUser: mockUpdateUser,
      resetPasswordForEmail: mockResetPasswordForEmail,
      getSession: mockGetSession
    }
  }
}));

vi.mock('../../lib/theme', () => ({
  getStoredTheme: mockGetStoredTheme,
  toggleTheme: mockToggleTheme
}));

vi.mock('../../components/Header', () => ({
  default: () => <header>Header Mock</header>
}));

vi.mock('../../components/Sidebar', () => ({
  default: () => <aside>Sidebar Mock</aside>
}));

vi.mock('../../components/ServerStatusIndicator', () => ({
  default: () => <div>Server Status Mock</div>
}));

describe('Settings Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders basic layout', async () => {
    render(<MemoryRouter><Settings /></MemoryRouter>);
    
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Header Mock')).toBeInTheDocument();
      expect(screen.getByText('Server Status Mock')).toBeInTheDocument();
    });
  });

  test('loads user data', async () => {
    render(<MemoryRouter><Settings /></MemoryRouter>);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      expect(screen.getByDisplayValue('user@example.com')).toBeInTheDocument();
    });
  });

  test('updates user profile', async () => {
    render(<MemoryRouter><Settings /></MemoryRouter>);
    
    await waitFor(() => screen.getByDisplayValue('Test User'));
    
    fireEvent.change(screen.getByDisplayValue('Test User'), { 
      target: { value: 'Updated Name' } 
    });
    fireEvent.change(screen.getByDisplayValue('user@example.com'), { 
      target: { value: 'updated@example.com' } 
    });
    
    fireEvent.click(screen.getByText('Save Changes'));
    
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        email: 'updated@example.com',
        data: { full_name: 'Updated Name' }
      });
    });
  });

  test('handles auth state changes', async () => {
    const newUser = {
      id: '456', 
      email: 'new@example.com', 
      user_metadata: { full_name: 'New User' }
    };
    
    // Listen for auth state change calls
    let authHandler: any;
    mockOnAuthStateChange.mockImplementation((handler) => {
      authHandler = handler;
      return {
        data: { subscription: { unsubscribe: mockUnsubscribe } }
      };
    });
    
    render(<MemoryRouter><Settings /></MemoryRouter>);
    
    act(() => {
      authHandler('SIGNED_IN', { user: newUser });
    });
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('New User')).toBeInTheDocument();
    });
  });

  test('cleans up subscriptions', async () => {
    const { unmount } = render(<MemoryRouter><Settings /></MemoryRouter>);
    await waitFor(() => screen.getByText('Settings'));
    unmount();
    
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  test('shows error notifications', async () => {
    mockUpdateUser.mockRejectedValueOnce(new Error('Update failed'));
    
    render(<MemoryRouter><Settings /></MemoryRouter>);
    
    await waitFor(() => screen.getByText('Save Changes'));
    fireEvent.click(screen.getByText('Save Changes'));
    
    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeInTheDocument();
    });
  });
});