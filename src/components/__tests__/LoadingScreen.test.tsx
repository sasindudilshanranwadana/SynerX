import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/utils/testUtils';
import LoadingScreen from '../LoadingScreen';

describe('LoadingScreen Component', () => {
  it('renders loading screen with spinner', () => {
    render(<LoadingScreen />, { withRouter: false });

    const loadingText = screen.getByText('Loading...');
    expect(loadingText).toBeInTheDocument();
  });

  it('applies correct CSS classes for full screen layout', () => {
    const { container } = render(<LoadingScreen />, { withRouter: false });

    const mainDiv = container.firstChild as HTMLElement;
    expect(mainDiv).toHaveClass('fixed');
    expect(mainDiv).toHaveClass('inset-0');
    expect(mainDiv).toHaveClass('flex');
    expect(mainDiv).toHaveClass('items-center');
    expect(mainDiv).toHaveClass('justify-center');
  });

  it('displays loading animation elements', () => {
    const { container } = render(<LoadingScreen />, { withRouter: false });

    const animatedElements = container.querySelectorAll('.animate-ping, .animate-pulse');
    expect(animatedElements.length).toBeGreaterThan(0);
  });
});
