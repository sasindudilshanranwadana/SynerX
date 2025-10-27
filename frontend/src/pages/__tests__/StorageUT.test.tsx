import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Storage from './Storage';

// --- Hoisted Mocks ---
const { mockGetStoredTheme } = vi.hoisted(() => ({
  mockGetStoredTheme: vi.fn().mockReturnValue('light')
}));

// --- Module Mocks ---
vi.mock('../lib/theme', () => ({
  getStoredTheme: mockGetStoredTheme
}));

vi.mock('../components/Header', () => ({ 
  default: ({ setSidebarOpen }: any) => (
    <header data-testid="header">
      <button onClick={() => setSidebarOpen((prev: boolean) => !prev)}>Toggle Sidebar</button>
    </header>
  )
}));

vi.mock('../components/Sidebar', () => ({ 
  default: ({ sidebarOpen, setSidebarOpen }: any) => (
    <aside data-testid="sidebar" data-open={sidebarOpen}>
      <button onClick={() => setSidebarOpen(false)}>Close</button>
    </aside>
  )
}));

vi.mock('../components/ServerStatusIndicator', () => ({ 
  default: () => <div data-testid="server-status">Server Status</div>
}));

// --- Mock Data ---
const mockStorageInfo = {
  total: 10000000000, // 10GB
  used: 5000000000,   // 5GB
  free: 5000000000,   // 5GB
  temp_files: 5,
  temp_size: 1000000000  // 1GB
};

const mockVideos = [
  {
    id: '1',
    name: 'video1.mp4',
    size: 1000000000, // 1GB
    created_at: '2023-01-01T00:00:00Z',
    status: 'processed',
    path: '/videos/video1.mp4'
  },
  {
    id: '2',
    name: 'video2.mp4',
    size: 500000000,
    created_at: '2023-01-02T00:00:00Z',
    status: 'processing',
    path: '/videos/video2.mp4'
  }
];

// --- Before Each Setup ---
beforeEach(() => {
  // Reset mocks
  mockGetStoredTheme.mockClear();
  mockGetStoredTheme.mockReturnValue('light');
  
  // Mock video element
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { value: vi.fn() });
  
  // Mock fetch
  global.fetch = vi.fn()
    .mockImplementationOnce(() => 
      Promise.resolve({
        json: () => Promise.resolve({ status: 'success', data: mockStorageInfo })
      }))
    .mockImplementationOnce(() => 
      Promise.resolve({
        json: () => Promise.resolve({ status: 'success', data: mockVideos })
      }));
  
  // Mock URL handling for downloads
  global.URL.createObjectURL = vi.fn();
  global.URL.revokeObjectURL = vi.fn();
  
  // Create DOM container
  document.body.innerHTML = '<div id="root"></div>';
  
  // Use fake timers
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

// --- After Each Cleanup ---
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// --- Test Cases ---
describe('Storage Component', () => {

  it('renders initial layout and loads storage data', async () => {
    render(<Storage />);
    
    await waitFor(() => {
      expect(screen.getByText('Storage Management')).toBeInTheDocument();
      expect(screen.getByText('video1.mp4')).toBeInTheDocument();
    });
  });

  it('displays loading state initially', () => {
    // Delay fetch response
    global.fetch = vi.fn(() => new Promise(() => {})) as any;
    
    render(<Storage />);
    expect(screen.getByText('Loading storage data...')).toBeInTheDocument();
  });

  it('refreshes storage data when refresh button is clicked', async () => {
    render(<Storage />);
    
    await waitFor(() => screen.getByText('video1.mp4'));
    
    // Reset fetch mock and set new response
    vi.clearAllMocks();
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'success', data: mockStorageInfo }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'success', data: mockVideos }) });
    
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    });
    
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('displays error message when data loading fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    
    render(<Storage />);
    
    await waitFor(() => {
      expect(screen.getByText(/failed to load storage data/i)).toBeInTheDocument();
    });
  });

  it('selects and deselects videos', async () => {
    render(<Storage />);
    
    await waitFor(() => screen.getByText('video1.mp4'));
    
    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => fireEvent.click(checkboxes[1]));
    
    expect(screen.getByText('Delete Selected (1)')).toBeInTheDocument();
    
    await act(async () => fireEvent.click(checkboxes[1]));
    expect(screen.queryByText('Delete Selected (1)')).not.toBeInTheDocument();
  });

  it('selects all videos with select all checkbox', async () => {
    render(<Storage />);
    
    await waitFor(() => screen.getByText('video1.mp4'));
    
    const selectAll = screen.getAllByRole('checkbox')[0];
    await act(async () => fireEvent.click(selectAll));
    expect(screen.getByText('Delete Selected (2)')).toBeInTheDocument();
    
    await act(async () => fireEvent.click(selectAll));
    expect(screen.queryByText('Delete Selected (2)')).not.toBeInTheDocument();
  });

  it('opens delete confirmation modal when delete button is clicked', async () => {
    render(<Storage />);
    
    await waitFor(() => screen.getByText('video1.mp4'));
    
    // Select video and open delete modal
    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      fireEvent.click(checkboxes[1]);
      fireEvent.click(screen.getByRole('button', { name: /delete selected/i }));
    });
    
    expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
  });

  it('deletes selected videos when confirmed', async () => {
    // Mock delete API response
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'success', data: mockStorageInfo }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'success', data: mockVideos }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'success', deleted_files: [mockVideos[0].name] }) });
    
    render(<Storage />);
    
    await waitFor(() => screen.getByText('video1.mp4'));
    
    // Select video and delete
    const checkboxes = screen.getAllByRole('checkbox');
    await act(async () => {
      fireEvent.click(checkboxes[1]);
      fireEvent.click(screen.getByRole('button', { name: /delete selected/i }));
    });
    
    // Verify modal opens
    await waitFor(() => {
      expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
    });
    
    // Confirm delete
    await act(async () => {
      const confirmButton = screen.getByRole('button', { name: /^Delete Videos$/i });
      fireEvent.click(confirmButton);
      await vi.runAllTimersAsync();
    });
    
    // Verify toast and removal
    await waitFor(() => {
      expect(screen.getByText(/successfully deleted 1 video\(s\)/i)).toBeInTheDocument();
      expect(screen.queryByText('video1.mp4')).not.toBeInTheDocument();
    });
  });

  it('opens cleanup confirmation modal when cleanup button is clicked', async () => {
    render(<Storage />);
    
    await waitFor(() => screen.getByText('video1.mp4'));
    
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /cleanup temp files/i }));
    });
    
    expect(screen.getByText('Cleanup Temporary Files')).toBeInTheDocument();
  });

  it('cleans up temporary files when confirmed', async () => {
    // Mock cleanup response
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'success', data: mockStorageInfo }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'success', data: mockVideos }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'success', cleaned_files: ['temp1.mp4', 'temp2.mp4'] }) });
    
    render(<Storage />);
    
    await waitFor(() => screen.getByText('video1.mp4'));
    
    // Open cleanup modal
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /cleanup temp files/i }));
    });
    
    // Verify modal opens
    await waitFor(() => {
      expect(screen.getByText(/cleanup temporary files/i)).toBeInTheDocument();
    });
    
    // Confirm cleanup
    await act(async () => {
      const confirmButton = screen.getByRole('button', { name: /^Cleanup$/i });
      fireEvent.click(confirmButton);
      await vi.runAllTimersAsync();
    });
    
    // Verify toast
    await waitFor(() => {
      expect(screen.getByText(/successfully cleaned up 2 temporary files/i)).toBeInTheDocument();
    });
  });

  it('opens video modal when view button is clicked', async () => {
    render(<Storage />);
    
    await waitFor(() => screen.getByText('video1.mp4'));
    
    const viewButtons = screen.getAllByTitle('View video');
    await act(async () => fireEvent.click(viewButtons[0]));
    
    expect(screen.getAllByText('video1.mp4').length).toBeGreaterThan(1);
  });

  it('downloads video when download button is clicked', async () => {
    const originalCreateElement = document.createElement.bind(document);
    const clickSpy = vi.fn();
    
    // Spy on createElement to handle anchor tags
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const el = originalCreateElement(tagName);
      if (tagName === 'a') {
        vi.spyOn(el, 'click').mockImplementation(clickSpy);
      }
      return el;
    });

    render(<Storage />);
    
    await waitFor(() => screen.getByText('video1.mp4'));
    
    const downloadButtons = screen.getAllByTitle('Download video');
    await act(async () => fireEvent.click(downloadButtons[0]));
    
    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled();
    });
    
    // Cleanup spy
    vi.restoreAllMocks();
  });

  it('closes video modal when close button is clicked', async () => {
    render(<Storage />);
    
    await waitFor(() => screen.getByText('video1.mp4'));
    
    // Open modal
    const viewButtons = screen.getAllByTitle('View video');
    await act(async () => fireEvent.click(viewButtons[0]));
    
    // Close modal using the last close button (modal close button)
    const allCloseButtons = screen.getAllByRole('button', { name: '' });
    const modalCloseButton = allCloseButtons[allCloseButtons.length - 1];
    
    await act(async () => fireEvent.click(modalCloseButton));
    
    // Video should still exist in table but modal should close
    await waitFor(() => {
      expect(screen.getByText('video1.mp4')).toBeInTheDocument();
      expect(screen.queryByTestId('video-modal')).toBeNull();
    });
  });

  it('displays toast notification and auto-hides after timeout', async () => {
    // Mock delete response
    global.fetch = vi.fn()
      .mockResolvedValue({ json: () => Promise.resolve({ 
        status: 'success', 
        deleted_files: ['video1.mp4'] 
      }) });
    
    render(<Storage />);
    
    await waitFor(() => screen.getByText('video1.mp4'));
    
    // Trigger delete
    await act(async () => {
      fireEvent.click(screen.getAllByRole('checkbox')[1]);
      fireEvent.click(screen.getByRole('button', { name: /delete selected/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByRole('button', { name: /^Delete Videos$/i });
      fireEvent.click(confirmButton);
      await vi.runAllTimersAsync();
    });
    
    // Verify toast exists
    await waitFor(() => {
      expect(screen.getByText(/successfully deleted 1 video\(s\)/i)).toBeInTheDocument();
    });
    
    // Advance timers past toast duration
    await act(async () => vi.advanceTimersByTime(3500));
    
    // Verify toast is gone
    expect(screen.queryByText(/successfully deleted/i)).not.toBeInTheDocument();
  });

  it('toggles sidebar when header button is clicked', async () => {
    render(<Storage />);
    
    await waitFor(() => screen.getByText('video1.mp4'));
    
    await act(async () => fireEvent.click(screen.getByText('Toggle Sidebar')));
    
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'true');
  });

  it('closes sidebar when close button is clicked', async () => {
    render(<Storage />);
    
    await waitFor(() => screen.getByText('video1.mp4'));
    
    // Open sidebar first
    await act(async () => fireEvent.click(screen.getByText('Toggle Sidebar')));
    // Then close it
    await act(async () => fireEvent.click(screen.getByText('Close')));
    
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'false');
  });

  it('handles theme changes', async () => {
    render(<Storage />);
    
    await waitFor(() => screen.getByText('video1.mp4'));
    
    // Simulate theme change event
    await act(async () => {
      const themeEvent = new Event('themeChanged');
      window.dispatchEvent(themeEvent);
      await vi.runAllTimersAsync();
    });
    
    // Verify component updates
    await waitFor(() => {
      expect(screen.getByText('video1.mp4')).toBeInTheDocument();
    });
  });
});