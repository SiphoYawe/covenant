import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ActResult } from '@/lib/demo/types';

// --- Mocks ---

const mockEmit = vi.fn().mockResolvedValue({ id: 'e1', timestamp: Date.now() });
vi.mock('@/lib/events/bus', () => ({
  createEventBus: () => ({ emit: mockEmit, since: vi.fn().mockResolvedValue([]) }),
}));
vi.mock('@/lib/events/constants', () => ({
  EVENT_TYPES: {
    DEMO_ACT_CHANGED: 'demo:act-changed',
    DEMO_COMPLETE: 'demo:complete',
  },
}));
vi.mock('@/lib/events/types', () => ({
  Protocol: { CovenantAi: 'covenant-ai' },
}));

const mockRouteTask = vi.fn().mockResolvedValue({
  selectedAgentId: 'agent-b',
  excluded: [{ agentId: 'agent-d', reputationScore: 1.2, exclusionReason: 'below threshold' }],
  candidates: [{ agentId: 'agent-b', reputationScore: 9.1 }],
  capability: 'review_code',
  reason: 'Highest score',
});

const mockExecuteLifecycle = vi.fn().mockResolvedValue({
  success: true,
  selectedAgentId: 'agent-b',
  negotiatedPrice: 8,
  paymentTxHash: '0xpremium-tx',
  civicFlags: [],
});

vi.mock('@/lib/orchestrator', () => ({
  routeTask: (...args: unknown[]) => mockRouteTask(...args),
  executeLifecycle: (...args: unknown[]) => mockExecuteLifecycle(...args),
  updateDemoAct: vi.fn().mockResolvedValue({}),
  getDemoAgents: vi.fn().mockResolvedValue([
    { agentId: 'agent-a', tokenId: 't1', walletAddress: '0xa', registeredAt: 1000 },
    { agentId: 'agent-b', tokenId: 't2', walletAddress: '0xb', registeredAt: 1001 },
  ]),
  DemoAct: { Payoff: 'Payoff' },
  DemoStatus: { Running: 'Running', Completed: 'Completed', Failed: 'Failed' },
}));

vi.mock('@/lib/storage', () => ({
  kvGet: vi.fn().mockResolvedValue({ score: 9.1, explanationCid: 'Qm789' }),
}));

describe('Act 5: Payoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('demonstrates routing exclusion of Agent D', async () => {
    const { act5Payoff } = await import('@/lib/demo/acts/act-5-payoff');
    const result = await act5Payoff.execute({
      4: { act: 4, status: 'completed', duration: 400, events: [], data: {} },
    });

    expect(result.status).toBe('completed');
    expect(mockRouteTask).toHaveBeenCalledWith(
      expect.objectContaining({ reputationThreshold: 3.0 })
    );
  });

  it('executes premium pricing lifecycle', async () => {
    const { act5Payoff } = await import('@/lib/demo/acts/act-5-payoff');
    await act5Payoff.execute({
      4: { act: 4, status: 'completed', duration: 400, events: [], data: {} },
    });

    expect(mockExecuteLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ maxBudget: 15 })
    );
  });

  it('emits demo:comparison event', async () => {
    const { act5Payoff } = await import('@/lib/demo/acts/act-5-payoff');
    await act5Payoff.execute({
      4: { act: 4, status: 'completed', duration: 400, events: [], data: {} },
    });

    const comparisonEvents = mockEmit.mock.calls.filter(
      (call) => call[0].type === 'demo:comparison'
    );
    expect(comparisonEvents).toHaveLength(1);
  });

  it('emits demo:complete event', async () => {
    const { act5Payoff } = await import('@/lib/demo/acts/act-5-payoff');
    await act5Payoff.execute({
      4: { act: 4, status: 'completed', duration: 400, events: [], data: {} },
    });

    const completeEvents = mockEmit.mock.calls.filter(
      (call) => call[0].type === 'demo:complete'
    );
    expect(completeEvents).toHaveLength(1);
  });

  it('returns cached result on idempotent re-execution', async () => {
    const { act5Payoff } = await import('@/lib/demo/acts/act-5-payoff');
    const cached: ActResult = { act: 5, status: 'completed', duration: 500, events: [], data: {} };
    const result = await act5Payoff.execute({ 5: cached });
    expect(result).toBe(cached);
  });

  it('canExecute returns false if Act 4 not completed', async () => {
    const { act5Payoff } = await import('@/lib/demo/acts/act-5-payoff');
    expect(act5Payoff.canExecute(3, {
      3: { act: 3, status: 'completed', duration: 300, events: [], data: {} },
    })).toBe(false);
  });
});
