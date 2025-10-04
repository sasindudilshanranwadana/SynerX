// src/components/ServerStatusIndicator.test.tsx

import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ServerStatusIndicator from './ServerStatusIndicator';
import { getStoredTheme } from '../lib/theme';

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

  // THE FIX IS APPLIED HERE
  it('initially renders in the "connecting" state', async () => {
    // Mock the fetch call with a promise that never resolves,
    // so we can test the "connecting" state cleanly.
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<ServerStatusIndicator />);

    // Assert the initial state is correct.
    expect(screen.getByText('Connecting...')).toBeInTheDocument();

    // Now, wrap the timer advancement in `act` to flush the `useEffect`
    // state update and silence the warning. We don't need to assert anything after.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  });

  // The rest of your tests are already correct
  it('transitions to "connected" state on successful API response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "SynerX API is running!", status: "ok" }),
    });
    render(<ServerStatusIndicator />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('Connected with Runpod')).toBeInTheDocument();
  });

  it('transitions to "error" state on a failed API response', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    render(<ServerStatusIndicator />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('Disconnected from Runpod')).toBeInTheDocument();
  });

  it('transitions to "error" state when fetch throws an error', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'));
    render(<ServerStatusIndicator />);
    
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('Disconnected from Runpod')).toBeInTheDocument();
  });

  it('cleans up the interval timer on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const { unmount } = render(<ServerStatusIndicator />);
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });
  
  it('periodically re-checks the connection', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "SynerX API is running!", status: "ok" }),
    });
    render(<ServerStatusIndicator />);
    
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText('Connected with Runpod')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockFetch.mockRejectedValue(new Error('Connection lost'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(screen.getByText('Disconnected from Runpod')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});