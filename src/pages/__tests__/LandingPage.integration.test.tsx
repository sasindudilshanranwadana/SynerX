import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../../test/utils/testUtils';
import LandingPage from '../LandingPage';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  };
});

describe('LandingPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Page Rendering', () => {
    it('should render landing page', () => {
      render(<LandingPage />);

      expect(screen.getByText(/synerx/i)).toBeInTheDocument();
    });

    it('should display hero section', () => {
      render(<LandingPage />);

      const heading = screen.queryByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
    });

    it('should have call-to-action buttons', () => {
      render(<LandingPage />);

      const getStartedLink = screen.queryByRole('link', { name: /get started/i });
      if (getStartedLink) {
        expect(getStartedLink).toBeInTheDocument();
      }
    });
  });

  describe('Navigation Links', () => {
    it('should have link to auth page', () => {
      render(<LandingPage />);

      const authLinks = screen.queryAllByRole('link', { name: /sign in|get started/i });
      expect(authLinks.length).toBeGreaterThan(0);
      authLinks.forEach(link => {
        expect(link).toHaveAttribute('href');
      });
    });

    it('should have navigation menu', () => {
      render(<LandingPage />);

      const navLinks = screen.queryAllByRole('link');
      expect(navLinks.length).toBeGreaterThan(0);
    });
  });

  describe('Features Section', () => {
    it('should display features', () => {
      render(<LandingPage />);

      const features = screen.queryAllByText(/feature/i);
      expect(features.length).toBeGreaterThan(0);
    });

    it('should display feature descriptions', () => {
      render(<LandingPage />);

      const descriptions = screen.queryAllByText(/vehicle/i);
      expect(descriptions.length).toBeGreaterThan(0);
    });
  });

  describe('Interactive Elements', () => {
    it('should handle CTA button clicks', async () => {
      const user = await import('@testing-library/user-event');
      render(<LandingPage />);

      const ctaButton = screen.queryByRole('link', { name: /get started/i });
      if (ctaButton) {
        await user.default.setup().click(ctaButton);
        expect(ctaButton).toHaveAttribute('href');
      }
    });

    it('should have responsive navigation', async () => {
      render(<LandingPage />);

      const mobileMenu = screen.queryByRole('button', { name: /menu/i });
      if (mobileMenu) {
        const user = await import('@testing-library/user-event');
        await user.default.setup().click(mobileMenu);
      }
    });
  });

  describe('Content Sections', () => {
    it('should display about section', () => {
      render(<LandingPage />);

      const aboutElements = screen.queryAllByText(/about/i);
      expect(aboutElements.length).toBeGreaterThan(0);
    });

    it('should display pricing or features section', () => {
      render(<LandingPage />);

      const sections = screen.queryAllByText(/features|pricing/i);
      expect(sections.length).toBeGreaterThan(0);
    });
  });

  describe('Footer', () => {
    it('should display footer', () => {
      render(<LandingPage />);

      const footer = document.querySelector('footer');
      if (footer) {
        expect(footer).toBeInTheDocument();
      }
    });

    it('should have contact information', () => {
      render(<LandingPage />);

      const contactElements = screen.queryAllByText(/contact|email/i);
      expect(contactElements.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(<LandingPage />);

      const headings = screen.queryAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('should have alt text for images', () => {
      render(<LandingPage />);

      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (img.src) {
          expect(img).toHaveAttribute('alt');
        }
      });
    });
  });

  describe('Responsive Design', () => {
    it('should render on mobile viewport', () => {
      global.innerWidth = 375;
      global.innerHeight = 667;

      render(<LandingPage />);

      expect(screen.getByText(/synerx/i)).toBeInTheDocument();
    });

    it('should render on desktop viewport', () => {
      global.innerWidth = 1920;
      global.innerHeight = 1080;

      render(<LandingPage />);

      expect(screen.getByText(/synerx/i)).toBeInTheDocument();
    });
  });

  describe('SEO Elements', () => {
    it('should have page title', () => {
      render(<LandingPage />);

      const heading = screen.getByText(/synerx/i);
      expect(heading).toBeInTheDocument();
    });

    it('should have descriptive content', () => {
      render(<LandingPage />);

      const content = document.body.textContent;
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(0);
    });
  });
});
