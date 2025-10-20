import React, { ReactElement } from 'react';
import { render, RenderOptions, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

interface AllTheProvidersProps {
  children: React.ReactNode;
}

const AllTheProviders = ({ children }: AllTheProvidersProps) => {
  return (
    <MemoryRouter>
      {children}
    </MemoryRouter>
  );
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  withRouter?: boolean;
}

const customRender = (
  ui: ReactElement,
  options?: CustomRenderOptions,
) => {
  const { withRouter = true, ...renderOptions } = options || {};

  if (withRouter) {
    return render(ui, { wrapper: AllTheProviders, ...renderOptions });
  }

  return render(ui, renderOptions);
};

export * from '@testing-library/react';
export { customRender as render, fireEvent, act };

export const mockFetch = (data: any, ok = true, status = 200) => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    } as Response)
  );
};

export const mockWebSocket = () => {
  const mockWS = {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,
    readyState: 1,
  };

  global.WebSocket = vi.fn(() => mockWS) as any;

  return mockWS;
};

export class WebSocketStub {
  onopen?: ((event: Event) => void) | null = null;
  onerror?: ((event: Event) => void) | null = null;
  onclose?: ((event: Event) => void) | null = null;
  onmessage?: ((event: MessageEvent) => void) | null = null;
  readyState: number = 0;

  constructor(public url: string) {
    (globalThis as any).__lastWS = this;
    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  send() {}

  close() {
    if (this.readyState === 3) return; // Already closing/closed
    this.readyState = 3;
    setTimeout(() => {
      this.onclose?.(new CloseEvent('close'));
    }, 0);
  }

  triggerError() {
    this.onerror?.(new Event('error'));
  }

  triggerMessage(data: any) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }
}

export const mockWebSocketWithStub = () => {
  (global as any).WebSocket = WebSocketStub as any;
  return WebSocketStub;
};

export const waitForLoadingToFinish = () => {
  return new Promise((resolve) => setTimeout(resolve, 0));
};

export const mockVideo = (file: Partial<File> = {}) => {
  return new File(['test'], 'test-video.mp4', {
    type: 'video/mp4',
    ...file,
  });
};

export const mockBlob = (content: string[] = ['test'], type = 'video/mp4') => {
  return new Blob(content, { type });
};

export class XMLHttpRequestStub {
  onload: any;
  onerror: any;
  onabort: any;
  upload = {
    addEventListener: vi.fn(),
    onprogress: null,
  };
  status = 0;
  responseText = '';
  readyState = 0;

  constructor() {
    (globalThis as any).__lastXHR = this;
  }

  open() {}
  setRequestHeader() {}
  send() {
    setTimeout(() => {
      this.status = 200;
      this.responseText = JSON.stringify({
        job_id: 'test-job-123',
        video_id: 456,
        queue_position: 0,
        original_url: 'https://example.com/video.mp4'
      });
      this.readyState = 4;
      this.onload?.();
    }, 0);
  }
  abort() {
    setTimeout(() => {
      this.onabort?.();
    }, 0);
  }

  __fail() {
    setTimeout(() => {
      const networkError = new ErrorEvent('error', {
        message: 'Network error during upload',
        error: new Error('Network error during upload')
      });
      this.onerror?.(networkError);
    }, 0);
  }
}

export const mockXMLHttpRequest = () => {
  (global as any).XMLHttpRequest = XMLHttpRequestStub as any;
  return XMLHttpRequestStub;
};

export const createMockFileReader = () => {
  const mockReader = {
    readAsDataURL: vi.fn(function(this: any) {
      setTimeout(() => {
        if (this.onload) {
          this.onload({ target: { result: 'data:video/mp4;base64,test' } });
        }
      }, 0);
    }),
    result: null,
    error: null,
    onload: null,
    onerror: null,
    onprogress: null,
  };
  return mockReader;
};

// Authentication mock helpers
export const mockSignedOut = (mockSupabaseClient: any) => {
  mockSupabaseClient.auth.getSession = vi.fn().mockResolvedValue({
    data: { session: null },
    error: null,
  });

  mockSupabaseClient.auth.getUser = vi.fn().mockResolvedValue({
    data: { user: null },
    error: null,
  });

  mockSupabaseClient.auth.onAuthStateChange = vi.fn(() => ({
    data: {
      subscription: {
        unsubscribe: vi.fn(),
      },
    },
  }));
};

export const mockSignedIn = (mockSupabaseClient: any, user?: any) => {
  const mockUser = user || {
    id: 'test-user-id',
    email: 'test@example.com',
    user_metadata: {
      full_name: 'Test User',
    },
  };

  const mockSession = {
    access_token: 'mock-token',
    refresh_token: 'mock-refresh',
    user: mockUser,
  };

  mockSupabaseClient.auth.getSession = vi.fn().mockResolvedValue({
    data: { session: mockSession },
    error: null,
  });

  mockSupabaseClient.auth.getUser = vi.fn().mockResolvedValue({
    data: { user: mockUser },
    error: null,
  });

  mockSupabaseClient.auth.onAuthStateChange = vi.fn(() => ({
    data: {
      subscription: {
        unsubscribe: vi.fn(),
      },
    },
  }));

  return { mockUser, mockSession };
};

// Enhanced fetch mock with error handling
export const mockFetchError = (errorMessage = 'Network error', status = 500) => {
  global.fetch = vi.fn(() =>
    Promise.reject(new Error(errorMessage))
  );
};

// Wait for auth state to resolve
export const waitForAuthState = (timeout = 100) => {
  return new Promise((resolve) => setTimeout(resolve, timeout));
};

// Setup common API mocks
export const setupApiMocks = () => {
  mockFetch({ message: 'OK', status: 'ok' }, true, 200);
};

// Cleanup all mocks
export const cleanupMocks = () => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
};

export const flushTimers = async (ms = 0) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
};

export const flushPromises = () => {
  return new Promise((resolve) => setTimeout(resolve, 0));
};
