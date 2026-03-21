import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- In-memory KV mock ---
const kvStore = new Map<string, { value: unknown; expiresAt?: number }>();

vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(async (key: string) => {
      const entry = kvStore.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        kvStore.delete(key);
        return null;
      }
      return entry.value;
    }),
    set: vi.fn(async (key: string, value: unknown, options?: { ex?: number }) => {
      const entry: { value: unknown; expiresAt?: number } = { value };
      if (options?.ex) {
        entry.expiresAt = Date.now() + options.ex * 1000;
      }
      kvStore.set(key, entry);
    }),
    del: vi.fn(async (key: string) => {
      kvStore.delete(key);
    }),
    zadd: vi.fn(async () => {}),
    zrange: vi.fn(async () => []),
  },
}));

describe('Deployer Profile Management', () => {
  beforeEach(() => {
    kvStore.clear();
    vi.clearAllMocks();
  });

  const testAddress = '0x' + 'aa'.repeat(20);

  describe('getOrCreateDeployerProfile', () => {
    it('creates a new profile with default score 5.0 when none exists', async () => {
      const { getOrCreateDeployerProfile } = await import('@/lib/deploy/deployer');
      const profile = await getOrCreateDeployerProfile(testAddress);

      expect(profile.address).toBe(testAddress);
      expect(profile.deployerScore).toBe(5.0);
      expect(profile.linkedAgents).toEqual([]);
      expect(profile.totalAgentsDeployed).toBe(0);
      expect(profile.flaggedAgents).toBe(0);
    });

    it('returns existing profile when one exists', async () => {
      const { getOrCreateDeployerProfile } = await import('@/lib/deploy/deployer');

      // Create initial profile
      const first = await getOrCreateDeployerProfile(testAddress);
      expect(first.deployerScore).toBe(5.0);

      // Modify score in KV to verify it reads existing
      const modified = { ...first, deployerScore: 7.5 };
      kvStore.set(`deployer:${testAddress}:profile`, { value: modified });

      const second = await getOrCreateDeployerProfile(testAddress);
      expect(second.deployerScore).toBe(7.5);
    });

    it('persists the profile to KV', async () => {
      const { getOrCreateDeployerProfile } = await import('@/lib/deploy/deployer');
      await getOrCreateDeployerProfile(testAddress);

      const stored = kvStore.get(`deployer:${testAddress}:profile`);
      expect(stored).toBeDefined();
      expect((stored!.value as Record<string, unknown>).address).toBe(testAddress);
    });
  });

  describe('addLinkedAgent', () => {
    it('appends agent to deployer linked agents list', async () => {
      const { getOrCreateDeployerProfile, addLinkedAgent } = await import('@/lib/deploy/deployer');
      await getOrCreateDeployerProfile(testAddress);

      await addLinkedAgent(testAddress, 'agent-1');

      const stored = kvStore.get(`deployer:${testAddress}:profile`);
      const profile = stored!.value as { linkedAgents: string[]; totalAgentsDeployed: number };
      expect(profile.linkedAgents).toContain('agent-1');
      expect(profile.totalAgentsDeployed).toBe(1);
    });

    it('stores reverse lookup from agent to deployer', async () => {
      const { getOrCreateDeployerProfile, addLinkedAgent } = await import('@/lib/deploy/deployer');
      await getOrCreateDeployerProfile(testAddress);

      await addLinkedAgent(testAddress, 'agent-1');

      const reverse = kvStore.get('agent:agent-1:deployer');
      expect(reverse).toBeDefined();
      expect(reverse!.value).toBe(testAddress);
    });

    it('handles multiple linked agents', async () => {
      const { getOrCreateDeployerProfile, addLinkedAgent } = await import('@/lib/deploy/deployer');
      await getOrCreateDeployerProfile(testAddress);

      await addLinkedAgent(testAddress, 'agent-1');
      await addLinkedAgent(testAddress, 'agent-2');
      await addLinkedAgent(testAddress, 'agent-3');

      const stored = kvStore.get(`deployer:${testAddress}:profile`);
      const profile = stored!.value as { linkedAgents: string[]; totalAgentsDeployed: number };
      expect(profile.linkedAgents).toHaveLength(3);
      expect(profile.totalAgentsDeployed).toBe(3);
    });

    it('creates deployer profile if it does not exist', async () => {
      const { addLinkedAgent } = await import('@/lib/deploy/deployer');
      await addLinkedAgent(testAddress, 'agent-1');

      const stored = kvStore.get(`deployer:${testAddress}:profile`);
      expect(stored).toBeDefined();
      const profile = stored!.value as { deployerScore: number; linkedAgents: string[] };
      expect(profile.deployerScore).toBe(5.0);
      expect(profile.linkedAgents).toContain('agent-1');
    });
  });

  describe('getDeployerProfile', () => {
    it('returns full profile with stats', async () => {
      const { getOrCreateDeployerProfile, addLinkedAgent, getDeployerProfile } = await import('@/lib/deploy/deployer');
      await getOrCreateDeployerProfile(testAddress);
      await addLinkedAgent(testAddress, 'agent-1');
      await addLinkedAgent(testAddress, 'agent-2');

      const profile = await getDeployerProfile(testAddress);
      expect(profile).not.toBeNull();
      expect(profile!.address).toBe(testAddress);
      expect(profile!.linkedAgents).toHaveLength(2);
      expect(profile!.totalAgentsDeployed).toBe(2);
    });

    it('returns null when no profile exists', async () => {
      const { getDeployerProfile } = await import('@/lib/deploy/deployer');
      const profile = await getDeployerProfile('0x' + 'ff'.repeat(20));
      expect(profile).toBeNull();
    });
  });

  describe('getDeployerForAgent', () => {
    it('returns deployer address for a linked agent', async () => {
      const { getOrCreateDeployerProfile, addLinkedAgent, getDeployerForAgent } = await import('@/lib/deploy/deployer');
      await getOrCreateDeployerProfile(testAddress);
      await addLinkedAgent(testAddress, 'agent-1');

      const deployer = await getDeployerForAgent('agent-1');
      expect(deployer).toBe(testAddress);
    });

    it('returns null for unlinked agent', async () => {
      const { getDeployerForAgent } = await import('@/lib/deploy/deployer');
      const deployer = await getDeployerForAgent('unknown-agent');
      expect(deployer).toBeNull();
    });
  });
});
