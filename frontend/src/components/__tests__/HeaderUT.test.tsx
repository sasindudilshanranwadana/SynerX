// src/components/Header.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Header from './Header';
import { supabase } from '../lib/supabase';
import { getStoredTheme } from '../lib/theme';

// Mock the dependencies
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
    },
  },
}));

vi.mock('../lib/theme', () => ({
  getStoredTheme: vi.fn(),
}));

describe('Header component', () => {
  const mockOnToggleSidebar = vi.fn();

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  it('renders the title correctly', () => {
    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: null } });
    render(
      <Header
        title="Test Title"
        onToggleSidebar={mockOnToggleSidebar}
        isSidebarOpen={false}
      />
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('displays the Menu icon when the sidebar is closed', () => {
    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: null } });
    render(
      <Header
        title="Test Title"
        onToggleSidebar={mockOnToggleSidebar}
        isSidebarOpen={false}
      />
    );
    expect(screen.getByTestId('menu-icon')).toBeInTheDocument();
  });

  it('displays the X icon when the sidebar is open', () => {
    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: null } });
    render(
      <Header
        title="Test Title"
        onToggleSidebar={mockOnToggleSidebar}
        isSidebarOpen={true}
      />
    );
    expect(screen.getByTestId('x-icon')).toBeInTheDocument();
  });

  it('calls onToggleSidebar when the button is clicked', () => {
    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: null } });
    render(
      <Header
        title="Test Title"
        onToggleSidebar={mockOnToggleSidebar}
        isSidebarOpen={false}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(mockOnToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('displays the user avatar when a user is logged in', async () => {
    const mockUser = {
      email: 'test@example.com',
      user_metadata: {
        avatar_url: 'http://example.com/avatar.png',
      },
    };
    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: mockUser } });

    render(
      <Header
        title="Test Title"
        onToggleSidebar={mockOnToggleSidebar}
        isSidebarOpen={false}
      />
    );

    // Use findByAltText to wait for the user state to update
    const avatar = await screen.findByAltText('Profile');
    expect(avatar).toHaveAttribute('src', mockUser.user_metadata.avatar_url);
  });

  it('displays a default avatar when no user is logged in', async () => {
    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: null } });
    render(
      <Header
        title="Test Title"
        onToggleSidebar={mockOnToggleSidebar}
        isSidebarOpen={false}
      />
    );
    const avatar = await screen.findByAltText('Profile');
    expect(avatar.getAttribute('src')).toContain('https://ui-avatars.com/api/');
  });

  it('applies the dark theme class when the theme is dark', () => {
    (getStoredTheme as any).mockReturnValue('dark');
    (supabase.auth.getUser as any).mockResolvedValue({ data: { user: null } });

    const { container } = render(
      <Header
        title="Test Title"
        onToggleSidebar={mockOnToggleSidebar}
        isSidebarOpen={false}
      />
    );

    expect(container.firstChild).toHaveClass('bg-[#151F32]');
  });

  it('adds and removes the themeChanged event listener', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(
      <Header
        title="Test Title"
        onToggleSidebar={mockOnToggleSidebar}
        isSidebarOpen={false}
      />
    );

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'themeChanged',
      expect.any(Function)
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'themeChanged',
      expect.any(Function)
    );
  });
});