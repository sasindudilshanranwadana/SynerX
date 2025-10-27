import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import Navigation, { navItems } from '../Navigation'; // Corrected import path

// --- Hoisted Mocks ---
const { mockGetUser, mockOnAuthStateChange, mockSignOut, mockUnsubscribe } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockSignOut: vi.fn(),
  mockUnsubscribe: vi.fn(),
}));

const { mockGetStoredTheme } = vi.hoisted(() => ({
  mockGetStoredTheme: vi.fn(),
}));

// --- Module Mocks ---
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <div data-to={to} {...props}>{children}</div>
  ),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSignOut,
    },
  },
}));

vi.mock('../../lib/theme', () => ({
  getStoredTheme: mockGetStoredTheme,
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
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockGetStoredTheme.mockReturnValue('light');
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });
  });

  const renderNav = (props: Partial<React.ComponentProps<typeof Navigation>>) => {
    render(<Navigation activePath="/" onCloseSidebar={mockOnCloseSidebar} {...props} />);
  };

  it('renders all navigation items', () => {
    renderNav({});
    navItems.forEach(item => {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    });
  });

  it('highlights the active link based on the activePath prop', () => {
    renderNav({ activePath: '/dashboard' });
    const activeLink = screen.getByText('Dashboard');
    expect(activeLink).toHaveClass('bg-primary-500/20');
    const inactiveLink = screen.getByText('Home');
    expect(inactiveLink).not.toHaveClass('bg-primary-500/20');
  });

  it('calls onCloseSidebar when a navigation link is clicked', () => {
    renderNav({});
    fireEvent.click(screen.getByText('Dashboard'));
    expect(mockOnCloseSidebar).toHaveBeenCalledTimes(1);
  });

  it('displays user information when the user is logged in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    renderNav({});
    
    await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
        const avatar = screen.getByAltText('Profile') as HTMLImageElement;
        expect(avatar.src).toBe(mockUser.user_metadata.avatar_url);
    });
  });

  it('displays default information when no user is logged in', async () => {
    renderNav({});
    expect(await screen.findByText('User')).toBeInTheDocument();
    const avatar = screen.getByAltText('Profile') as HTMLImageElement;
    expect(avatar.src).toContain('https://ui-avatars.com/api/');
  });

  it('calls supabase.auth.signOut when the sign out button is clicked', () => {
    renderNav({});
    const signOutButton = screen.getByRole('button', { name: /Sign Out/i });
    fireEvent.click(signOutButton);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('applies dark mode classes when the theme is dark', () => {
    mockGetStoredTheme.mockReturnValue('dark');
    renderNav({});
    const inactiveLink = screen.getByText('Dashboard');
    expect(inactiveLink).toHaveClass('hover:bg-[#1E293B]');
  });
});