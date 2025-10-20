import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../test/utils/testUtils';
import '../../test/mocks/supabase';
import Header from '../Header';

describe('Header Component', () => {
  const mockOnToggleSidebar = vi.fn();

  beforeEach(() => {
    mockOnToggleSidebar.mockClear();
    vi.clearAllMocks();
  });

  it('renders the title prop correctly', () => {
    render(
      <Header
        title="Test Page"
        onToggleSidebar={mockOnToggleSidebar}
        isSidebarOpen={false}
      />
    );

    expect(screen.getByText('Test Page')).toBeInTheDocument();
  });

  it('shows menu icon when sidebar is closed', () => {
    render(
      <Header
        title="Test Page"
        onToggleSidebar={mockOnToggleSidebar}
        isSidebarOpen={false}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('calls onToggleSidebar when menu button is clicked', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();

    render(
      <Header
        title="Test Page"
        onToggleSidebar={mockOnToggleSidebar}
        isSidebarOpen={false}
      />
    );

    const button = screen.getByRole('button');
    await user.click(button);

    expect(mockOnToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('displays user avatar image', () => {
    render(
      <Header
        title="Test Page"
        onToggleSidebar={mockOnToggleSidebar}
        isSidebarOpen={false}
      />
    );

    const avatar = screen.getByAltText('Profile');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('src');
  });

  it('applies correct CSS classes for mobile visibility', () => {
    const { container } = render(
      <Header
        title="Test Page"
        onToggleSidebar={mockOnToggleSidebar}
        isSidebarOpen={false}
      />
    );

    const headerDiv = container.firstChild as HTMLElement;
    expect(headerDiv).toHaveClass('lg:hidden');
    expect(headerDiv).toHaveClass('fixed');
  });
});
