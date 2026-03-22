import { describe, it, expect, vi, beforeEach } from 'vitest';
import { kvStore, zaddCalls, clearKvStore, createKvMock } from '../../helpers/kv-mock';

// --- Mock KV at the abstraction boundary ---
vi.mock('@/lib/storage/kv', () => createKvMock());

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
    clearKvStore();
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
      expect(boost).toBe(0.25);
    });

    it('returns min(0.5, deployerScore * 0.05) for score 8.0', async () => {
      seedDeployerProfile(testDeployerAddress, 8.0, ['agent-1']);
      const { getStartingBoost } = await import('@/lib/reputation/deployer-score');
      const boost = await getStartingBoost(testDeployerAddress);
      expect(boost).toBe(0.4);
    });

    it('caps boost at 0.5 for score 10.0', async () => {
      seedDeployerProfile(testDeployerAddress, 10.0, ['agent-1']);
      const { getStartingBoost } = await import('@/lib/reputation/deployer-score');
      const boost = await getStartingBoost(testDeployerAddress);
      expect(boost).toBe(0.5);
    });

    it('returns 0 for deployer score 0', async () => {
      seedDeployerProfile(testDeployerAddress, 0, ['agent-1']);
      const { getStartingBoost } = await import('@/lib/reputation/deployer-score');
      const boost = await getStartingBoost(testDeployerAddress);
      expect(boost).toBe(0);
    });
  });

  describe('recalculateDeployerScore', () => {
    it('computes weighted average: avg(agentScores) * 0.3 + ownScore * 0.7', async () => {
      seedDeployerProfile(testDeployerAddress, 5.0, ['agent-1', 'agent-2']);
      seedAgentReputation('agent-1', 8.0);
      seedAgentReputation('agent-2', 6.0);

      const { recalculateDeployerScore } = await import('@/lib/reputation/deployer-score');
      const newScore = await recalculateDeployerScore(testDeployerAddress);

      expect(newScore).toBeCloseTo(5.6);
    });

    it('keeps own score when no agents have reputation data', async () => {
      seedDeployerProfile(testDeployerAddress, 5.0, ['agent-1']);
      const { recalculateDeployerScore } = await import('@/lib/reputation/deployer-score');
      const newScore = await recalculateDeployerScore(testDeployerAddress);
      expect(newScore).toBe(5.0);
    });

    it('updates the deployer profile in KV', async () => {
      seedDeployerProfile(testDeployerAddress, 5.0, ['agent-1']);
      seedAgentReputation('agent-1', 9.0);

      const { recalculateDeployerScore } = await import('@/lib/reputation/deployer-score');
      await recalculateDeployerScore(testDeployerAddress);

      const stored = kvStore.get(`deployer:${testDeployerAddress}:profile`);
      const profile = stored!.value as { deployerScore: number };
      expect(profile.deployerScore).toBeCloseTo(6.2);
    });

    it('clamps score to [0, 10]', async () => {
      seedDeployerProfile(testDeployerAddress, 10.0, ['agent-1']);
      seedAgentReputation('agent-1', 10.0);

      const { recalculateDeployerScore } = await import('@/lib/reputation/deployer-score');
      const newScore = await recalculateDeployerScore(testDeployerAddress);

      expect(newScore).toBeLessThanOrEqual(10.0);
      expect(newScore).toBeGreaterThanOrEqual(0);
    });

    it('returns own score when deployer not found', async () => {
      const { recalculateDeployerScore } = await import('@/lib/reputation/deployer-score');
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
      expect(profile.deployerScore).toBe(4.0);
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
      expect(profile.deployerScore).toBe(4.0);
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
      await expect(applyAgentCivicFlag('unlinked-agent')).resolves.not.toThrow();
    });

    it('emits DEPLOYER_SCORE_UPDATED event', async () => {
      seedDeployerProfile(testDeployerAddress, 5.0, ['agent-1']);

      const { applyAgentCivicFlag } = await import('@/lib/reputation/deployer-score');
      await applyAgentCivicFlag('agent-1');

      expect(zaddCalls.length).toBeGreaterThan(0);
      const lastCall = zaddCalls[zaddCalls.length - 1];
      const event = JSON.parse((lastCall[1] as { member: string }).member);
      expect(event.type).toBe('deployer:score-updated');
      expect(event.data.deployerAddress).toBe(testDeployerAddress);
      expect(event.data.newScore).toBe(4.0);
      expect(event.data.reason).toBe('civic-flag');
    });
  });
});
