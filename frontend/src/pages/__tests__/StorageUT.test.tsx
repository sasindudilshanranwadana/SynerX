// Storage.test.tsx
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Storage from '../Storage';

// Hoisted mocks
const { 
  mockFetchJSON,
  mockGetSession
} = vi.hoisted(() => ({
  mockFetchJSON: vi.fn(),
  mockGetSession: vi.fn(() => 
    Promise.resolve({ data: { session: null }, error: null }))
}));

vi.mock('../../lib/api', () => ({
  fetchJSON: mockFetchJSON
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: mockGetSession }
  }
}));

vi.mock('../../lib/theme', () => ({
  getStoredTheme: vi.fn(() => 'light')
}));

vi.mock('../../components/Header', () => ({
  default: () => <header>Header</header>
}));

vi.mock('../../components/Sidebar', () => ({
  default: () => <aside>Sidebar</aside>
}));

vi.mock('../../components/ServerStatusIndicator', () => ({
  default: () => <div>Server Status</div>
}));

const mockStorageData = {
  status: 'success',
  data: {
    total: 10000000000,    // 9.31 GB
    used: 5000000000,      // 4.66 GB
    free: 5000000000,      // 4.66 GB
    temp_files: 3,
    temp_size: 1000000000  // 953.67 MB (20% of used)
  }
};

const mockVideosData = {
  status: 'success',
  data: [
    {
      id: '1',
      name: 'video1.mp4',
      size: 1000000000,
      created_at: '2023-01-01T00:00:00Z',
      status: 'processed',
      path: '/videos/video1.mp4'
    }
  ]
};

describe('Storage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn();
  });

  test('renders and loads storage data', async () => {
    mockFetchJSON
      .mockResolvedValueOnce(mockStorageData)
      .mockResolvedValueOnce(mockVideosData);

    render(
      <MemoryRouter>
        <Storage />
      </MemoryRouter>
    );

    await waitFor(() => {
      // Verify sections by their headers
      const totalStorageCard = screen.getByText('Total Storage').closest('div')!;
      within(totalStorageCard).getByText('9.31 GB');

      const usedStorageCard = screen.getByText('Used Storage').closest('div')!;
      within(usedStorageCard).getByText('4.66 GB');
      within(usedStorageCard).getByText('50.0% of total');

      const freeStorageCard = screen.getByText('Free Storage').closest('div')!;
      within(freeStorageCard).getByText('4.66 GB');

      const tempFilesCard = screen.getByText('Temp Files').closest('div')!;
      within(tempFilesCard).getByText('3');
      within(tempFilesCard).getByText('953.67 MB (20.0%)');

      expect(screen.getByText('video1.mp4')).toBeInTheDocument();
    });
  });

  test('handles video selection and deletion', async () => {
    mockFetchJSON
      .mockResolvedValueOnce(mockStorageData)
      .mockResolvedValueOnce(mockVideosData);

    render(
      <MemoryRouter>
        <Storage />
      </MemoryRouter>
    );

    await waitFor(() => screen.getByText('video1.mp4'));
    
    // Select the video
    const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(selectAllCheckbox);
    
    // Verify and click the delete button - match by exact text with count
    const deleteButton = screen.getByRole('button', { name: /Delete Selected \(\d+\)/ });
    expect(deleteButton).toHaveTextContent('Delete Selected (1)');
    
    fireEvent.click(deleteButton);
  });

  test('shows error state', async () => {
    mockFetchJSON.mockRejectedValue(new Error('Storage fetch failed'));
    
    render(
      <MemoryRouter>
        <Storage />
      </MemoryRouter>
    );
    
    const errorMessage = await screen.findByText('Failed to load storage data. Please try again.');
    expect(errorMessage).toBeInTheDocument();
  });

  test('shows loading state', () => {
    mockFetchJSON.mockImplementation(() => new Promise(() => {}));
    
    render(
      <MemoryRouter>
        <Storage />
      </MemoryRouter>
    );
    
    expect(screen.getByText('Loading storage data...')).toBeInTheDocument();
  });

  test('handles temp file cleanup', async () => {
    mockFetchJSON
      .mockResolvedValueOnce(mockStorageData)
      .mockResolvedValueOnce(mockVideosData);

    render(
      <MemoryRouter>
        <Storage />
      </MemoryRouter>
    );

    await waitFor(() => screen.getByText('Cleanup Temp Files (3)'));
    fireEvent.click(screen.getByText('Cleanup Temp Files (3)'));
    expect(screen.getByText(/delete 3 temporary files/i)).toBeInTheDocument();
  });
});