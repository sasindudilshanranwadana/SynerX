import '@testing-library/jest-dom';
import { afterEach, vi, beforeAll, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';

beforeAll(() => {
  Object.defineProperty(import.meta, 'env', {
    value: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_RUNPOD_URL: 'http://localhost:8000',
      VITE_RUNPOD_API_KEY: 'test-api-key',
      VITE_BACKEND_URL: 'https://test.backend.net',
      VITE_CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
      VITE_R2_ACCESS_KEY_ID: 'test-access-key',
      VITE_R2_SECRET_ACCESS_KEY: 'test-secret-key',
      VITE_R2_BUCKET_NAME: 'test-bucket',
      MODE: 'test',
      DEV: false,
      PROD: false,
      SSR: false,
    },
    writable: true,
    configurable: true,
  });

  // Default fetch mock for health checks and general API calls
  global.fetch = vi.fn((url: string | URL | Request) => {
    const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

    // RunPod health check
    if (urlString.includes('/health')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: 'SynerX API is running!', status: 'ok' }),
        text: () => Promise.resolve(JSON.stringify({ message: 'SynerX API is running!', status: 'ok' })),
      } as Response);
    }

    // Default response
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ message: 'OK', status: 'ok' }),
      text: () => Promise.resolve(JSON.stringify({ message: 'OK', status: 'ok' })),
    } as Response);
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
});

vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})));

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(() => null),
    removeItem: vi.fn(() => null),
    clear: vi.fn(() => null),
  },
  writable: true,
});
