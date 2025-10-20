import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const mockSupabaseClient = {
  auth: {
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
    getUser: vi.fn().mockResolvedValue({
      data: { user: mockUser },
      error: null,
    }),
    getSession: vi.fn().mockResolvedValue({
      data: { session: mockSession },
      error: null,
    }),
  },
};

vi.mock('../supabase', () => ({
  supabase: mockSupabaseClient,
  signInWithEmail: async (email: string, password: string) => {
    const { data, error } = await mockSupabaseClient.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },
  signUpWithEmail: async (email: string, password: string) => {
    const { data, error } = await mockSupabaseClient.auth.signUp({
      email,
      password
    });
    if (error) throw error;
    return data;
  },
  signOut: async () => {
    const { error } = await mockSupabaseClient.auth.signOut();
    if (error) throw error;
  },
  getCurrentUser: async () => {
    const { data: { user }, error } = await mockSupabaseClient.auth.getUser();
    if (error) throw error;
    return user;
  },
  getSession: async () => {
    const { data: { session }, error } = await mockSupabaseClient.auth.getSession();
    if (error) throw error;
    return session;
  },
}));

describe('Supabase Authentication', () => {
  let signInWithEmail: any;
  let signUpWithEmail: any;
  let signOut: any;
  let getCurrentUser: any;
  let getSession: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    });
    mockSupabaseClient.auth.signUp.mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    });
    mockSupabaseClient.auth.signOut.mockResolvedValue({
      error: null,
    });
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });

    const supabaseFns = await import('../supabase');
    signInWithEmail = supabaseFns.signInWithEmail;
    signUpWithEmail = supabaseFns.signUpWithEmail;
    signOut = supabaseFns.signOut;
    getCurrentUser = supabaseFns.getCurrentUser;
    getSession = supabaseFns.getSession;
  });

  describe('signInWithEmail', () => {
    it('should sign in user with email and password', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      const result = await signInWithEmail(email, password);

      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email,
        password,
      });
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('session');
    });

    it('should throw error on invalid credentials', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' },
      });

      await expect(signInWithEmail('wrong@example.com', 'wrong')).rejects.toThrow();
    });
  });

  describe('signUpWithEmail', () => {
    it('should create new user account', async () => {
      const email = 'newuser@example.com';
      const password = 'password123';

      const result = await signUpWithEmail(email, password);

      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email,
        password,
      });
      expect(result).toHaveProperty('user');
    });

    it('should throw error if email already exists', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: null,
        error: { message: 'User already registered' },
      });

      await expect(signUpWithEmail('existing@example.com', 'password')).rejects.toThrow();
    });
  });

  describe('signOut', () => {
    it('should sign out current user', async () => {
      await signOut();

      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
    });

    it('should handle sign out errors gracefully', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: { message: 'Sign out failed' },
      });

      await expect(signOut()).rejects.toThrow();
    });
  });

  describe('getCurrentUser', () => {
    it('should return current authenticated user', async () => {
      const user = await getCurrentUser();

      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
    });

    it('should return null if no user is authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const user = await getCurrentUser();
      expect(user).toBeNull();
    });
  });

  describe('getSession', () => {
    it('should return current session', async () => {
      const session = await getSession();

      expect(mockSupabaseClient.auth.getSession).toHaveBeenCalled();
      expect(session).toHaveProperty('access_token');
      expect(session).toHaveProperty('user');
    });

    it('should return null if no active session', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const session = await getSession();
      expect(session).toBeNull();
    });
  });
});
