import { vi } from 'vitest';

type QueryResult<T = any> = Promise<{ data: T; error: null }>;

const createChainableQuery = <T = any>(data: T) => {
  const chain: any = {
    select: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve({ data, error: null }) as QueryResult<T>),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    gt: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    in: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error: null })),
    then: vi.fn((resolve) => Promise.resolve({ data, error: null }).then(resolve)),
  };
  return chain;
};

interface SupabaseMockOptions {
  recent?: any[];
  analytics?: { processedVideos: number; violations: number };
  videos?: any[];
}

export const makeSupabaseMock = (opts?: SupabaseMockOptions) => {
  const recent = opts?.recent ?? [];
  const analytics = opts?.analytics ?? { processedVideos: 0, violations: 0 };
  const videos = opts?.videos ?? [];

  return {
    auth: {
      getSession: vi.fn(() => Promise.resolve({
        data: { session: null },
        error: null,
      })),
      getUser: vi.fn(() => Promise.resolve({
        data: { user: null },
        error: null,
      })),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      }),
      signUp: vi.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({
        error: null,
      }),
      updateUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({
        data: {},
        error: null,
      }),
      resend: vi.fn().mockResolvedValue({
        data: {},
        error: null,
      }),
      onAuthStateChange: vi.fn((cb) => {
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      refreshSession: vi.fn().mockResolvedValue({
        data: { session: null, user: null },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'recent_activity') return createChainableQuery(recent);
      if (table === 'analytics_view') return createChainableQuery([analytics]);
      if (table === 'videos') return createChainableQuery(videos);
      return createChainableQuery([]);
    }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({
          data: { path: 'videos/test-video.mp4', id: 'test-id', fullPath: 'videos/test-video.mp4' },
          error: null,
        }),
        getPublicUrl: vi.fn((path: string) => ({
          data: { publicUrl: `https://example.com/${path}` },
        })),
        download: vi.fn().mockResolvedValue({
          data: new Blob(['test'], { type: 'video/mp4' }),
          error: null,
        }),
        remove: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
        list: vi.fn().mockResolvedValue({
          data: [
            { name: 'test-video.mp4', id: 'test-id', updated_at: new Date().toISOString() },
          ],
          error: null,
        }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://example.com/signed-url' },
          error: null,
        }),
      })),
    },
    channel: vi.fn((channelName: string) => {
      const subscriptions: any[] = [];
      return {
        on: vi.fn().mockImplementation((event, filter, callback) => {
          subscriptions.push({ event, filter, callback });
          return {
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn().mockImplementation(() => {
              return {
                unsubscribe: vi.fn(),
              };
            }),
          };
        }),
        subscribe: vi.fn().mockImplementation(() => {
          return {
            unsubscribe: vi.fn(),
          };
        }),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
      };
    }),
    removeChannel: vi.fn().mockResolvedValue({ error: null }),
    rpc: vi.fn().mockResolvedValue({
      data: null,
      error: null,
    }),
  };
};
