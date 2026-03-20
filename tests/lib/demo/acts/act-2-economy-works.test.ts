import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ActResult } from '@/lib/demo/types';

// --- Mocks ---

const mockEmit = vi.fn().mockResolvedValue({ id: 'e1', timestamp: Date.now() });
vi.mock('@/lib/events/bus', () => ({
  createEventBus: () => ({ emit: mockEmit, since: vi.fn().mockResolvedValue([]) }),
}));
vi.mock('@/lib/events/constants', () => ({
  EVENT_TYPES: { DEMO_ACT_CHANGED: 'demo:act-changed' },
}));
vi.mock('@/lib/events/types', () => ({
  Protocol: { CovenantAi: 'covenant-ai' },
}));

const mockExecuteLifecycle = vi.fn().mockResolvedValue({
  success: true,
  selectedAgentId: 'agent-b',
  negotiatedPrice: 6,
  paymentTxHash: '0xtx1',
  civicFlags: [],
});

vi.mock('@/lib/orchestrator', () => ({
  executeLifecycle: (...args: unknown[]) => mockExecuteLifecycle(...args),
  updateDemoAct: vi.fn().mockResolvedValue({}),
  getDemoAgents: vi.fn().mockResolvedValue([
    { agentId: 'agent-a', tokenId: 't1', walletAddress: '0xa', registeredAt: 1000 },
  ]),
  DemoAct: { EconomyWorks: 'EconomyWorks' },
  DemoStatus: { Running: 'Running', Completed: 'Completed', Failed: 'Failed' },
}));

describe('Act 2: Economy Works', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteLifecycle.mockResolvedValue({
      success: true,
      selectedAgentId: 'agent-b',
      negotiatedPrice: 6,
      paymentTxHash: '0xtx1',
      civicFlags: [],
    });
  });

  it('runs two successful lifecycle interactions', async () => {
    const { act2EconomyWorks } = await import('@/lib/demo/acts/act-2-economy-works');
    const result = await act2EconomyWorks.execute({
      1: { act: 1, status: 'completed', duration: 100, events: [], data: {} },
    });

    expect(result.status).toBe('completed');
    expect(mockExecuteLifecycle).toHaveBeenCalledTimes(2);
  });

  it('emits demo:act-changed events', async () => {
    const { act2EconomyWorks } = await import('@/lib/demo/acts/act-2-economy-works');
    await act2EconomyWorks.execute({
      1: { act: 1, status: 'completed', duration: 100, events: [], data: {} },
    });

    const actChangedEvents = mockEmit.mock.calls.filter(
      (call) => call[0].type === 'demo:act-changed'
    );
    expect(actChangedEvents.length).toBeGreaterThanOrEqual(2);
  });

  it('returns cached result on idempotent re-execution', async () => {
    const { act2EconomyWorks } = await import('@/lib/demo/acts/act-2-economy-works');
    const cached: ActResult = { act: 2, status: 'completed', duration: 200, events: [], data: {} };
    const result = await act2EconomyWorks.execute({ 2: cached });
    expect(result).toBe(cached);
    expect(mockExecuteLifecycle).not.toHaveBeenCalled();
  });

  it('canExecute returns false if Act 1 not completed', async () => {
    const { act2EconomyWorks } = await import('@/lib/demo/acts/act-2-economy-works');
    expect(act2EconomyWorks.canExecute(0, {})).toBe(false);
  });

  it('canExecute returns true if Act 1 completed', async () => {
    const { act2EconomyWorks } = await import('@/lib/demo/acts/act-2-economy-works');
    expect(act2EconomyWorks.canExecute(1, {
      1: { act: 1, status: 'completed', duration: 100, events: [], data: {} },
    })).toBe(true);
  });

  it('fails gracefully on lifecycle error', async () => {
    mockExecuteLifecycle.mockRejectedValue(new Error('Lifecycle failed'));
    const { act2EconomyWorks } = await import('@/lib/demo/acts/act-2-economy-works');
    const result = await act2EconomyWorks.execute({
      1: { act: 1, status: 'completed', duration: 100, events: [], data: {} },
    });
    expect(result.status).toBe('failed');
  });
});
