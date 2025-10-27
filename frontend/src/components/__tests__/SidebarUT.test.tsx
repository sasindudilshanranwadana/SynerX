// src/components/Sidebar.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Sidebar from '../Sidebar';
import { getStoredTheme } from '../../lib/theme';

// Mock the child Navigation component
// We can check that it receives the correct props from Sidebar.
const MockedNavigation = vi.fn();
vi.mock('../Navigation', () => ({
  default: (props: any) => {
    // This makes the mock function callable and allows us to inspect its calls
    MockedNavigation(props);
    // Render a placeholder
    return <div data-testid="mock-navigation" />;
  },
}));

// Mock the theme function
vi.mock('../../lib/theme', () => ({
  getStoredTheme: vi.fn(),
}));

describe('Sidebar component', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    (getStoredTheme as any).mockReturnValue('light'); // Default to light theme
  });

  it('renders the Navigation component and passes the correct props', () => {
    render(<Sidebar activePath="/dashboard" isOpen={true} onClose={mockOnClose} />);
    
    // Check that our mocked Navigation was rendered
    expect(screen.getByTestId('mock-navigation')).toBeInTheDocument();

    // Check that Navigation received the correct props from Sidebar
    expect(MockedNavigation).toHaveBeenCalledWith({
      activePath: '/dashboard',
      onCloseSidebar: mockOnClose,
    });
  });

  it('is visible and has the correct class when isOpen is true', () => {
    // The `render` function returns the base element of the rendered content
    const { container } = render(<Sidebar activePath="/" isOpen={true} onClose={mockOnClose} />);

    // The first child of the container should be the <aside> element
    const asideElement = container.firstChild;
    
    // Check for the class that makes it visible
    expect(asideElement).toHaveClass('translate-x-0');

    // Also check that the overlay is rendered
    expect(screen.getByRole('dialog', { hidden: true })).toBeInTheDocument();
  });

  it('is hidden and has the correct class when isOpen is false', () => {
    const { container } = render(<Sidebar activePath="/" isOpen={false} onClose={mockOnClose} />);

    const asideElement = container.firstChild;
    
    // Check for the class that hides it off-screen
    expect(asideElement).toHaveClass('-translate-x-full');

    // Use `queryBy` to assert that the overlay is NOT in the document
    expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument();
  });

  it('calls the onClose function when the overlay is clicked', () => {
    render(<Sidebar activePath="/" isOpen={true} onClose={mockOnClose} />);

    // Find the overlay. We can add a role to it for easier selection.
    const overlay = screen.getByRole('dialog', { hidden: true });

    // Simulate a user click
    fireEvent.click(overlay);

    // Assert that our mock function was called
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('applies dark mode classes when the theme is dark', () => {
    (getStoredTheme as any).mockReturnValue('dark');
    const { container } = render(<Sidebar activePath="/" isOpen={true} onClose={mockOnClose} />);
    
    const asideElement = container.firstChild;
    
    // Check for the dark mode background and border classes
    expect(asideElement).toHaveClass('bg-[#151F32] border-[#1E293B]');
  });
});