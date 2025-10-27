import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Playback from '../Playback';

// --- Mock HTMLCanvasElement and HTMLMediaElement ---
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => ({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Array(4) })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => ({ data: new Array(4) })),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    transform: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
  }),
});

Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  value: vi.fn(),
});

Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  value: vi.fn(),
});

// --- Hoisted Mocks ---
const { mockFetchFilteredVideos, mockFetchVideoSummary, mockDeleteVideoFromRunPod, MockChart, mockChartDestroy } = vi.hoisted(() => {
    const destroy = vi.fn();
    const register = vi.fn();
    const Chart = vi.fn(() => ({ destroy }));
    Chart.register = register;
    return {
        mockFetchFilteredVideos: vi.fn(),
        mockFetchVideoSummary: vi.fn(),
        mockDeleteVideoFromRunPod: vi.fn(),
        MockChart: Chart,
        mockChartDestroy: destroy
    };
});

// --- Module Mocks ---
vi.mock('../lib/api', () => ({
    fetchFilteredVideos: mockFetchFilteredVideos,
    fetchVideoSummary: mockFetchVideoSummary,
    deleteVideoFromRunPod: mockDeleteVideoFromRunPod,
    getStreamingVideoUrl: (id: string) => `http://mock.url/video/${id}`,
}));

vi.mock('chart.js', () => ({ 
    Chart: MockChart, 
    registerables: []
}));

vi.mock('../lib/theme', () => ({ getStoredTheme: () => 'dark' }));
vi.mock('../components/Header', () => ({ default: () => <header>Header Mock</header> }));
vi.mock('../components/Sidebar', () => ({ default: () => <aside>Sidebar Mock</aside> }));
vi.mock('../components/ServerStatusIndicator', () => ({ default: () => <div>Server Status Mock</div> }));

// --- Mock Data ---
const mockVideos = [ 
    { id: 1, video_name: 'test-video-01.mp4', status: 'completed' }, 
    { id: 2, video_name: 'another-video-02.mp4', status: 'processing' } 
];

const mockVideoSummary = { 
    status: 'success', 
    video: mockVideos[0], 
    tracking_data: [], 
    vehicle_counts: [{ vehicle_type: 'car', count: 10, date: '2023-10-27' }] 
};

describe('Playback Component', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.clearAllMocks();
        mockFetchFilteredVideos.mockResolvedValue({ status: 'success', data: mockVideos, count: mockVideos.length });
        mockFetchVideoSummary.mockResolvedValue(mockVideoSummary);
        mockDeleteVideoFromRunPod.mockResolvedValue({ status: 'success' });
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('renders initial layout and loads videos successfully', async () => {
        render(<Playback />);
        
        await act(async () => {
            await vi.runOnlyPendingTimersAsync();
        });
        
        expect(await screen.findByText('test-video-01.mp4')).toBeInTheDocument();
    });
    
    it('displays an error message if initial video load fails', async () => {
        mockFetchFilteredVideos.mockRejectedValue(new Error('NetworkError'));
        render(<Playback />);
        
        await act(async () => {
            await vi.runOnlyPendingTimersAsync();
        });
        
        expect(await screen.findByText(/Error: Unable to connect/i)).toBeInTheDocument();
    });

    it('filters videos based on search term', async () => {
        render(<Playback />);
        
        await act(async () => {
            await vi.runOnlyPendingTimersAsync();
        });
        
        fireEvent.change(screen.getByPlaceholderText('Search by video name...'), { target: { value: 'another' } });
        
        await waitFor(() => {
            expect(screen.queryByText('test-video-01.mp4')).not.toBeInTheDocument();
        });
    });

    it('applies filters and reloads data when "Apply Filters" is clicked', async () => {
        render(<Playback />);
        
        await act(async () => {
            await vi.runOnlyPendingTimersAsync();
        });
        
        fireEvent.change(screen.getByLabelText(/From Date/i), { target: { value: '2023-01-01' } });
        
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
            await vi.runAllTimersAsync();
        });
        
        expect(mockFetchFilteredVideos).toHaveBeenCalledTimes(2);
    });
    
    describe('Summary Modal', () => {
        it('opens, fetches data, and displays summary when "Analytics" is clicked', async () => {
            render(<Playback />);
            
            // Process initial timers
            await act(async () => {
                await vi.runOnlyPendingTimersAsync();
            });
            
            const analyticsButtons = await screen.findAllByRole('button', { name: 'Analytics' });
            fireEvent.click(analyticsButtons[0]);

            // Process summary fetch
            await act(async () => {
                await vi.runOnlyPendingTimersAsync();
            });

            // Process chart initialization
            await act(async () => {
                await vi.runOnlyPendingTimersAsync();
            });

            expect(MockChart).toHaveBeenCalled();
        });

        it('closes the modal and cleans up resources', async () => {
            render(<Playback />);
            
            // Process initial load
            await act(async () => {
                await vi.runOnlyPendingTimersAsync();
            });
            
            // Open modal
            const analyticsButtons = await screen.findAllByRole('button', { name: 'Analytics' });
            fireEvent.click(analyticsButtons[0]);

            // Process summary fetch
            await act(async () => {
                await vi.runOnlyPendingTimersAsync();
            });

            // Process chart initialization (critical step)
            await act(async () => {
                await vi.runOnlyPendingTimersAsync();
            });

            const modalTitle = await screen.findByText('Video Analytics Dashboard');
            
            // Verify chart was created before closing
            expect(MockChart).toHaveBeenCalled();

            // Close modal
            const closeButton = screen.getByRole('button', { name: /close summary modal/i });
            fireEvent.click(closeButton);
            
            // Verify modal closes
            await waitFor(() => {
                expect(modalTitle).not.toBeInTheDocument();
            });
            
            // Verify cleanup
            expect(mockChartDestroy).toHaveBeenCalled();
        });
    });

    describe('Delete Functionality', () => {
        it('opens confirmation modal and deletes video upon confirmation', async () => {
            render(<Playback />);
            
            await act(async () => {
                await vi.runOnlyPendingTimersAsync();
            });
            
            const deleteButtons = await screen.findAllByRole('button', { name: 'Delete' });
            fireEvent.click(deleteButtons[0]);

            await act(async () => {
                await vi.runOnlyPendingTimersAsync();
            });

            const confirmButton = screen.getByRole('button', { name: /delete video/i });
            fireEvent.click(confirmButton);

            await waitFor(() => {
                expect(mockDeleteVideoFromRunPod).toHaveBeenCalledWith(1);
            });
        });

        it('closes confirmation modal on cancel', async () => {
            render(<Playback />);
            
            await act(async () => {
                await vi.runOnlyPendingTimersAsync();
            });
            
            const deleteButtons = await screen.findAllByRole('button', { name: 'Delete' });
            fireEvent.click(deleteButtons[0]);

            await act(async () => {
                await vi.runOnlyPendingTimersAsync();
            });

            const cancelButton = screen.getByRole('button', { name: /cancel/i });
            fireEvent.click(cancelButton);

            await waitFor(() => {
                expect(screen.queryByText('Confirm Deletion')).not.toBeInTheDocument();
            });
        });
    });
});