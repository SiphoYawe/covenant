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

const mockRegisterAgent = vi.fn().mockResolvedValue({ agentId: 'agent-0x1' });
vi.mock('@/lib/protocols/erc8004', () => ({
  registerAgent: (...args: unknown[]) => mockRegisterAgent(...args),
}));

vi.mock('@/lib/protocols/a2a', () => ({
  generateAgentCard: vi.fn().mockResolvedValue({ name: 'test' }),
}));

vi.mock('@/lib/agents', () => ({
  generateMetadata: vi.fn((role: string) => ({
    name: `Agent ${role}`,
    description: 'test',
    capabilities: ['test'],
    walletAddress: `0x${role}`,
  })),
}));

vi.mock('@/lib/civic', () => ({
  getCivicGateway: () => ({
    inspectIdentity: vi.fn().mockResolvedValue({ result: { passed: true, flags: [] } }),
  }),
}));

const mockUpdateDemoAct = vi.fn().mockResolvedValue({});
const mockAddDemoAgent = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/orchestrator', () => ({
  addDemoAgent: (...args: unknown[]) => mockAddDemoAgent(...args),
  updateDemoAct: (...args: unknown[]) => mockUpdateDemoAct(...args),
  DemoAct: { Registration: 'Registration', Idle: 'Idle' },
  DemoStatus: { Running: 'Running', Completed: 'Completed', Failed: 'Failed' },
}));

describe('Act 1: Registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegisterAgent.mockResolvedValue({ agentId: 'agent-0x1' });
  });

  it('registers 3 agents successfully', async () => {
    const { act1Registration } = await import('@/lib/demo/acts/act-1-registration');
    const result = await act1Registration.execute({});
    expect(result.status).toBe('completed');
    expect(result.act).toBe(1);
    expect(mockRegisterAgent).toHaveBeenCalledTimes(3);
  });

  it('emits agent:registered events for each agent', async () => {
    const { act1Registration } = await import('@/lib/demo/acts/act-1-registration');
    await act1Registration.execute({});

    const registeredEvents = mockEmit.mock.calls.filter(
      (call) => call[0].type === 'agent:registered'
    );
    expect(registeredEvents).toHaveLength(3);
  });

  it('emits demo:act-changed events (running -> completed)', async () => {
    const { act1Registration } = await import('@/lib/demo/acts/act-1-registration');
    await act1Registration.execute({});

    const actChangedEvents = mockEmit.mock.calls.filter(
      (call) => call[0].type === 'demo:act-changed'
    );
    expect(actChangedEvents.length).toBeGreaterThanOrEqual(2);
    expect(actChangedEvents[0][0].data.status).toBe('running');
    expect(actChangedEvents[actChangedEvents.length - 1][0].data.status).toBe('completed');
  });

  it('stores agent IDs via addDemoAgent', async () => {
    const { act1Registration } = await import('@/lib/demo/acts/act-1-registration');
    await act1Registration.execute({});
    expect(mockAddDemoAgent).toHaveBeenCalledTimes(3);
  });

  it('returns cached result on idempotent re-execution', async () => {
    const { act1Registration } = await import('@/lib/demo/acts/act-1-registration');
    const cached: ActResult = { act: 1, status: 'completed', duration: 100, events: [], data: {} };
    const result = await act1Registration.execute({ 1: cached });
    expect(result).toBe(cached);
    expect(mockRegisterAgent).not.toHaveBeenCalled();
  });

  it('fails gracefully if registration errors', async () => {
    mockRegisterAgent.mockRejectedValue(new Error('Registration failed'));
    const { act1Registration } = await import('@/lib/demo/acts/act-1-registration');
    const result = await act1Registration.execute({});
    expect(result.status).toBe('failed');
    expect(result.error).toBeDefined();
  });

  it('canExecute returns true for clean state (act 0)', async () => {
    const { act1Registration } = await import('@/lib/demo/acts/act-1-registration');
    expect(act1Registration.canExecute(0, {})).toBe(true);
  });

  it('canExecute returns false if state is not clean and act 1 not completed', async () => {
    const { act1Registration } = await import('@/lib/demo/acts/act-1-registration');
    expect(act1Registration.canExecute(2, {})).toBe(false);
  });
});
