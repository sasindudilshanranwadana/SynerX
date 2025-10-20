import { vi } from 'vitest';
import { mockVideo, mockTrackingResult, mockVehicleCount, mockProcessingJob } from '../fixtures/mockData';

const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  user_metadata: {
    full_name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
  },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
};

const mockSession = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: mockUser,
};

const createQueryBuilder = (tableName: string, initialData: any[] = []) => {
  let queryData = [...initialData];
  let queryFilters: any[] = [];
  let isInsert = false;
  let isUpdate = false;
  let isDelete = false;

  const builder: any = {
    select: vi.fn().mockImplementation((columns = '*') => {
      return builder;
    }),
    insert: vi.fn().mockImplementation((data) => {
      isInsert = true;
      queryData = Array.isArray(data) ? [...data] : [data];
      return builder;
    }),
    update: vi.fn().mockImplementation((data) => {
      isUpdate = true;
      return builder;
    }),
    delete: vi.fn().mockImplementation(() => {
      isDelete = true;
      return builder;
    }),
    eq: vi.fn().mockImplementation((column, value) => {
      queryFilters.push({ type: 'eq', column, value });
      if (queryFilters.length > 0) {
        queryData = queryData.filter((item) => {
          return queryFilters.every((filter) => {
            if (filter.type === 'eq') {
              return item[filter.column] === filter.value;
            }
            return true;
          });
        });
      }
      return builder;
    }),
    neq: vi.fn().mockImplementation((column, value) => {
      queryFilters.push({ type: 'neq', column, value });
      return builder;
    }),
    gt: vi.fn().mockImplementation((column, value) => {
      queryFilters.push({ type: 'gt', column, value });
      return builder;
    }),
    lt: vi.fn().mockImplementation((column, value) => {
      queryFilters.push({ type: 'lt', column, value });
      return builder;
    }),
    gte: vi.fn().mockImplementation((column, value) => {
      queryFilters.push({ type: 'gte', column, value });
      return builder;
    }),
    lte: vi.fn().mockImplementation((column, value) => {
      queryFilters.push({ type: 'lte', column, value });
      return builder;
    }),
    order: vi.fn().mockImplementation((column, options) => {
      const ascending = options?.ascending !== false;
      queryData.sort((a, b) => {
        const aVal = a[column];
        const bVal = b[column];
        if (ascending) {
          return aVal > bVal ? 1 : -1;
        }
        return aVal < bVal ? 1 : -1;
      });
      return builder;
    }),
    limit: vi.fn().mockImplementation((count) => {
      queryData = queryData.slice(0, count);
      return builder;
    }),
    range: vi.fn().mockImplementation((from, to) => {
      queryData = queryData.slice(from, to + 1);
      return builder;
    }),
    single: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        data: queryData[0] || null,
        error: queryData.length === 0 ? { code: 'PGRST116', message: 'No rows found' } : null,
      });
    }),
    maybeSingle: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        data: queryData[0] || null,
        error: null
      });
    }),
    then: vi.fn().mockImplementation((resolve) => {
      return Promise.resolve({ data: queryData, error: null }).then(resolve);
    }),
  };

  return builder;
};

export const mockSupabaseClient = {
  auth: {
    getSession: vi.fn(() => Promise.resolve({
      data: { session: mockSession },
      error: null,
    })),
    getUser: vi.fn(() => Promise.resolve({
      data: { user: mockUser },
      error: null,
    })),
    signInWithPassword: vi.fn().mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    }),
    signUp: vi.fn().mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({
      error: null,
    }),
    updateUser: vi.fn().mockResolvedValue({
      data: { user: mockUser },
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
    onAuthStateChange: vi.fn((callback) => {
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      };
    }),
    refreshSession: vi.fn().mockResolvedValue({
      data: { session: mockSession, user: mockUser },
      error: null,
    }),
  },
  from: vi.fn((table: string) => {
    let mockData: any[] = [];

    switch (table) {
      case 'videos':
        mockData = [
          { ...mockVideo },
          { ...mockVideo, id: 2, video_name: 'test-video-2', status: 'processing' },
        ];
        break;
      case 'tracking_results':
        mockData = [
          { ...mockTrackingResult },
          { ...mockTrackingResult, tracker_id: 102, compliance: 0 },
        ];
        break;
      case 'vehicle_counts':
        mockData = [
          { ...mockVehicleCount },
          { ...mockVehicleCount, id: 2, vehicle_type: 'truck', count: 5 },
        ];
        break;
      case 'processing_jobs':
        mockData = [
          { ...mockProcessingJob },
          { ...mockProcessingJob, id: 2, job_id: 'job-456', status: 'processing' },
        ];
        break;
      default:
        mockData = [];
    }

    return createQueryBuilder(table, mockData);
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

export const createMockSupabaseClient = () => mockSupabaseClient;

vi.mock('../../lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('../../lib/supabase')>('../../lib/supabase');
  return {
    ...actual,
    supabase: mockSupabaseClient,
  };
});
