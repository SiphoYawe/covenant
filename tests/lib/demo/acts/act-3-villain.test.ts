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
    AGENT_REGISTERED: 'agent:registered',
  },
}));
vi.mock('@/lib/events/types', () => ({
  Protocol: { CovenantAi: 'covenant-ai', Erc8004: 'erc8004' },
}));

const mockRegisterAgent = vi.fn().mockResolvedValue({ agentId: 'agent-d' });
vi.mock('@/lib/protocols/erc8004', () => ({
  registerAgent: (...args: unknown[]) => mockRegisterAgent(...args),
}));
vi.mock('@/lib/protocols/a2a', () => ({
  generateAgentCard: vi.fn().mockResolvedValue({ name: 'ShadowReview' }),
}));
vi.mock('@/lib/agents', () => ({
  generateMetadata: vi.fn(() => ({
    name: 'ShadowReview',
    description: 'test',
    capabilities: ['review_code'],
    walletAddress: '0xmalicious',
  })),
}));
vi.mock('@/lib/civic', () => ({
  getCivicGateway: () => ({
    inspectIdentity: vi.fn().mockResolvedValue({ result: { passed: true, flags: [] } }),
  }),
}));

const mockExecuteLifecycle = vi.fn().mockResolvedValue({
  success: false,
  selectedAgentId: 'agent-d',
  negotiatedPrice: 1,
  paymentTxHash: '0xtx-villain',
  civicFlags: [{ id: 'f1', severity: 'Critical', attackType: 'prompt_injection' }],
});

vi.mock('@/lib/orchestrator', () => ({
  executeLifecycle: (...args: unknown[]) => mockExecuteLifecycle(...args),
  addDemoAgent: vi.fn().mockResolvedValue(undefined),
  updateDemoAct: vi.fn().mockResolvedValue({}),
  getDemoAgents: vi.fn().mockResolvedValue([
    { agentId: 'agent-a', tokenId: 't1', walletAddress: '0xa', registeredAt: 1000 },
  ]),
  DemoAct: { VillainAttacks: 'VillainAttacks' },
  DemoStatus: { Running: 'Running', Completed: 'Completed', Failed: 'Failed' },
}));

describe('Act 3: Villain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers Agent D and runs malicious lifecycle', async () => {
    const { act3Villain } = await import('@/lib/demo/acts/act-3-villain');
    const result = await act3Villain.execute({
      2: { act: 2, status: 'completed', duration: 200, events: [], data: {} },
    });

    expect(result.status).toBe('completed');
    expect(mockRegisterAgent).toHaveBeenCalledTimes(1);
    expect(mockExecuteLifecycle).toHaveBeenCalledTimes(1);
  });

  it('emits agent:registered for Agent D', async () => {
    const { act3Villain } = await import('@/lib/demo/acts/act-3-villain');
    await act3Villain.execute({
      2: { act: 2, status: 'completed', duration: 200, events: [], data: {} },
    });

    const regEvents = mockEmit.mock.calls.filter(
      (call) => call[0].type === 'agent:registered'
    );
    expect(regEvents).toHaveLength(1);
    expect(regEvents[0][0].data.role).toBe('malicious');
  });

  it('captures Civic flags in result data', async () => {
    const { act3Villain } = await import('@/lib/demo/acts/act-3-villain');
    const result = await act3Villain.execute({
      2: { act: 2, status: 'completed', duration: 200, events: [], data: {} },
    });

    expect(result.data.villainResult).toBeDefined();
    const vr = result.data.villainResult as Record<string, unknown>;
    expect(vr.success).toBe(false);
    expect((vr.civicFlags as unknown[]).length).toBeGreaterThan(0);
  });

  it('returns cached result on idempotent re-execution', async () => {
    const { act3Villain } = await import('@/lib/demo/acts/act-3-villain');
    const cached: ActResult = { act: 3, status: 'completed', duration: 300, events: [], data: {} };
    const result = await act3Villain.execute({ 3: cached });
    expect(result).toBe(cached);
  });

  it('canExecute returns false if Act 2 not completed', async () => {
    const { act3Villain } = await import('@/lib/demo/acts/act-3-villain');
    expect(act3Villain.canExecute(1, {
      1: { act: 1, status: 'completed', duration: 100, events: [], data: {} },
    })).toBe(false);
  });
});
