import { describe, it, expect, vi } from 'vitest';

// --- Mocks (top level) ---

const mockEmit = vi.fn().mockResolvedValue({ id: 'e1', timestamp: Date.now() });
vi.mock('@/lib/events/bus', () => ({
  createEventBus: () => ({ emit: mockEmit, since: vi.fn().mockResolvedValue([]) }),
}));
vi.mock('@/lib/events/constants', () => ({
  EVENT_TYPES: {
    DEMO_ACT_CHANGED: 'demo:act-changed',
    DEMO_COMPLETE: 'demo:complete',
    AGENT_REGISTERED: 'agent:registered',
    REPUTATION_UPDATED: 'reputation:updated',
  },
}));
vi.mock('@/lib/events/types', () => ({
  Protocol: { CovenantAi: 'covenant-ai', Erc8004: 'erc8004' },
}));
vi.mock('@/lib/protocols/erc8004', () => ({
  registerAgent: vi.fn().mockResolvedValue({ agentId: 'test' }),
  appendReputationResponse: vi.fn().mockResolvedValue({ txHash: '0x1' }),
}));
vi.mock('@/lib/protocols/a2a', () => ({
  generateAgentCard: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/lib/agents', () => ({
  generateMetadata: vi.fn(() => ({
    name: 'Test',
    description: 'test',
    capabilities: [],
    walletAddress: '0x0',
  })),
}));
vi.mock('@/lib/civic', () => ({
  getCivicGateway: () => ({
    inspectIdentity: vi.fn().mockResolvedValue({ result: { passed: true, flags: [] } }),
  }),
}));
vi.mock('@/lib/orchestrator', () => ({
  executeLifecycle: vi.fn().mockResolvedValue({
    success: true,
    selectedAgentId: 'test',
    negotiatedPrice: 5,
    civicFlags: [],
  }),
  routeTask: vi.fn().mockResolvedValue({
    selectedAgentId: 'test',
    excluded: [],
    candidates: [],
    capability: 'test',
    reason: 'test',
  }),
  addDemoAgent: vi.fn(),
  updateDemoAct: vi.fn(),
  getDemoAgents: vi.fn().mockResolvedValue([
    { agentId: 'a1', tokenId: 't1', walletAddress: '0x1', registeredAt: 1000 },
  ]),
  DemoAct: { Idle: 'Idle', Registration: 'Registration', EconomyWorks: 'EconomyWorks', VillainAttacks: 'VillainAttacks', Consequences: 'Consequences', Payoff: 'Payoff' },
  DemoStatus: { Idle: 'Idle', Running: 'Running', Completed: 'Completed', Failed: 'Failed' },
}));
vi.mock('@/lib/reputation', () => ({
  triggerReputationPipeline: vi.fn().mockResolvedValue({}),
  detectSybilPatterns: vi.fn().mockResolvedValue({ alerts: [] }),
  storeSybilAlerts: vi.fn(),
  generateAndStoreExplanation: vi.fn().mockResolvedValue({ explanation: 'test', cid: 'Q1' }),
}));
vi.mock('@/lib/storage', () => ({
  kvGet: vi.fn().mockResolvedValue({ score: 5.0, explanationCid: 'Qm1' }),
}));

describe('5-Act Sequence Integration', () => {
  it('all 5 acts can be instantiated from the registry', async () => {
    const { getActExecutor } = await import('@/lib/demo/acts');
    const { VALID_ACT_NUMBERS } = await import('@/lib/demo/types');

    for (const actNumber of VALID_ACT_NUMBERS) {
      const executor = getActExecutor(actNumber);
      expect(executor).toBeDefined();
      expect(executor.actNumber).toBe(actNumber);
      expect(executor.name).toBeTruthy();
    }
  });

  it('acts enforce sequential prerequisite order', async () => {
    const { getActExecutor } = await import('@/lib/demo/acts');

    const act1 = getActExecutor(1);
    const act2 = getActExecutor(2);
    const act3 = getActExecutor(3);
    const act4 = getActExecutor(4);
    const act5 = getActExecutor(5);

    // Act 1 can execute on clean state
    expect(act1.canExecute(0, {})).toBe(true);

    // Act 2 cannot execute without Act 1
    expect(act2.canExecute(0, {})).toBe(false);

    // Act 2 can execute after Act 1
    const act1Result = { act: 1 as const, status: 'completed' as const, duration: 100, events: [], data: {} };
    expect(act2.canExecute(1, { 1: act1Result })).toBe(true);

    // Act 3 cannot execute without Act 2
    expect(act3.canExecute(1, { 1: act1Result })).toBe(false);

    // Act 3 can execute after Act 2
    const act2Result = { act: 2 as const, status: 'completed' as const, duration: 200, events: [], data: {} };
    expect(act3.canExecute(2, { 1: act1Result, 2: act2Result })).toBe(true);

    // Act 4 cannot execute without Act 3
    expect(act4.canExecute(2, { 1: act1Result, 2: act2Result })).toBe(false);

    // Act 4 can execute after Act 3
    const act3Result = { act: 3 as const, status: 'completed' as const, duration: 300, events: [], data: {} };
    expect(act4.canExecute(3, { 1: act1Result, 2: act2Result, 3: act3Result })).toBe(true);

    // Act 5 cannot execute without Act 4
    expect(act5.canExecute(3, { 1: act1Result, 2: act2Result, 3: act3Result })).toBe(false);

    // Act 5 can execute after Act 4
    const act4Result = { act: 4 as const, status: 'completed' as const, duration: 400, events: [], data: {} };
    expect(act5.canExecute(4, { 1: act1Result, 2: act2Result, 3: act3Result, 4: act4Result })).toBe(true);
  });

  it('skipping acts returns canExecute false', async () => {
    const { getActExecutor } = await import('@/lib/demo/acts');
    const act5 = getActExecutor(5);
    const act1Result = { act: 1 as const, status: 'completed' as const, duration: 100, events: [], data: {} };
    expect(act5.canExecute(1, { 1: act1Result })).toBe(false);
  });
});
