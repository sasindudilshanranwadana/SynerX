import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Header from '../Header';

// --- Hoisted Mocks ---
// Mocks are hoisted to the top so vi.mock can access them.
const { mockGetUser, mockOnAuthStateChange, mockUnsubscribe } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockUnsubscribe: vi.fn(),
}));

const { mockGetStoredTheme } = vi.hoisted(() => ({
  mockGetStoredTheme: vi.fn(),
}));

// --- Module Mocks ---
// Mocking the entire supabase module to control its behavior in tests.
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
}));

describe('Header component', () => {
  const mockOnToggleSidebar = vi.fn();

  beforeEach(() => {
    // Clear mocks before each test to ensure a clean state.
    vi.clearAllMocks();
    
    // Default mock for getUser returns a null user.
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockGetStoredTheme.mockReturnValue('light');
    
    // --- THE FIX ---
    // Control the onAuthStateChange mock to prevent a race condition.
    // By not calling the callback, we isolate the getUser() logic for our tests,
    // ensuring its state update isn't overwritten by the auth state listener.
    mockOnAuthStateChange.mockImplementation((callback) => {
      // The component expects a return object with a subscription to unsubscribe from.
      // We provide this structure without ever invoking the callback itself.
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });
  });

  const renderHeader = (props: Partial<React.ComponentProps<typeof Header>> = {}) => {
    return render(
      <Header
        title="Test Title"
        onToggleSidebar={mockOnToggleSidebar}
        isSidebarOpen={false}
        {...props}
      />
    );
  };

  it('renders the title correctly', () => {
    renderHeader({ title: "Custom Title" });
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  it('displays the Menu icon when the sidebar is closed', () => {
    renderHeader({ isSidebarOpen: false });
    expect(screen.getByTestId('menu-icon')).toBeInTheDocument();
  });

  it('displays the X icon when the sidebar is open', () => {
    renderHeader({ isSidebarOpen: true });
    expect(screen.getByTestId('x-icon')).toBeInTheDocument();
  });

  it('calls onToggleSidebar when the button is clicked', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button'));
    expect(mockOnToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('displays a default avatar when no user is logged in', async () => {
    // The beforeEach already sets up the mock for a null user.
    renderHeader();
    
    // Assert: Wait for the component to settle.
    const avatar = await screen.findByAltText('Profile');
    expect(avatar.getAttribute('src')).toContain('https://ui-avatars.com/api/');
  });

  it('applies the dark theme class when the theme is dark', () => {
    mockGetStoredTheme.mockReturnValue('dark');
    const { container } = renderHeader();
    expect(container.firstChild).toHaveClass('bg-[#151F32]');
  });

  it('adds and removes the themeChanged event listener on mount/unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    
    const { unmount } = renderHeader();
    
    expect(addSpy).toHaveBeenCalledWith('themeChanged', expect.any(Function));
    
    unmount();
    
    expect(removeSpy).toHaveBeenCalledWith('themeChanged', expect.any(Function));
  });
});