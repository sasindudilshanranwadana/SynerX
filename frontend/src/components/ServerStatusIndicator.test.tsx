// src/components/ServerStatusIndicator.test.tsx

import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ServerStatusIndicator from './ServerStatusIndicator';
import { getStoredTheme } from '../lib/theme';

// Mocks remain the same and are still necessary
vi.mock('../lib/theme', () => ({
  getStoredTheme: vi.fn(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ServerStatusIndicator component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (getStoredTheme as any).mockReturnValue('light');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initially renders in the "connecting" state', async () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // Prevent fetch from resolving
    render(<ServerStatusIndicator />);
    expect(screen.getByText('Connecting...')).toBeInTheDocument();

    // Flush the useEffect state update to silence the `act` warning
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  });

  it('transitions to "connected" state on successful API response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "SynerX API is running!", status: "ok" }),
    });
    render(<ServerStatusIndicator />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    
    // UPDATE: Check for the new text
    expect(screen.getByText('RunPod Connected')).toBeInTheDocument();
    // VERIFY: Ensure it's calling the correct development endpoint
    expect(mockFetch).toHaveBeenCalledWith('/api/', expect.any(Object));
  });

  it('transitions to "error" state on a failed API response', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    render(<ServerStatusIndicator />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // UPDATE: Check for the new text
    expect(screen.getByText('RunPod Disconnected')).toBeInTheDocument();
  });

  it('transitions to "error" state when fetch throws an error', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'));
    render(<ServerStatusIndicator />);
    
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // UPDATE: Check for the new text
    expect(screen.getByText('RunPod Disconnected')).toBeInTheDocument();
  });

  it('cleans up the interval timer on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const { unmount } = render(<ServerStatusIndicator />);
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });
  
  it('periodically re-checks the connection', async () => {
    // First call is successful
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "SynerX API is running!", status: "ok" }),
    });
    render(<ServerStatusIndicator />);
    
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    // UPDATE: Check for the new text
    expect(screen.getByText('RunPod Connected')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call will fail
    mockFetch.mockRejectedValue(new Error('Connection lost'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    // UPDATE: Check for the new text
    expect(screen.getByText('RunPod Disconnected')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});