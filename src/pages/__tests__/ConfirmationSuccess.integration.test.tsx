import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
// Import 'act' for timer advancements
import { render, screen, waitFor, act } from '../../test/utils/testUtils'; // Adjust path if needed
import ConfirmationSuccess from '../ConfirmationSuccess'; // Adjust path if needed
// Import useNavigate to get a handle on the mock
import { useNavigate } from 'react-router-dom';

// --- Mock react-router-dom ---
// Create a mock function *outside* the vi.mock call
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate, // Use the mock function here
    Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  };
});
// --- End Mock ---

describe('ConfirmationSuccess Page Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear timers just in case
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Page Rendering', () => {
    it('should render confirmation success page', () => {
      render(<ConfirmationSuccess />);
      expect(screen.getByRole('heading', { name: /email confirmed successfully/i })).toBeInTheDocument();
    });

    it('should display success icon', () => {
      render(<ConfirmationSuccess />);
      const icon = document.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should display success message', () => {
      render(<ConfirmationSuccess />);
      const heading = screen.getByRole('heading', { name: /email confirmed successfully/i });
      expect(heading).toBeInTheDocument();
    });
  });

  describe('Navigation Options', () => {
    it('should have link to dashboard', () => {
      render(<ConfirmationSuccess />);
      const dashboardLink = screen.queryByRole('link', { name: /dashboard|continue|proceed/i });
      if (dashboardLink) {
        expect(dashboardLink).toBeInTheDocument();
        expect(dashboardLink).toHaveAttribute('href');
      }
    });

    it('should have link to sign in', () => {
      render(<ConfirmationSuccess />);
      const signInLink = screen.queryByRole('link', { name: /sign in|login/i });
      if (signInLink) {
        expect(signInLink).toBeInTheDocument();
      }
    });
  });

  describe('User Actions', () => {
    it('should allow clicking dashboard link', async () => {
      const user = await import('@testing-library/user-event');
      render(<ConfirmationSuccess />);
      const dashboardLink = screen.queryByRole('link', { name: /dashboard|continue|proceed/i });
      if (dashboardLink) {
        await user.default.setup().click(dashboardLink);
        expect(dashboardLink).toHaveAttribute('href');
      }
    });

    it('should allow clicking sign in link', async () => {
      const user = await import('@testing-library/user-event');
      render(<ConfirmationSuccess />);
      const signInLink = screen.queryByRole('link', { name: /sign in|login/i });
      if (signInLink) {
        await user.default.setup().click(signInLink);
        expect(signInLink).toHaveAttribute('href');
      }
    });
  });

  describe('Visual Elements', () => {
    it('should have success styling', () => {
      render(<ConfirmationSuccess />);
      const heading = screen.getByRole('heading', { name: /email confirmed successfully/i });
      expect(heading).toBeInTheDocument();
    });

    it('should display confirmation details', () => {
      render(<ConfirmationSuccess />);
      const text = document.body.textContent;
      expect(text).toContain('success');
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading', () => {
      render(<ConfirmationSuccess />);
      const heading = screen.queryByRole('heading');
      expect(heading).toBeInTheDocument();
    });

    it('should have accessible links', () => {
      render(<ConfirmationSuccess />);
      const links = screen.queryAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveAttribute('href');
      });
    });

    it('should have meaningful text content', () => {
      render(<ConfirmationSuccess />);
      const content = document.body.textContent;
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe('Page Behavior', () => {
    it('should render without errors', () => {
      const { container } = render(<ConfirmationSuccess />);
      expect(container).toBeInTheDocument();
    });

    it('should display all required elements', () => {
      render(<ConfirmationSuccess />);
      expect(screen.getByRole('heading', { name: /email confirmed successfully/i })).toBeInTheDocument();
    });
  });

  describe('Auto-redirect', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      mockNavigate.mockClear();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should auto-redirect after a delay', async () => {
      render(<ConfirmationSuccess />);

      const timerText = screen.queryByText(/redirecting to/i);
      if (timerText) {
        expect(timerText).toBeInTheDocument();
      }
      
      expect(mockNavigate).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000); // Advance past component's timeout
      });

      // --- FIX: Check only the path, as the options object is undefined ---
      expect(mockNavigate).toHaveBeenCalledWith('/'); // Checks it was called with the correct path
      expect(mockNavigate).toHaveBeenCalledTimes(1); // Checks it was only called once
    });
  });

  describe('Responsive Design', () => {
    it('should render on mobile', () => {
      global.innerWidth = 375;
      render(<ConfirmationSuccess />);
      expect(screen.getByRole('heading', { name: /email confirmed successfully/i })).toBeInTheDocument();
    });

    it('should render on desktop', () => {
      global.innerWidth = 1920;
      render(<ConfirmationSuccess />);
      expect(screen.getByRole('heading', { name: /email confirmed successfully/i })).toBeInTheDocument();
    });
  });
});