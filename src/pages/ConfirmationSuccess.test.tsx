// src/pages/ConfirmationSuccess.test.tsx

import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ConfirmationSuccess from './ConfirmationSuccess';

// --- Mocks ---

// Mock the useNavigate hook from react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// --- Test Suite ---

describe('ConfirmationSuccess component', () => {
  beforeEach(() => {
    // Use fake timers to control setInterval and setTimeout
    vi.useFakeTimers();
    // Clear any previous mock calls before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore real timers after each test
    vi.useRealTimers();
  });

  it('renders the initial success message and countdown', () => {
    render(<ConfirmationSuccess />);
    
    expect(screen.getByText(/Email Confirmed Successfully!/i)).toBeInTheDocument();
    expect(screen.getByText(/Thank you for confirming your email address./i)).toBeInTheDocument();
    // Check that the countdown starts at 5
    expect(screen.getByText(/5 seconds/i)).toBeInTheDocument();
  });

  it('updates the countdown timer every second', async () => {
    render(<ConfirmationSuccess />);
    
    expect(screen.getByText(/5 seconds/i)).toBeInTheDocument();

    // Advance time by 1 second and check if the countdown updates
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/4 seconds/i)).toBeInTheDocument();

    // Advance time by another second
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/3 seconds/i)).toBeInTheDocument();
  });

  it('displays singular "second" when countdown is 1', async () => {
    render(<ConfirmationSuccess />);
    
    // Advance time by 4 seconds
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    
    expect(screen.getByText(/1 second/i)).toBeInTheDocument();
  });

  it('navigates to the home page when the countdown finishes', async () => {
    render(<ConfirmationSuccess />);
    
    // Check that navigate has not been called yet
    expect(mockNavigate).not.toHaveBeenCalled();

    // Advance time by 5 seconds to trigger the navigation
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    
    // Check that navigate was called with the correct path
    expect(mockNavigate).toHaveBeenCalledWith('/');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('navigates to the home page when the button is clicked', () => {
    render(<ConfirmationSuccess />);
    
    const goToHomeButton = screen.getByRole('button', { name: /Go to Home Page Now/i });
    fireEvent.click(goToHomeButton);
    
    // Check that navigate was called immediately
    expect(mockNavigate).toHaveBeenCalledWith('/');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('cleans up the interval timer on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    
    const { unmount } = render(<ConfirmationSuccess />);
    
    // Check that the spy has not been called yet (except by React internals if any)
    const initialCallCount = clearIntervalSpy.mock.calls.length;

    unmount();
    
    // Check that clearInterval was called one more time upon unmounting
    expect(clearIntervalSpy).toHaveBeenCalledTimes(initialCallCount + 1);
  });
});