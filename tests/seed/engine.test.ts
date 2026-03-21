import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { EngineState, SeedPhase } from '../../seed/types';

// ──────────────────────────────────────────
// Hoisted mock variables (accessible in vi.mock factories)
// ──────────────────────────────────────────

const {
  mockGetSDK,
  mockGiveFeedback,
  mockExecutePayment,
  mockNegotiatePrice,
  mockInspectIdentityMetadata,
  mockTriggerReputationPipeline,
  mockGenerateAgentCard,
  mockSendTask,
  mockDiscoverAgents,
  mockEmit,
  mockKvSet,
  mockKvGet,
  mockKvLpush,
} = vi.hoisted(() => ({
  mockGetSDK: vi.fn(),
  mockGiveFeedback: vi.fn(),
  mockExecutePayment: vi.fn(),
  mockNegotiatePrice: vi.fn(),
  mockInspectIdentityMetadata: vi.fn(),
  mockTriggerReputationPipeline: vi.fn(),
  mockGenerateAgentCard: vi.fn(),
  mockSendTask: vi.fn(),
  mockDiscoverAgents: vi.fn(),
  mockEmit: vi.fn(),
  mockKvSet: vi.fn(),
  mockKvGet: vi.fn(),
  mockKvLpush: vi.fn(),
}));

// ──────────────────────────────────────────
// Mock protocol modules at import boundary
// ──────────────────────────────────────────

vi.mock('@/lib/protocols/erc8004/client', () => ({
  getSDK: mockGetSDK,
  getReadOnlySDK: vi.fn(),
  clearSDKCache: vi.fn(),
}));

vi.mock('@/lib/protocols/erc8004/reputation', () => ({
  giveFeedback: mockGiveFeedback,
}));

vi.mock('@/lib/protocols/x402/client', () => ({
  executePayment: mockExecutePayment,
}));

vi.mock('@/lib/orchestrator/negotiation', () => ({
  negotiatePrice: mockNegotiatePrice,
}));

vi.mock('@/lib/civic/identity-inspector', () => ({
  inspectIdentityMetadata: mockInspectIdentityMetadata,
}));

vi.mock('@/lib/reputation/engine', () => ({
  triggerReputationPipeline: mockTriggerReputationPipeline,
}));

vi.mock('@/lib/protocols/a2a/agent-card', () => ({
  generateAgentCard: mockGenerateAgentCard,
}));

vi.mock('@/lib/protocols/a2a/client', () => ({
  discoverAgents: mockDiscoverAgents,
  sendTask: mockSendTask,
}));

vi.mock('@/lib/events/bus', () => ({
  createEventBus: () => ({ emit: mockEmit }),
}));

vi.mock('@/lib/events/constants', () => ({
  EVENT_TYPES: {
    AGENT_REGISTERED: 'agent:registered',
    LIFECYCLE_STARTED: 'lifecycle:started',
    LIFECYCLE_STEP_COMPLETED: 'lifecycle:step-completed',
    LIFECYCLE_COMPLETED: 'lifecycle:completed',
    LIFECYCLE_FAILED: 'lifecycle:failed',
  },
}));

vi.mock('@/lib/events/types', () => ({
  Protocol: {
    Erc8004: 'erc8004',
    X402: 'x402',
    A2A: 'a2a',
    Civic: 'civic',
    CovenantAi: 'covenant-ai',
  },
}));

vi.mock('@/lib/storage', () => ({
  kvSet: mockKvSet,
  kvGet: mockKvGet,
  kvLpush: mockKvLpush,
}));

vi.mock('@/lib/civic/gateway', () => ({
  getCivicGateway: () => ({
    inspectBehavior: vi.fn().mockResolvedValue({
      result: { passed: true, flags: [] },
    }),
  }),
}));

vi.mock('@/lib/config/env', () => ({
  env: {},
}));

vi.mock('@/lib/config/constants', () => ({
  DEFAULT_REPUTATION_THRESHOLD: 3.0,
}));

// ──────────────────────────────────────────
// Import after mocks
// ──────────────────────────────────────────

import {
  SeedEngine,
  loadEngineState,
  saveEngineState,
  createEmptyEngineState,
  parseCliArgs,
} from '../../seed/engine';

// ──────────────────────────────────────────
// Test Helpers
// ──────────────────────────────────────────

const TEST_STATE_DIR = path.join(process.cwd(), 'tests', 'seed', '.test-state');
const TEST_STATE_PATH = path.join(TEST_STATE_DIR, 'engine-state.json');

function createTestState(overrides?: Partial<EngineState>): EngineState {
  return {
    registeredAgents: {},
    completedInteractions: [],
    phasesCompleted: [],
    reputationComputed: [],
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

function setupMockSDK() {
  const mockAgent = {
    agentId: 'test-agent-id-123',
    agentURI: 'ipfs://test-uri',
    registerOnChain: vi.fn().mockResolvedValue({
      hash: '0xabc123',
      waitMined: vi.fn().mockResolvedValue({
        receipt: { transactionHash: '0xabc123' },
      }),
    }),
  };
  mockGetSDK.mockReturnValue({
    createAgent: vi.fn().mockReturnValue(mockAgent),
  });
  return mockAgent;
}

/** Set dummy wallet private keys in process.env for all 28 agents */
function setupWalletEnvVars() {
  const names = [
    'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7',
    'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9',
    'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17',
    'X1', 'X2', 'X3', 'X4',
  ];
  for (const name of names) {
    process.env[`SEED_WALLET_${name}_KEY`] = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  }
}

function cleanupWalletEnvVars() {
  const names = [
    'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7',
    'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9',
    'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17',
    'X1', 'X2', 'X3', 'X4',
  ];
  for (const name of names) {
    delete process.env[`SEED_WALLET_${name}_KEY`];
  }
}

// ──────────────────────────────────────────
// Tests
// ──────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  if (!fs.existsSync(TEST_STATE_DIR)) {
    fs.mkdirSync(TEST_STATE_DIR, { recursive: true });
  }
});

afterEach(() => {
  // Clean up test state files
  if (fs.existsSync(TEST_STATE_PATH)) {
    fs.unlinkSync(TEST_STATE_PATH);
  }
});

// ──────────────────────────────────────────
// State Management
// ──────────────────────────────────────────

describe('state management', () => {
  it('createEmptyEngineState returns valid empty state', () => {
    const state = createEmptyEngineState();
    expect(state.registeredAgents).toEqual({});
    expect(state.completedInteractions).toEqual([]);
    expect(state.phasesCompleted).toEqual([]);
    expect(state.reputationComputed).toEqual([]);
    expect(state.lastUpdated).toBeTruthy();
  });

  it('loadEngineState returns null for missing file', () => {
    const state = loadEngineState('/nonexistent/path.json');
    expect(state).toBeNull();
  });

  it('loadEngineState returns parsed state from file', () => {
    const original = createTestState({
      registeredAgents: {
        R1: { agentId: 'agent-1', tokenId: '1', txHash: '0x1' },
      },
      completedInteractions: ['A-001'],
    });
    fs.writeFileSync(TEST_STATE_PATH, JSON.stringify(original));

    const loaded = loadEngineState(TEST_STATE_PATH);
    expect(loaded).not.toBeNull();
    expect(loaded!.registeredAgents.R1.agentId).toBe('agent-1');
    expect(loaded!.completedInteractions).toContain('A-001');
  });

  it('loadEngineState returns null for corrupted file', () => {
    fs.writeFileSync(TEST_STATE_PATH, 'not valid json{{{');
    const state = loadEngineState(TEST_STATE_PATH);
    expect(state).toBeNull();
  });

  it('saveEngineState writes state to disk', () => {
    const state = createTestState({
      phasesCompleted: ['A'],
    });
    saveEngineState(state, TEST_STATE_PATH);

    const raw = JSON.parse(fs.readFileSync(TEST_STATE_PATH, 'utf-8'));
    expect(raw.phasesCompleted).toContain('A');
  });

  it('saveEngineState creates directory if missing', () => {
    const deepPath = path.join(TEST_STATE_DIR, 'deep', 'nested', 'state.json');
    const state = createTestState();
    saveEngineState(state, deepPath);

    expect(fs.existsSync(deepPath)).toBe(true);

    // Cleanup
    fs.unlinkSync(deepPath);
    fs.rmdirSync(path.join(TEST_STATE_DIR, 'deep', 'nested'));
    fs.rmdirSync(path.join(TEST_STATE_DIR, 'deep'));
  });

  it('saveEngineState updates lastUpdated timestamp', () => {
    const state = createTestState({ lastUpdated: '2020-01-01T00:00:00Z' });
    saveEngineState(state, TEST_STATE_PATH);

    const loaded = loadEngineState(TEST_STATE_PATH);
    expect(loaded!.lastUpdated).not.toBe('2020-01-01T00:00:00Z');
  });
});

// ──────────────────────────────────────────
// Config Loading
// ──────────────────────────────────────────

describe('config loading', () => {
  it('loadConfigs returns agent roster with 28 agents', () => {
    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    const configs = engine.loadConfigs();
    expect(configs.agents.all).toHaveLength(28);
  });

  it('loadConfigs returns agents by role counts', () => {
    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    const configs = engine.loadConfigs();
    expect(configs.agents.requesters).toHaveLength(7);
    expect(configs.agents.providers).toHaveLength(17);
    expect(configs.agents.adversarial).toHaveLength(4);
  });

  it('loadConfigs returns Phase A with 40 interactions', () => {
    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    const configs = engine.loadConfigs();
    const phaseA = configs.scenario.phases.find(p => p.phase === 'A');
    expect(phaseA).toBeDefined();
    expect(phaseA!.interactionCount).toBe(40);
  });

  it('loadConfigs returns Phase B with 50 interactions', () => {
    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    const configs = engine.loadConfigs();
    const phaseB = configs.scenario.phases.find(p => p.phase === 'B');
    expect(phaseB).toBeDefined();
    expect(phaseB!.interactionCount).toBe(50);
  });

  it('loadConfigs returns all 5 phases', () => {
    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    const configs = engine.loadConfigs();
    const phaseNames = configs.scenario.phases.map(p => p.phase);
    expect(phaseNames).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});

// ──────────────────────────────────────────
// Registration
// ──────────────────────────────────────────

describe('registerAllAgents', () => {
  beforeEach(() => setupWalletEnvVars());
  afterEach(() => cleanupWalletEnvVars());

  it('registers all 28 agents and saves state', async () => {
    const mockAgent = setupMockSDK();
    let registrationCount = 0;
    mockAgent.registerOnChain.mockImplementation(async () => {
      registrationCount++;
      return {
        hash: `0xreg${registrationCount}`,
        waitMined: vi.fn().mockResolvedValue({
          receipt: { transactionHash: `0xreg${registrationCount}` },
        }),
      };
    });
    mockInspectIdentityMetadata.mockResolvedValue({ passed: true, flags: [] });
    mockGenerateAgentCard.mockResolvedValue({ id: 'card-1' });

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.registerAllAgents();

    const state = loadEngineState(TEST_STATE_PATH);
    expect(Object.keys(state!.registeredAgents)).toHaveLength(28);
  });

  it('skips already registered agents', async () => {
    const mockAgent = setupMockSDK();
    mockInspectIdentityMetadata.mockResolvedValue({ passed: true, flags: [] });
    mockGenerateAgentCard.mockResolvedValue({ id: 'card-1' });

    // Pre-populate state with 10 registered agents
    const existingState = createTestState({
      registeredAgents: Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => {
          const names = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'S1', 'S2', 'S3'];
          return [names[i], { agentId: `existing-${i}`, tokenId: `${i}`, txHash: `0xexist${i}` }];
        })
      ),
    });
    saveEngineState(existingState, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.registerAllAgents();

    // Should only have called SDK createAgent for the 18 new agents
    const sdk = mockGetSDK();
    expect(sdk.createAgent).toHaveBeenCalledTimes(18);
  });

  it('continues on registration failure and logs error', async () => {
    let callCount = 0;
    const mockAgent = {
      agentId: 'test-id',
      agentURI: 'ipfs://test',
      registerOnChain: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 3) {
          throw new Error('Registration TX reverted');
        }
        return {
          hash: `0x${callCount}`,
          waitMined: vi.fn().mockResolvedValue({
            receipt: { transactionHash: `0x${callCount}` },
          }),
        };
      }),
    };
    mockGetSDK.mockReturnValue({
      createAgent: vi.fn().mockReturnValue(mockAgent),
    });
    mockInspectIdentityMetadata.mockResolvedValue({ passed: true, flags: [] });
    mockGenerateAgentCard.mockResolvedValue({ id: 'card-1' });

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.registerAllAgents();

    // Should have registered 27 (28 minus 1 failure)
    const state = loadEngineState(TEST_STATE_PATH);
    expect(Object.keys(state!.registeredAgents)).toHaveLength(27);
  });

  it('saves state after each successful registration', async () => {
    const mockAgent = setupMockSDK();
    mockInspectIdentityMetadata.mockResolvedValue({ passed: true, flags: [] });
    mockGenerateAgentCard.mockResolvedValue({ id: 'card-1' });

    const writeSpy = vi.spyOn(fs, 'writeFileSync');

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.registerAllAgents();

    // writeFileSync called at least 28 times (once per agent)
    const stateWrites = writeSpy.mock.calls.filter(
      call => (call[0] as string).includes('engine-state')
    );
    expect(stateWrites.length).toBeGreaterThanOrEqual(28);

    writeSpy.mockRestore();
  });

  it('emits seed:registration events', async () => {
    setupMockSDK();
    mockInspectIdentityMetadata.mockResolvedValue({ passed: true, flags: [] });
    mockGenerateAgentCard.mockResolvedValue({ id: 'card-1' });

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.registerAllAgents();

    // At least 28 emit calls for registration events
    const registrationEmits = mockEmit.mock.calls.filter(
      (call: unknown[]) => (call[0] as Record<string, unknown>).type === 'seed:registration'
    );
    expect(registrationEmits.length).toBe(28);
  });
});

// ──────────────────────────────────────────
// Phase Execution
// ──────────────────────────────────────────

describe('executePhase', () => {
  function setupPhaseExecution() {
    setupMockSDK();
    mockNegotiatePrice.mockResolvedValue({
      status: 'agreed',
      agreedPrice: 5,
      rounds: 2,
      messages: [],
    });
    mockExecutePayment.mockResolvedValue({
      txHash: '0xpay123',
      amount: '5.00',
      timestamp: Date.now(),
    });
    mockSendTask.mockResolvedValue({
      id: 'task-1',
      artifacts: [{ data: 'Deliverable content' }],
    });
    mockGiveFeedback.mockResolvedValue({
      txHash: '0xfb123',
    });
    mockInspectIdentityMetadata.mockResolvedValue({ passed: true, flags: [] });
    mockGenerateAgentCard.mockResolvedValue({ id: 'card-1' });

    // Pre-register all 28 agents in state
    const registeredAgents: Record<string, { agentId: string; tokenId: string; txHash: string }> = {};
    const names = [
      'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7',
      'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9',
      'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17',
      'X1', 'X2', 'X3', 'X4',
    ];
    for (const name of names) {
      registeredAgents[name] = {
        agentId: `agent-${name}`,
        tokenId: name,
        txHash: `0xreg-${name}`,
      };
    }
    const state = createTestState({ registeredAgents });
    saveEngineState(state, TEST_STATE_PATH);
  }

  it('processes all 40 interactions for Phase A', async () => {
    setupPhaseExecution();

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.executePhase('A');

    const state = loadEngineState(TEST_STATE_PATH);
    const phaseACompleted = state!.completedInteractions.filter(id => id.startsWith('A-'));
    expect(phaseACompleted).toHaveLength(40);
  });

  it('processes all 50 interactions for Phase B', async () => {
    setupPhaseExecution();

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.executePhase('B');

    const state = loadEngineState(TEST_STATE_PATH);
    const phaseBCompleted = state!.completedInteractions.filter(id => id.startsWith('B-'));
    expect(phaseBCompleted).toHaveLength(50);
  });

  it('skips already completed interactions', async () => {
    setupPhaseExecution();

    // Mark first 10 Phase A interactions as completed
    const state = loadEngineState(TEST_STATE_PATH)!;
    state.completedInteractions = Array.from({ length: 10 }, (_, i) =>
      `A-${String(i + 1).padStart(3, '0')}`
    );
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.executePhase('A');

    // executePayment should have been called only 30 times (40 - 10 skipped)
    expect(mockExecutePayment).toHaveBeenCalledTimes(30);
  });

  it('saves state after each completed interaction', async () => {
    setupPhaseExecution();

    const writeSpy = vi.spyOn(fs, 'writeFileSync');

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.executePhase('A');

    const stateWrites = writeSpy.mock.calls.filter(
      call => (call[0] as string).includes('engine-state')
    );
    expect(stateWrites.length).toBeGreaterThanOrEqual(40);

    writeSpy.mockRestore();
  });

  it('continues on interaction failure', async () => {
    setupPhaseExecution();
    let paymentCallCount = 0;
    mockExecutePayment.mockImplementation(async () => {
      paymentCallCount++;
      if (paymentCallCount === 5) {
        throw new Error('Payment failed: insufficient balance');
      }
      return { txHash: `0xpay${paymentCallCount}`, amount: '5.00', timestamp: Date.now() };
    });

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.executePhase('A');

    // 39 completed (40 - 1 failure)
    const state = loadEngineState(TEST_STATE_PATH);
    const completed = state!.completedInteractions.filter(id => id.startsWith('A-'));
    expect(completed).toHaveLength(39);
  });

  it('marks phase as completed after all interactions', async () => {
    setupPhaseExecution();

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.executePhase('A');

    const state = loadEngineState(TEST_STATE_PATH);
    expect(state!.phasesCompleted).toContain('A');
  });

  it('handles rejected interactions without payment', async () => {
    setupPhaseExecution();

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    // Phase D has rejected interactions with usdcAmount=0
    await engine.executePhase('D');

    const state = loadEngineState(TEST_STATE_PATH);
    const phaseDCompleted = state!.completedInteractions.filter(id => id.startsWith('D-'));
    expect(phaseDCompleted).toHaveLength(40);
  });

  it('emits seed:interaction events for each interaction', async () => {
    setupPhaseExecution();

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.executePhase('A');

    const interactionEmits = mockEmit.mock.calls.filter(
      (call: unknown[]) => (call[0] as Record<string, unknown>).type === 'seed:interaction'
    );
    expect(interactionEmits.length).toBe(40);
  });

  it('emits seed:phase-complete after phase finishes', async () => {
    setupPhaseExecution();

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.executePhase('A');

    const phaseEmits = mockEmit.mock.calls.filter(
      (call: unknown[]) => (call[0] as Record<string, unknown>).type === 'seed:phase-complete'
    );
    expect(phaseEmits.length).toBe(1);
  });
});

// ──────────────────────────────────────────
// Reputation Computation
// ──────────────────────────────────────────

describe('computeReputation', () => {
  it('triggers reputation pipeline', async () => {
    mockTriggerReputationPipeline.mockResolvedValue(undefined);

    const state = createTestState({
      registeredAgents: { R1: { agentId: 'a1', tokenId: '1', txHash: '0x1' } },
    });
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.computeReputation('A');

    expect(mockTriggerReputationPipeline).toHaveBeenCalled();
  });

  it('marks phase in reputationComputed after computation', async () => {
    mockTriggerReputationPipeline.mockResolvedValue(undefined);

    const state = createTestState({
      registeredAgents: { R1: { agentId: 'a1', tokenId: '1', txHash: '0x1' } },
    });
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.computeReputation('A');

    const updated = loadEngineState(TEST_STATE_PATH);
    expect(updated!.reputationComputed).toContain('A');
  });

  it('emits seed:reputation-computed event', async () => {
    mockTriggerReputationPipeline.mockResolvedValue(undefined);

    const state = createTestState({
      registeredAgents: { R1: { agentId: 'a1', tokenId: '1', txHash: '0x1' } },
    });
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.computeReputation('A');

    const repEmits = mockEmit.mock.calls.filter(
      (call: unknown[]) => (call[0] as Record<string, unknown>).type === 'seed:reputation-computed'
    );
    expect(repEmits.length).toBe(1);
  });
});

// ──────────────────────────────────────────
// Full Run Orchestration
// ──────────────────────────────────────────

describe('run', () => {
  beforeEach(() => setupWalletEnvVars());
  afterEach(() => cleanupWalletEnvVars());

  function setupFullRun() {
    const mockAgent = setupMockSDK();
    mockInspectIdentityMetadata.mockResolvedValue({ passed: true, flags: [] });
    mockGenerateAgentCard.mockResolvedValue({ id: 'card-1' });
    mockNegotiatePrice.mockResolvedValue({
      status: 'agreed',
      agreedPrice: 5,
      rounds: 2,
      messages: [],
    });
    mockExecutePayment.mockResolvedValue({
      txHash: '0xpay123',
      amount: '5.00',
      timestamp: Date.now(),
    });
    mockSendTask.mockResolvedValue({
      id: 'task-1',
      artifacts: [{ data: 'content' }],
    });
    mockGiveFeedback.mockResolvedValue({ txHash: '0xfb123' });
    mockTriggerReputationPipeline.mockResolvedValue(undefined);
    return mockAgent;
  }

  it('sequences: register -> phaseA -> reputation -> phaseB -> reputation', async () => {
    setupFullRun();

    const engine = new SeedEngine({
      statePath: TEST_STATE_PATH,
      phases: ['A', 'B'],
    });
    await engine.run();

    const state = loadEngineState(TEST_STATE_PATH);
    expect(Object.keys(state!.registeredAgents)).toHaveLength(28);
    expect(state!.phasesCompleted).toContain('A');
    expect(state!.phasesCompleted).toContain('B');
  });

  it('skips completed phases on resume', async () => {
    setupFullRun();

    // Pre-populate with completed Phase A
    const existingState = createTestState({
      registeredAgents: Object.fromEntries(
        ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7',
         'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9',
         'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17',
         'X1', 'X2', 'X3', 'X4'].map(n => [n, { agentId: `a-${n}`, tokenId: n, txHash: `0x${n}` }])
      ),
      phasesCompleted: ['A'],
      reputationComputed: ['A'],
      completedInteractions: Array.from({ length: 40 }, (_, i) =>
        `A-${String(i + 1).padStart(3, '0')}`
      ),
    });
    saveEngineState(existingState, TEST_STATE_PATH);

    const engine = new SeedEngine({
      statePath: TEST_STATE_PATH,
      phases: ['A', 'B'],
    });
    await engine.run();

    // Phase A interactions should not be re-executed
    // Only Phase B's 50 interactions
    const state = loadEngineState(TEST_STATE_PATH);
    expect(state!.phasesCompleted).toContain('B');
    expect(mockExecutePayment).toHaveBeenCalledTimes(50);
  });

  it('runs specific phase when --phase is specified', async () => {
    setupFullRun();

    // Pre-register all agents
    const existingState = createTestState({
      registeredAgents: Object.fromEntries(
        ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7',
         'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9',
         'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17',
         'X1', 'X2', 'X3', 'X4'].map(n => [n, { agentId: `a-${n}`, tokenId: n, txHash: `0x${n}` }])
      ),
    });
    saveEngineState(existingState, TEST_STATE_PATH);

    const engine = new SeedEngine({
      statePath: TEST_STATE_PATH,
      phases: ['B'],
    });
    await engine.run();

    const state = loadEngineState(TEST_STATE_PATH);
    expect(state!.phasesCompleted).toContain('B');
    // Phase A should not be in completedInteractions
    const phaseAComplete = state!.completedInteractions.filter(id => id.startsWith('A-'));
    expect(phaseAComplete).toHaveLength(0);
  });

  it('prints summary on completion', async () => {
    setupFullRun();
    const consoleSpy = vi.spyOn(console, 'log');

    const engine = new SeedEngine({
      statePath: TEST_STATE_PATH,
      phases: ['A', 'B'],
    });
    await engine.run();

    const summaryLogs = consoleSpy.mock.calls.filter(
      (call: unknown[]) => String(call[0]).includes('Summary')
    );
    expect(summaryLogs.length).toBeGreaterThanOrEqual(1);

    consoleSpy.mockRestore();
  });
});

// ──────────────────────────────────────────
// CLI Argument Parsing
// ──────────────────────────────────────────

describe('parseCliArgs', () => {
  it('parses --phase A', () => {
    const args = parseCliArgs(['--phase', 'A']);
    expect(args.phases).toEqual(['A']);
  });

  it('parses --phase B', () => {
    const args = parseCliArgs(['--phase', 'B']);
    expect(args.phases).toEqual(['B']);
  });

  it('defaults to phases A and B when no --phase', () => {
    const args = parseCliArgs([]);
    expect(args.phases).toEqual(['A', 'B']);
  });

  it('parses --resume flag', () => {
    const args = parseCliArgs(['--resume']);
    expect(args.resume).toBe(true);
  });

  it('parses --reset flag', () => {
    const args = parseCliArgs(['--reset']);
    expect(args.reset).toBe(true);
  });

  it('parses combined flags', () => {
    const args = parseCliArgs(['--phase', 'A', '--resume']);
    expect(args.phases).toEqual(['A']);
    expect(args.resume).toBe(true);
  });

  it('parses --all flag for all 5 phases', () => {
    const args = parseCliArgs(['--all']);
    expect(args.phases).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});
