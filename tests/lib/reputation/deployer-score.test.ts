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
    lpush: vi.fn(async (key: string, value: string) => {
      // Not used here but needed for completeness
    }),
    lrange: vi.fn(async () => []),
    zadd: vi.fn(async () => {}),
    zrange: vi.fn(async () => []),
  },
}));

// --- Env mock ---
vi.mock('@/lib/config/env', () => ({
  env: {
    SYSTEM_PRIVATE_KEY: '0x' + '05'.repeat(32),
    BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
    PINATA_JWT: 'test-jwt',
  },
}));

const testDeployerAddress = '0x' + 'aa'.repeat(20);

function seedDeployerProfile(address: string, score: number, agents: string[], flagged = 0) {
  kvStore.set(`deployer:${address}:profile`, {
    value: {
      address,
      linkedAgents: agents,
      deployerScore: score,
      totalAgentsDeployed: agents.length,
      flaggedAgents: flagged,
    },
  });
  // Set up reverse lookups
  for (const agentId of agents) {
    kvStore.set(`agent:${agentId}:deployer`, { value: address });
  }
}

function seedAgentReputation(agentId: string, score: number) {
  kvStore.set(`agent:${agentId}:reputation`, {
    value: { score, explanationCid: '', txHash: '', updatedAt: Date.now() },
  });
}

describe('Deployer Score', () => {
  beforeEach(() => {
    kvStore.clear();
    vi.clearAllMocks();
  });

  describe('getStartingBoost', () => {
    it('returns 0 when deployer has no profile', async () => {
      const { getStartingBoost } = await import('@/lib/reputation/deployer-score');
      const boost = await getStartingBoost('0x' + 'ff'.repeat(20));
      expect(boost).toBe(0);
    });

    it('returns min(0.5, deployerScore * 0.05) for score 5.0', async () => {
      seedDeployerProfile(testDeployerAddress, 5.0, ['agent-1']);
      const { getStartingBoost } = await import('@/lib/reputation/deployer-score');
      const boost = await getStartingBoost(testDeployerAddress);
      expect(boost).toBe(0.25); // 5.0 * 0.05 = 0.25
    });

    it('returns min(0.5, deployerScore * 0.05) for score 8.0', async () => {
      seedDeployerProfile(testDeployerAddress, 8.0, ['agent-1']);
      const { getStartingBoost } = await import('@/lib/reputation/deployer-score');
      const boost = await getStartingBoost(testDeployerAddress);
      expect(boost).toBe(0.4); // 8.0 * 0.05 = 0.4
    });

    it('caps boost at 0.5 for score 10.0', async () => {
      seedDeployerProfile(testDeployerAddress, 10.0, ['agent-1']);
      const { getStartingBoost } = await import('@/lib/reputation/deployer-score');
      const boost = await getStartingBoost(testDeployerAddress);
      expect(boost).toBe(0.5); // min(0.5, 10.0 * 0.05) = 0.5
    });

    it('returns 0 for deployer score 0', async () => {
      seedDeployerProfile(testDeployerAddress, 0, ['agent-1']);
      const { getStartingBoost } = await import('@/lib/reputation/deployer-score');
      const boost = await getStartingBoost(testDeployerAddress);
      expect(boost).toBe(0); // 0 * 0.05 = 0
    });
  });

  describe('recalculateDeployerScore', () => {
    it('computes weighted average: avg(agentScores) * 0.3 + ownScore * 0.7', async () => {
      seedDeployerProfile(testDeployerAddress, 5.0, ['agent-1', 'agent-2']);
      seedAgentReputation('agent-1', 8.0);
      seedAgentReputation('agent-2', 6.0);

      const { recalculateDeployerScore } = await import('@/lib/reputation/deployer-score');
      const newScore = await recalculateDeployerScore(testDeployerAddress);

      // avg(8.0, 6.0) = 7.0; 7.0 * 0.3 + 5.0 * 0.7 = 2.1 + 3.5 = 5.6
      expect(newScore).toBeCloseTo(5.6);
    });

    it('keeps own score when no agents have reputation data', async () => {
      seedDeployerProfile(testDeployerAddress, 5.0, ['agent-1']);
      // agent-1 has no reputation in KV

      const { recalculateDeployerScore } = await import('@/lib/reputation/deployer-score');
      const newScore = await recalculateDeployerScore(testDeployerAddress);

      expect(newScore).toBe(5.0); // No agent scores, keep own score
    });

    it('updates the deployer profile in KV', async () => {
      seedDeployerProfile(testDeployerAddress, 5.0, ['agent-1']);
      seedAgentReputation('agent-1', 9.0);

      const { recalculateDeployerScore } = await import('@/lib/reputation/deployer-score');
      await recalculateDeployerScore(testDeployerAddress);

      const stored = kvStore.get(`deployer:${testDeployerAddress}:profile`);
      const profile = stored!.value as { deployerScore: number };
      // 9.0 * 0.3 + 5.0 * 0.7 = 2.7 + 3.5 = 6.2
      expect(profile.deployerScore).toBeCloseTo(6.2);
    });

    it('clamps score to [0, 10]', async () => {
      seedDeployerProfile(testDeployerAddress, 10.0, ['agent-1']);
      seedAgentReputation('agent-1', 10.0);

      const { recalculateDeployerScore } = await import('@/lib/reputation/deployer-score');
      const newScore = await recalculateDeployerScore(testDeployerAddress);

      // 10.0 * 0.3 + 10.0 * 0.7 = 10.0
      expect(newScore).toBeLessThanOrEqual(10.0);
      expect(newScore).toBeGreaterThanOrEqual(0);
    });

    it('returns own score when deployer not found', async () => {
      const { recalculateDeployerScore } = await import('@/lib/reputation/deployer-score');
      // No profile exists, should create one with default 5.0
      const newScore = await recalculateDeployerScore('0x' + 'ff'.repeat(20));
      expect(newScore).toBe(5.0);
    });
  });

  describe('applyAgentCivicFlag', () => {
    it('applies -1.0 penalty to deployer score per flagged agent', async () => {
      seedDeployerProfile(testDeployerAddress, 5.0, ['agent-1']);

      const { applyAgentCivicFlag } = await import('@/lib/reputation/deployer-score');
      await applyAgentCivicFlag('agent-1');

      const stored = kvStore.get(`deployer:${testDeployerAddress}:profile`);
      const profile = stored!.value as { deployerScore: number; flaggedAgents: number };
      expect(profile.deployerScore).toBe(4.0); // 5.0 - 1.0
      expect(profile.flaggedAgents).toBe(1);
    });

    it('stacks penalties for multiple flagged agents', async () => {
      seedDeployerProfile(testDeployerAddress, 7.0, ['agent-1', 'agent-2', 'agent-3']);

      const { applyAgentCivicFlag } = await import('@/lib/reputation/deployer-score');
      await applyAgentCivicFlag('agent-1');
      await applyAgentCivicFlag('agent-2');
      await applyAgentCivicFlag('agent-3');

      const stored = kvStore.get(`deployer:${testDeployerAddress}:profile`);
      const profile = stored!.value as { deployerScore: number; flaggedAgents: number };
      expect(profile.deployerScore).toBe(4.0); // 7.0 - 3.0
      expect(profile.flaggedAgents).toBe(3);
    });

    it('does not go below 0', async () => {
      seedDeployerProfile(testDeployerAddress, 0.5, ['agent-1']);

      const { applyAgentCivicFlag } = await import('@/lib/reputation/deployer-score');
      await applyAgentCivicFlag('agent-1');

      const stored = kvStore.get(`deployer:${testDeployerAddress}:profile`);
      const profile = stored!.value as { deployerScore: number };
      expect(profile.deployerScore).toBe(0);
    });

    it('does nothing when agent has no deployer', async () => {
      const { applyAgentCivicFlag } = await import('@/lib/reputation/deployer-score');
      // Should not throw
      await expect(applyAgentCivicFlag('unlinked-agent')).resolves.not.toThrow();
    });

    it('emits DEPLOYER_SCORE_UPDATED event', async () => {
      seedDeployerProfile(testDeployerAddress, 5.0, ['agent-1']);

      const { applyAgentCivicFlag } = await import('@/lib/reputation/deployer-score');
      await applyAgentCivicFlag('agent-1');

      const { kv } = await import('@vercel/kv');
      const zaddCalls = (kv.zadd as ReturnType<typeof vi.fn>).mock.calls;
      expect(zaddCalls.length).toBeGreaterThan(0);
      const lastCall = zaddCalls[zaddCalls.length - 1];
      const event = JSON.parse(lastCall[1].member);
      expect(event.type).toBe('deployer:score-updated');
    });
  });
});
