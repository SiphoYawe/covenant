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
    REPUTATION_UPDATED: 'reputation:updated',
  },
}));
vi.mock('@/lib/events/types', () => ({
  Protocol: { CovenantAi: 'covenant-ai' },
}));

vi.mock('@/lib/reputation', () => ({
  triggerReputationPipeline: vi.fn().mockResolvedValue({ status: 'complete' }),
  detectSybilPatterns: vi.fn().mockResolvedValue({ alerts: [], analysisTimestamp: Date.now(), reasoning: '' }),
  storeSybilAlerts: vi.fn().mockResolvedValue(undefined),
  generateAndStoreExplanation: vi.fn().mockResolvedValue({
    agentId: 'test',
    explanation: 'Test explanation',
    cid: 'Qm123',
    storedInKV: true,
    retryPinning: false,
    generatedAt: Date.now(),
  }),
}));

vi.mock('@/lib/protocols/erc8004', () => ({
  appendReputationResponse: vi.fn().mockResolvedValue({ txHash: '0xrep-tx' }),
}));

const mockKvGet = vi.fn().mockResolvedValue({ score: 5.0, explanationCid: 'Qm456' });
vi.mock('@/lib/storage', () => ({
  kvGet: (...args: unknown[]) => mockKvGet(...args),
}));

vi.mock('@/lib/orchestrator', () => ({
  updateDemoAct: vi.fn().mockResolvedValue({}),
  getDemoAgents: vi.fn().mockResolvedValue([
    { agentId: 'agent-a', tokenId: 't1', walletAddress: '0xa', registeredAt: 1000 },
    { agentId: 'agent-b', tokenId: 't2', walletAddress: '0xb', registeredAt: 1001 },
    { agentId: 'agent-d', tokenId: 't3', walletAddress: '0xd', registeredAt: 2000 },
  ]),
  DemoAct: { Consequences: 'Consequences' },
  DemoStatus: { Running: 'Running', Completed: 'Completed', Failed: 'Failed' },
}));

describe('Act 4: Consequences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers reputation recomputation for all agents', async () => {
    const { act4Consequences } = await import('@/lib/demo/acts/act-4-consequences');
    const { triggerReputationPipeline } = await import('@/lib/reputation');

    const result = await act4Consequences.execute({
      3: { act: 3, status: 'completed', duration: 300, events: [], data: {} },
    });

    expect(result.status).toBe('completed');
    expect(triggerReputationPipeline).toHaveBeenCalledTimes(3); // 3 agents
  });

  it('generates explanations for agents', async () => {
    const { act4Consequences } = await import('@/lib/demo/acts/act-4-consequences');
    const { generateAndStoreExplanation } = await import('@/lib/reputation');

    await act4Consequences.execute({
      3: { act: 3, status: 'completed', duration: 300, events: [], data: {} },
    });

    expect(generateAndStoreExplanation).toHaveBeenCalled();
  });

  it('writes enriched scores on-chain via appendResponse', async () => {
    const { act4Consequences } = await import('@/lib/demo/acts/act-4-consequences');
    const { appendReputationResponse } = await import('@/lib/protocols/erc8004');

    await act4Consequences.execute({
      3: { act: 3, status: 'completed', duration: 300, events: [], data: {} },
    });

    expect(appendReputationResponse).toHaveBeenCalled();
  });

  it('emits reputation:updated events', async () => {
    const { act4Consequences } = await import('@/lib/demo/acts/act-4-consequences');
    await act4Consequences.execute({
      3: { act: 3, status: 'completed', duration: 300, events: [], data: {} },
    });

    const repEvents = mockEmit.mock.calls.filter(
      (call) => call[0].type === 'reputation:updated'
    );
    expect(repEvents.length).toBeGreaterThanOrEqual(3);
  });

  it('returns cached result on idempotent re-execution', async () => {
    const { act4Consequences } = await import('@/lib/demo/acts/act-4-consequences');
    const cached: ActResult = { act: 4, status: 'completed', duration: 400, events: [], data: {} };
    const result = await act4Consequences.execute({ 4: cached });
    expect(result).toBe(cached);
  });

  it('canExecute returns false if Act 3 not completed', async () => {
    const { act4Consequences } = await import('@/lib/demo/acts/act-4-consequences');
    expect(act4Consequences.canExecute(2, {
      2: { act: 2, status: 'completed', duration: 200, events: [], data: {} },
    })).toBe(false);
  });
});
