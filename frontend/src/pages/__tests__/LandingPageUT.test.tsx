import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LandingPage from '../LandingPage';

// --- Mocks ---

const { mockGetUser, mockOnAuthStateChange } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
}));

const { mockGetStoredTheme, mockToggleTheme } = vi.hoisted(() => ({
  mockGetStoredTheme: vi.fn(),
  mockToggleTheme: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}));

vi.mock('../lib/theme', () => ({
  getStoredTheme: mockGetStoredTheme,
  toggleTheme: mockToggleTheme,
}));

vi.mock('react-router-dom', () => ({
  Link: (props: any) => <a {...props} href={props.to} />,
}));

// --- Mock Data ---
const mockUser = {
  id: '12345',
  email: 'test@example.com',
};

// --- Test Suite ---
describe('LandingPage component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStoredTheme.mockReturnValue('light');
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockToggleTheme.mockImplementation(() => {
        const newTheme = mockGetStoredTheme() === 'dark' ? 'light' : 'dark';
        mockGetStoredTheme.mockReturnValue(newTheme);
        return newTheme;
    });
  });

  const renderAndWait = async () => {
    const renderResult = render(<LandingPage />);
    await act(async () => {}); // Wait for useEffect promises
    return renderResult;
  };

  it('renders all major sections correctly', async () => {
    await renderAndWait();

    expect(screen.getByRole('heading', { name: /Project 49/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Road-User Behaviour Analysis Using AI & Computer Vision/i, level: 2 })).toBeInTheDocument();

    expect(screen.getByText('About the Project')).toBeInTheDocument();
    expect(screen.getByText('Key Objectives')).toBeInTheDocument();
    expect(screen.getByText('Technical Capabilities')).toBeInTheDocument();
    expect(screen.getByText('Our Team')).toBeInTheDocument();
    expect(screen.getByText('Project Timeline')).toBeInTheDocument();
    expect(screen.getByText(/© \d{4} Project 49. All rights reserved./i)).toBeInTheDocument();
  });

  describe('Theme handling', () => {
    it('initializes in light mode by default', async () => {
      mockGetStoredTheme.mockReturnValue('light');
      const { container } = await renderAndWait();
      expect(container.firstChild).toHaveClass('bg-neural-100');
    });

    it('initializes in dark mode if the stored theme is dark', async () => {
      mockGetStoredTheme.mockReturnValue('dark');
      const { container } = await renderAndWait();
      expect(container.firstChild).toHaveClass('bg-neural-900');
    });

    it('toggles the theme from light to dark when the button is clicked', async () => {
      const { container } = await renderAndWait();
      expect(container.firstChild).toHaveClass('bg-neural-100');

      const themeToggleButton = screen.getByRole('button', { name: /toggle theme/i });
      fireEvent.click(themeToggleButton);
      
      expect(container.firstChild).toHaveClass('bg-neural-900');
    });
  });

  describe('Authentication state', () => {
    it('shows "Sign In" and "Get Started" buttons when user is logged out', async () => {
      await renderAndWait();
      expect(screen.getAllByText('Sign In')[0]).toBeInTheDocument();
      expect(screen.getByText('Get Started')).toBeInTheDocument();
    });

    it('shows "Dashboard" buttons when user is logged in', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } });
      await renderAndWait();
      expect(screen.getAllByText('Dashboard')[0]).toBeInTheDocument();
      expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
    });
    
    it('updates auth state when onAuthStateChange is triggered', async () => {
      let authCallback: (event: string, session: any) => void = vi.fn();
      mockOnAuthStateChange.mockImplementation((callback) => {
        authCallback = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });
      
      await renderAndWait();
      expect(screen.getByText('Get Started')).toBeInTheDocument();

      await act(async () => {
        authCallback('SIGNED_IN', { user: mockUser });
      });

      expect(await screen.findByText('Go to Dashboard')).toBeInTheDocument();
    });
  });

  describe('Mobile navigation', () => {
    it('opens and closes the mobile menu', async () => {
      await renderAndWait();
      expect(screen.queryByRole('link', { name: 'GitHub' })).not.toBeInTheDocument();

      const openButton = screen.getByRole('button', { name: /open mobile menu/i });
      fireEvent.click(openButton);
      
      const mobileMenuLink = screen.getByRole('link', { name: 'GitHub' });
      expect(mobileMenuLink).toBeInTheDocument();

      const closeButton = screen.getByRole('button', { name: /close mobile menu/i });
      fireEvent.click(closeButton);

      expect(screen.queryByRole('link', { name: 'GitHub' })).not.toBeInTheDocument();
    });

    it('closes the mobile menu when a navigation link is clicked', async () => {
      await renderAndWait();

      const openButton = screen.getByRole('button', { name: /open mobile menu/i });
      fireEvent.click(openButton);
      
      // FIX: To uniquely identify the mobile menu container, find a unique
      // element within it (the "GitHub" link) and then select its parent.
      const mobileMenuGithubLink = screen.getByRole('link', { name: 'GitHub' });
      const mobileMenu = mobileMenuGithubLink.parentElement; // The div containing all mobile links
      expect(mobileMenu).toBeInTheDocument();
      
      // Now, scope the search for the "About" link to *within* the mobile menu.
      const aboutLinkInMenu = within(mobileMenu!).getByRole('link', { name: 'About' });
      fireEvent.click(aboutLinkInMenu);

      // Verify the menu is now closed because the unique "GitHub" link is gone.
      expect(screen.queryByRole('link', { name: 'GitHub' })).not.toBeInTheDocument();
    });
  });
});