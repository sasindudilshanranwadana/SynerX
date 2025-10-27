// src/pages/Auth.test.tsx

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Auth from './Auth';

import ReCAPTCHA from 'react-google-recaptcha';
import { LinkProps } from 'react-router-dom';
import { AuthError, Session } from '@supabase/supabase-js';

// --- Mocks ---

const { mockSignUp, mockSignInWithPassword, mockResend, mockOnAuthStateChange } = vi.hoisted(() => ({
  mockSignUp: vi.fn<(options: any) => Promise<{ data: any; error: AuthError | null }>>(),
  mockSignInWithPassword: vi.fn<(options: any) => Promise<{ data: any; error: AuthError | null }>>(),
  mockResend: vi.fn<(options: any) => Promise<{ data: any; error: AuthError | null }>>(),
  mockOnAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signUp: mockSignUp, signInWithPassword: mockSignInWithPassword, resend: mockResend, onAuthStateChange: mockOnAuthStateChange } },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  Link: (props: LinkProps) => <a {...props} href={props.to as string} />,
}));

interface MockRecaptchaRef { current: { reset: () => void } | null; }
const mockRecaptchaRef: MockRecaptchaRef = { current: { reset: vi.fn() } };
vi.mock('react-google-recaptcha', () => ({
  default: React.forwardRef<ReCAPTCHA, React.ComponentProps<typeof ReCAPTCHA>>((props, ref) => {
    if (ref && typeof ref !== 'function') ref.current = mockRecaptchaRef.current as any;
    return <div data-testid="mock-recaptcha" onClick={() => props.onChange?.('mock-token')} />;
  }),
}));

vi.mock('../components/ServerStatusIndicator', () => ({ default: () => <div data-testid="server-status-indicator" /> }));
Object.defineProperty(window, 'location', { value: { origin: 'http://localhost:3000' }, writable: true });

// --- Test Suite ---
describe('Auth component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSignUp.mockResolvedValue({ data: {}, error: null });
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    mockResend.mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const fillForm = (email: string, password: string, confirmPassword = '') => {
    fireEvent.change(screen.getByPlaceholderText('Enter your email address'), { target: { value: email } });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: password } });
    if (confirmPassword) {
      fireEvent.change(screen.getByPlaceholderText('Confirm your password'), { target: { value: confirmPassword } });
    }
  };

  const solveCaptcha = () => fireEvent.click(screen.getByTestId('mock-recaptcha'));

  describe('Sign In View', () => {
    it('handles successful sign-in', async () => {
      render(<Auth />);
      fillForm('test@example.com', 'password123');
      solveCaptcha();

      fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

      // Step 1: Manually trigger the auth state change, which sets the notification.
      // This must be in `act` because it causes a state update.
      act(() => {
        const onAuthStateChangeCallback = mockOnAuthStateChange.mock.calls[0][0];
        onAuthStateChangeCallback('SIGNED_IN', { user: {} } as Session);
      });

      // Step 2: Assert the notification is visible immediately after the state update.
      // No need to wait or advance timers here, which was the source of the race condition.
      expect(screen.getByText(/Welcome! You have successfully signed in/i)).toBeInTheDocument();

      // Step 3: Now, specifically test the navigation timeout.
      // Wrap the timer advance in `act` to process the resulting state change (navigation).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      // Step 4: Assert the navigation occurred.
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('shows an error for invalid login credentials', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {}, error: { name: 'AuthApiError', message: 'Invalid login credentials' } as AuthError,
      });
      render(<Auth />);
      fillForm('wrong@example.com', 'wrongpassword');
      solveCaptcha();
      
      // The `act` wrapper is crucial for processing the state updates that result
      // from the promise resolving and the component's error handling logic.
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));
        // Flushing the promise queue.
        await Promise.resolve();
      });
      
      expect(screen.getByText(/The email or password you entered is incorrect/i)).toBeInTheDocument();
      expect(mockRecaptchaRef.current?.reset).toHaveBeenCalled();
    });
  });

  describe('Check Email Screen', () => {
    beforeEach(async () => {
      render(<Auth />);
      fireEvent.click(screen.getByRole('button', { name: /Create one here/i }));
      fillForm('check@email.com', 'password123', 'password123');
      solveCaptcha();
      
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
        // Flush promise queue to ensure state transition completes.
        await Promise.resolve(); 
      });

      expect(screen.getByText('Check Your Email')).toBeInTheDocument();
    });

    it('handles resending the confirmation email', async () => {
      const resendButton = screen.getByRole('button', { name: /Resend Confirmation Email/i });
      
      await act(async () => {
        fireEvent.click(resendButton);
        await Promise.resolve();
      });

      expect(screen.getByText(/Confirmation email has been resent/i)).toBeInTheDocument();
      expect(mockResend).toHaveBeenCalled();
    });
  });
});