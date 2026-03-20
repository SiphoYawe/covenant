import { describe, it, expect, vi, beforeEach } from 'vitest';
import { routeTask } from '@/lib/orchestrator/task-router';
import type { RoutingConfig } from '@/lib/orchestrator/types';

// --- Mocks ---

const mockEmit = vi.fn().mockResolvedValue({ id: 'test', timestamp: Date.now() });

vi.mock('@/lib/events/bus', () => ({
  createEventBus: vi.fn(() => ({
    emit: mockEmit,
    since: vi.fn().mockResolvedValue([]),
  })),
}));

const mockKvGet = vi.fn();
const mockKvLrange = vi.fn();

vi.mock('@/lib/storage/kv', () => ({
  kvGet: (...args: unknown[]) => mockKvGet(...args),
  kvSet: vi.fn(),
  kvDel: vi.fn(),
  kvLrange: (...args: unknown[]) => mockKvLrange(...args),
  kvLpush: vi.fn(),
}));

// --- Test data ---

function setupAgents(agents: Array<{
  agentId: string;
  role: string;
  reputation?: number;
}>) {
  // Return agent IDs from demo:agents list
  mockKvLrange.mockResolvedValue(agents.map((a) => a.agentId));

  // Return profiles and reputation for each agent
  mockKvGet.mockImplementation((key: string) => {
    for (const agent of agents) {
      if (key === `agent:${agent.agentId}:profile`) {
        return Promise.resolve({
          agentId: agent.agentId,
          role: agent.role,
          address: '0x1234',
        });
      }
      if (key === `agent:${agent.agentId}:reputation`) {
        if (agent.reputation !== undefined) {
          return Promise.resolve({ score: agent.reputation });
        }
        return Promise.resolve(null); // No reputation data
      }
    }
    return Promise.resolve(null);
  });
}

describe('routeTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes to highest-reputation agent among qualified candidates', async () => {
    setupAgents([
      { agentId: 'agent-b', role: 'reviewer', reputation: 9.1 },
      { agentId: 'agent-c', role: 'summarizer', reputation: 8.5 },
    ]);

    const config: RoutingConfig = {
      capability: 'review_code',
      reputationThreshold: 3.0,
    };

    const result = await routeTask(config);

    expect(result.selectedAgentId).toBe('agent-b');
    expect(result.capability).toBe('review_code');
    expect(result.candidates).toHaveLength(1); // Only reviewer has review_code
    expect(result.reason).toContain('9.1');
  });

  it('excludes agents below reputation threshold', async () => {
    setupAgents([
      { agentId: 'agent-b', role: 'reviewer', reputation: 9.1 },
      { agentId: 'agent-d', role: 'malicious', reputation: 1.2 },
    ]);

    const config: RoutingConfig = {
      capability: 'review_code',
      reputationThreshold: 3.0,
    };

    const result = await routeTask(config);

    expect(result.selectedAgentId).toBe('agent-b');
    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0].agentId).toBe('agent-d');
    expect(result.excluded[0].reputationScore).toBe(1.2);
    expect(result.excluded[0].exclusionReason).toContain('below threshold');
  });

  it('returns NO_QUALIFIED_AGENTS error when no agents qualify', async () => {
    setupAgents([
      { agentId: 'agent-d', role: 'malicious', reputation: 1.2 },
    ]);

    const config: RoutingConfig = {
      capability: 'review_code',
      reputationThreshold: 3.0,
    };

    await expect(routeTask(config)).rejects.toThrow('NO_QUALIFIED_AGENTS');
  });

  it('assigns default neutral score (5.0) to agents without reputation data', async () => {
    setupAgents([
      { agentId: 'agent-b', role: 'reviewer' }, // No reputation
    ]);

    const config: RoutingConfig = {
      capability: 'review_code',
      reputationThreshold: 3.0,
    };

    const result = await routeTask(config);

    expect(result.selectedAgentId).toBe('agent-b');
    expect(result.candidates[0].reputationScore).toBe(5.0);
  });

  it('emits orchestrator:routed event on successful routing', async () => {
    setupAgents([
      { agentId: 'agent-b', role: 'reviewer', reputation: 8.0 },
    ]);

    const config: RoutingConfig = {
      capability: 'review_code',
      reputationThreshold: 3.0,
    };

    await routeTask(config);

    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'orchestrator:routed',
        agentId: 'agent-b',
      })
    );
  });

  it('emits orchestrator:routing-failed event when no agents qualify', async () => {
    setupAgents([
      { agentId: 'agent-d', role: 'malicious', reputation: 1.2 },
    ]);

    const config: RoutingConfig = {
      capability: 'review_code',
      reputationThreshold: 3.0,
    };

    await expect(routeTask(config)).rejects.toThrow();

    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'orchestrator:routing-failed',
      })
    );
  });

  it('Agent D (score 1.2) excluded when threshold is 3.0', async () => {
    setupAgents([
      { agentId: 'agent-b', role: 'reviewer', reputation: 9.1 },
      { agentId: 'agent-d', role: 'malicious', reputation: 1.2 },
    ]);

    const config: RoutingConfig = {
      capability: 'review_code',
      reputationThreshold: 3.0,
    };

    const result = await routeTask(config);

    expect(result.selectedAgentId).toBe('agent-b');
    const excludedD = result.excluded.find((e) => e.agentId === 'agent-d');
    expect(excludedD).toBeDefined();
    expect(excludedD!.reputationScore).toBe(1.2);
  });

  it('Agent B (score 9.1) selected over Agent C (score 8.5) for same capability', async () => {
    // Both reviewer and malicious claim review_code capability
    setupAgents([
      { agentId: 'agent-c', role: 'reviewer', reputation: 8.5 },
      { agentId: 'agent-b', role: 'reviewer', reputation: 9.1 },
    ]);

    // Override to return two reviewers both with review_code
    mockKvGet.mockImplementation((key: string) => {
      if (key === 'agent:agent-c:profile') return Promise.resolve({ agentId: 'agent-c', role: 'reviewer', address: '0x1' });
      if (key === 'agent:agent-b:profile') return Promise.resolve({ agentId: 'agent-b', role: 'reviewer', address: '0x2' });
      if (key === 'agent:agent-c:reputation') return Promise.resolve({ score: 8.5 });
      if (key === 'agent:agent-b:reputation') return Promise.resolve({ score: 9.1 });
      return Promise.resolve(null);
    });

    const config: RoutingConfig = {
      capability: 'review_code',
      reputationThreshold: 3.0,
    };

    const result = await routeTask(config);

    expect(result.selectedAgentId).toBe('agent-b');
    expect(result.candidates[0].reputationScore).toBe(9.1);
    expect(result.candidates[1].reputationScore).toBe(8.5);
  });

  it('handles edge case: single agent available still checks threshold', async () => {
    setupAgents([
      { agentId: 'agent-b', role: 'reviewer', reputation: 2.0 },
    ]);

    const config: RoutingConfig = {
      capability: 'review_code',
      reputationThreshold: 3.0,
    };

    // Single agent below threshold should fail
    await expect(routeTask(config)).rejects.toThrow('NO_QUALIFIED_AGENTS');
  });

  it('handles edge case: no agents with matching capability', async () => {
    setupAgents([
      { agentId: 'agent-b', role: 'reviewer', reputation: 9.0 },
    ]);

    const config: RoutingConfig = {
      capability: 'nonexistent_capability',
      reputationThreshold: 3.0,
    };

    await expect(routeTask(config)).rejects.toThrow('NO_QUALIFIED_AGENTS');
  });
});
