// dashboard.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Dashboard from '../Dashboard';

// Mock all external dependencies
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null } }))
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    }))
  }
}));

vi.mock('../../lib/database', () => ({
  getOverallAnalytics: vi.fn(() => Promise.resolve({
    processedVideos: 0,
    violations: 0,
    complianceRate: 0,
    avgReactionTime: 0
  }))
}));

vi.mock('../../lib/theme', () => ({
  getStoredTheme: vi.fn(() => 'light')
}));

vi.mock('../../components/ServerStatusIndicator', () => ({
  default: () => <div data-testid="server-status">Server Status</div>
}));

vi.mock('../../components/Header', () => ({
  default: ({ title }) => <div data-testid="header">Header: {title}</div>
}));

vi.mock('../../components/Sidebar', () => ({
  default: ({ isOpen }) => <div data-testid="sidebar">Sidebar: {isOpen ? 'open' : 'closed'}</div>
}));

// Mock fetch globally
global.fetch = vi.fn();
global.AbortSignal = {
  timeout: vi.fn()
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<Dashboard />);
    expect(screen.getByTestId('server-status')).toBeInTheDocument();
  });

  it('displays loading skeletons initially', () => {
    render(<Dashboard />);
    expect(screen.getAllByTestId('loading-skeleton')).toHaveLength(4);
  });

  it('renders header with correct title', () => {
    render(<Dashboard />);
    expect(screen.getByTestId('header')).toHaveTextContent('Header: Dashboard');
  });

  it('renders sidebar in closed state by default', () => {
    render(<Dashboard />);
    expect(screen.getByTestId('sidebar')).toHaveTextContent('Sidebar: closed');
  });

  it('shows welcome message for user', () => {
    render(<Dashboard />);
    expect(screen.getByText(/Welcome back/)).toBeInTheDocument();
  });

  it('displays all main sections', () => {
    render(<Dashboard />);
    expect(screen.getByText('System Status')).toBeInTheDocument();
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('shows system status items', () => {
    render(<Dashboard />);
    expect(screen.getByText('YOLOv8 Model')).toBeInTheDocument();
    expect(screen.getByText('Video Processing')).toBeInTheDocument();
    expect(screen.getByText('Database Sync')).toBeInTheDocument();
  });

});