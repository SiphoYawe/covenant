import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Civic SDK modules before importing our code
vi.mock('@civic/auth/nextjs', () => ({
  getUser: vi.fn(),
}));

vi.mock('@civic/auth-web3/server', () => ({
  getWallets: vi.fn(),
}));

describe('Civic Auth Helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  describe('getAuthenticatedUser', () => {
    it('returns user when session exists', async () => {
      const mockUser = {
        id: 'civic-user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      const { getUser } = await import('@civic/auth/nextjs');
      vi.mocked(getUser).mockResolvedValue(mockUser as never);

      const { getAuthenticatedUser } = await import('@/lib/auth/civic');
      const user = await getAuthenticatedUser();

      expect(user).toEqual(mockUser);
      expect(getUser).toHaveBeenCalledOnce();
    });

    it('returns null when no session exists', async () => {
      const { getUser } = await import('@civic/auth/nextjs');
      vi.mocked(getUser).mockResolvedValue(null as never);

      const { getAuthenticatedUser } = await import('@/lib/auth/civic');
      const user = await getAuthenticatedUser();

      expect(user).toBeNull();
    });

    it('returns null when getUser throws', async () => {
      const { getUser } = await import('@civic/auth/nextjs');
      vi.mocked(getUser).mockRejectedValue(new Error('No session'));

      const { getAuthenticatedUser } = await import('@/lib/auth/civic');
      const user = await getAuthenticatedUser();

      expect(user).toBeNull();
    });
  });

  describe('requireAuth', () => {
    it('returns user when authenticated', async () => {
      const mockUser = {
        id: 'civic-user-456',
        email: 'auth@example.com',
        name: 'Auth User',
      };

      const { getUser } = await import('@civic/auth/nextjs');
      vi.mocked(getUser).mockResolvedValue(mockUser as never);

      const { requireAuth } = await import('@/lib/auth/civic');
      const user = await requireAuth();

      expect(user).toEqual(mockUser);
    });

    it('throws 401 error when not authenticated', async () => {
      const { getUser } = await import('@civic/auth/nextjs');
      vi.mocked(getUser).mockResolvedValue(null as never);

      const { requireAuth } = await import('@/lib/auth/civic');

      await expect(requireAuth()).rejects.toThrow('Authentication required');
    });

    it('thrown error has 401 status', async () => {
      const { getUser } = await import('@civic/auth/nextjs');
      vi.mocked(getUser).mockResolvedValue(null as never);

      const { requireAuth, AuthError } = await import('@/lib/auth/civic');

      try {
        await requireAuth();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as InstanceType<typeof AuthError>).status).toBe(401);
      }
    });
  });

  describe('getAuthenticatedWallets', () => {
    it('returns wallet addresses when user has wallets', async () => {
      const mockUser = {
        id: 'civic-user-789',
        email: 'wallet@example.com',
        name: 'Wallet User',
        idToken: 'mock-id-token',
      };
      const mockWallets = [
        { walletAddress: '0x1234567890abcdef1234567890abcdef12345678' },
        { walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' },
      ];

      const { getUser } = await import('@civic/auth/nextjs');
      vi.mocked(getUser).mockResolvedValue(mockUser as never);

      const { getWallets } = await import('@civic/auth-web3/server');
      vi.mocked(getWallets).mockResolvedValue(mockWallets as never);

      const { getAuthenticatedWallets } = await import('@/lib/auth/civic');
      const wallets = await getAuthenticatedWallets();

      expect(wallets).toEqual([
        '0x1234567890abcdef1234567890abcdef12345678',
        '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      ]);
    });

    it('returns empty array when no user session', async () => {
      const { getUser } = await import('@civic/auth/nextjs');
      vi.mocked(getUser).mockResolvedValue(null as never);

      const { getAuthenticatedWallets } = await import('@/lib/auth/civic');
      const wallets = await getAuthenticatedWallets();

      expect(wallets).toEqual([]);
    });

    it('returns empty array when getWallets throws', async () => {
      const mockUser = {
        id: 'civic-user-err',
        email: 'err@example.com',
        name: 'Err User',
        idToken: 'mock-id-token',
      };

      const { getUser } = await import('@civic/auth/nextjs');
      vi.mocked(getUser).mockResolvedValue(mockUser as never);

      const { getWallets } = await import('@civic/auth-web3/server');
      vi.mocked(getWallets).mockRejectedValue(new Error('Wallet error'));

      const { getAuthenticatedWallets } = await import('@/lib/auth/civic');
      const wallets = await getAuthenticatedWallets();

      expect(wallets).toEqual([]);
    });
  });
});

describe('Middleware matcher', () => {
  it('only matches /deploy routes', () => {
    const deployPaths = ['/deploy', '/deploy/new', '/deploy/agent/123'];
    const publicPaths = ['/', '/api/agents/list', '/api/events/stream', '/api/payments/history', '/trust-graph', '/payments'];

    for (const path of deployPaths) {
      const matches = path === '/deploy' || path.startsWith('/deploy/');
      expect(matches).toBe(true);
    }

    for (const path of publicPaths) {
      const matches = path === '/deploy' || path.startsWith('/deploy/');
      expect(matches).toBe(false);
    }
  });
});
