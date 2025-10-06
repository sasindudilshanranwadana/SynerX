// src/pages/Auth.test.tsx

import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Auth from './Auth';

// Add React import for forwardRef
import React from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { LinkProps } from 'react-router-dom';
import { AuthError, Session } from '@supabase/supabase-js';

// --- Mocks ---

const mockNavigate = vi.fn();
const mockSearchParams = { get: vi.fn().mockReturnValue(null) };
vi.mock('react-router-dom', () => ({
  useNavigate: (): typeof mockNavigate => mockNavigate,
  useSearchParams: (): [typeof mockSearchParams, Function] => [mockSearchParams, vi.fn()],
  Link: (props: LinkProps) => <a {...props} href={props.to as string} />,
}));

const mockSupabaseAuth = {
  signUp: vi.fn<(options: any) => Promise<{ data: any; error: AuthError | null }>>(),
  signInWithPassword: vi.fn<(options: any) => Promise<{ data: any; error: AuthError | null }>>(),
  resend: vi.fn<(options: any) => Promise<{ data: any; error: AuthError | null }>>(),
  onAuthStateChange: vi.fn().mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  }),
};
vi.mock('../lib/supabase', () => ({
  supabase: { auth: mockSupabaseAuth },
}));

interface MockRecaptchaRef {
  current: { reset: () => void } | null;
}
const mockRecaptchaRef: MockRecaptchaRef = { current: { reset: vi.fn() } };

// THE FIX: Use React.forwardRef, not the non-existent vi.forwardRef
vi.mock('react-google-recaptcha', () => ({
  default: React.forwardRef<ReCAPTCHA, React.ComponentProps<typeof ReCAPTCHA>>((props, ref) => {
    if (typeof ref === 'function') {
      ref(mockRecaptchaRef.current as any);
    } else if (ref) {
      ref.current = mockRecaptchaRef.current as any;
    }
    return <div data-testid="mock-recaptcha" onClick={() => props.onChange?.('mock-token')} />;
  }),
}));

vi.mock('../components/ServerStatusIndicator', () => ({
  default: () => <div data-testid="server-status-indicator" />,
}));

Object.defineProperty(window, 'location', {
  value: { origin: 'http://localhost:3000' },
  writable: true,
});

// --- Test Suite ---

describe('Auth component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSearchParams.get.mockReturnValue(null);
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
    it('renders the sign-in form by default', () => {
      render(<Auth />);
      expect(screen.getByRole('heading', { name: /Welcome Back/i })).toBeInTheDocument();
    });

    it('handles successful sign-in', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
      render(<Auth />);
      fillForm('test@example.com', 'password123');
      solveCaptcha();
      fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

      // Wait for the async part of the submit handler to complete
      await screen.findByRole('button', { name: /Sign In/i });

      const onAuthStateChangeCallback = mockSupabaseAuth.onAuthStateChange.mock.calls[0][0];
      await act(async () => {
        onAuthStateChangeCallback('SIGNED_IN', { user: {} } as Session);
      });

      expect(await screen.findByText(/Welcome! You have successfully signed in/i)).toBeInTheDocument();
      
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('shows an error for invalid login credentials', async () => {
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: {},
        error: { name: 'AuthApiError', message: 'Invalid login credentials' } as AuthError,
      });
      render(<Auth />);
      fillForm('wrong@example.com', 'wrongpassword');
      solveCaptcha();
      fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));
      
      expect(await screen.findByText(/The email or password you entered is incorrect/i)).toBeInTheDocument();
      expect(mockRecaptchaRef.current?.reset).toHaveBeenCalled();
    });

    it('toggles to the sign-up view', () => {
      render(<Auth />);
      fireEvent.click(screen.getByRole('button', { name: /Create one here/i }));
      expect(screen.getByRole('heading', { name: /Create Account/i })).toBeInTheDocument();
    });
  });

  describe('Sign Up View', () => {
    beforeEach(() => {
      render(<Auth />);
      fireEvent.click(screen.getByRole('button', { name: /Create one here/i }));
    });

    it('handles successful sign-up and shows the confirmation screen', async () => {
      mockSupabaseAuth.signUp.mockResolvedValue({ data: {}, error: null });
      fillForm('newuser@example.com', 'password123', 'password123');
      solveCaptcha();
      fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
      expect(await screen.findByRole('heading', { name: /Check Your Email/i })).toBeInTheDocument();
    });
  });

  describe('Check Email Screen', () => {
    beforeEach(async () => {
      render(<Auth />);
      mockSupabaseAuth.signUp.mockResolvedValue({ data: {}, error: null });
      fireEvent.click(screen.getByRole('button', { name: /Create one here/i }));
      fillForm('check@email.com', 'password123', 'password123');
      solveCaptcha();
      fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
      await screen.findByText('check@email.com');
    });

    it('handles resending the confirmation email', async () => {
      mockSupabaseAuth.resend.mockResolvedValue({ data: {}, error: null });
      const resendButton = screen.getByRole('button', { name: /Resend Confirmation Email/i });
      fireEvent.click(resendButton);
      expect(await screen.findByText(/Confirmation email has been resent/i)).toBeInTheDocument();
    });
  });
});