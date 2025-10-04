// src/components/Navigation.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Navigation, { navItems } from './Navigation'; // import navItems for convenience
import { supabase } from '../lib/supabase';
import { getStoredTheme } from '../lib/theme';

// Mock 'react-router-dom'
// We provide a fake Link component that just renders its children.
vi.mock('react-router-dom', () => ({
  // We are replacing the Link component with a custom one for our tests.
  // It will render a simple `div` to avoid the `jsdom` navigation warning.
  Link: ({ to, children, ...props }) => (
    // It accepts all props (`className`, `onClick`, etc.) so the component works as expected.
    // The `data-to` attribute is just for easier debugging if you need it.
    <div data-to={to} {...props}>
      {children}
    </div>
  ),
}));

// Mock supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn(),
    },
  },
}));

// Mock theme
vi.mock('../lib/theme', () => ({
  getStoredTheme: vi.fn(),
}));

describe('Navigation component', () => {
  const mockOnCloseSidebar = vi.fn();
  const mockUser = {
    email: 'test@example.com',
    user_metadata: {
      full_name: 'Test User',
      avatar_url: 'http://example.com/avatar.png',
    },
  };

  beforeEach(() => {
    // Reset all mocks before each test to ensure test isolation
    vi.clearAllMocks();
    // Default mock implementation for getUser to return no user
    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: null } });
    // Default mock implementation for theme
    (getStoredTheme as any).mockReturnValue('light');
  });

  it('renders all navigation items', () => {
    render(<Navigation activePath="/" onCloseSidebar={mockOnCloseSidebar} />);
    
    // Check if every nav item's label is rendered
    navItems.forEach(item => {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    });
  });

  it('highlights the active link based on the activePath prop', () => {
    const activePath = '/dashboard';
    render(<Navigation activePath={activePath} onCloseSidebar={mockOnCloseSidebar} />);

    // The active link should have the specific active classes
    const activeLink = screen.getByText('Dashboard');
    expect(activeLink).toHaveClass('bg-primary-500/20 text-primary-500');

    // Another link should not have these classes
    const inactiveLink = screen.getByText('Home');
    expect(inactiveLink).not.toHaveClass('bg-primary-500/20 text-primary-500');
  });

  it('calls onCloseSidebar when a navigation link is clicked', () => {
    render(<Navigation activePath="/" onCloseSidebar={mockOnCloseSidebar} />);
    
    // Click on one of the links
    fireEvent.click(screen.getByText('Dashboard'));

    // Assert that our mock function was called
    expect(mockOnCloseSidebar).toHaveBeenCalledTimes(1);
  });

  it('displays user information when the user is logged in', async () => {
    // Mock getUser to return our mock user
    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: mockUser } });
    
    render(<Navigation activePath="/" onCloseSidebar={mockOnCloseSidebar} />);

    // Use `findBy` to wait for the component to update after the async getUser call
    expect(await screen.findByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    
    const avatar = screen.getByAltText('Profile') as HTMLImageElement;
    expect(avatar.src).toBe(mockUser.user_metadata.avatar_url);
  });

  it('displays default information when no user is logged in', async () => {
    render(<Navigation activePath="/" onCloseSidebar={mockOnCloseSidebar} />);

    // Check for default text
    expect(await screen.findByText('User')).toBeInTheDocument();

    // Check for default avatar from ui-avatars.com
    const avatar = screen.getByAltText('Profile') as HTMLImageElement;
    expect(avatar.src).toContain('https://ui-avatars.com/api/');
  });

  it('calls supabase.auth.signOut when the sign out button is clicked', () => {
    render(<Navigation activePath="/" onCloseSidebar={mockOnCloseSidebar} />);
    
    const signOutButton = screen.getByRole('button', { name: /Sign Out/i });
    fireEvent.click(signOutButton);
    
    // Check that the signOut function from our mocked supabase was called
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('applies dark mode classes when the theme is dark', () => {
    // Set the mock to return 'dark'
    (getStoredTheme as any).mockReturnValue('dark');
    render(<Navigation activePath="/" onCloseSidebar={mockOnCloseSidebar} />);
    
    const inactiveLink = screen.getByText('Dashboard');
    
    // Check for the specific dark mode hover class
    expect(inactiveLink).toHaveClass('hover:bg-[#1E293B]');
  });
});