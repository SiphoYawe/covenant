import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { EngineState } from '../../seed/types';

// ──────────────────────────────────────────
// Hoisted mock variables
// ──────────────────────────────────────────

const {
  mockGetSDK,
  mockGiveFeedback,
  mockExecutePayment,
  mockNegotiatePrice,
  mockInspectIdentityMetadata,
  mockTriggerReputationPipeline,
  mockSendTask,
  mockDiscoverAgents,
  mockEmit,
  mockKvSet,
  mockKvGet,
  mockKvLpush,
  // New mocks for Story 9.5
  mockInspectBehavior,
  mockHandleThreat,
  mockStoreFlag,
  mockGetFlags,
  mockGetCivicPenalty,
  mockComputeStakeWeights,
  mockBuildGraph,
  mockGetGraph,
  mockSaveGraph,
  mockComputeTrustPropagation,
  mockGetGlobalTrustRanking,
  mockDetectSybilPatterns,
  mockStoreSybilAlerts,
  mockSynthesizeScore,
  mockClassifyAgent,
  mockGenerateExplanation,
  mockStoreExplanation,
  mockAppendReputationResponse,
  mockRouteTask,
  mockPin,
} = vi.hoisted(() => ({
  mockGetSDK: vi.fn(),
  mockGiveFeedback: vi.fn(),
  mockExecutePayment: vi.fn(),
  mockNegotiatePrice: vi.fn(),
  mockInspectIdentityMetadata: vi.fn(),
  mockTriggerReputationPipeline: vi.fn(),
  mockSendTask: vi.fn(),
  mockDiscoverAgents: vi.fn(),
  mockEmit: vi.fn(),
  mockKvSet: vi.fn(),
  mockKvGet: vi.fn(),
  mockKvLpush: vi.fn(),
  mockInspectBehavior: vi.fn(),
  mockHandleThreat: vi.fn(),
  mockStoreFlag: vi.fn(),
  mockGetFlags: vi.fn(),
  mockGetCivicPenalty: vi.fn(),
  mockComputeStakeWeights: vi.fn(),
  mockBuildGraph: vi.fn(),
  mockGetGraph: vi.fn(),
  mockSaveGraph: vi.fn(),
  mockComputeTrustPropagation: vi.fn(),
  mockGetGlobalTrustRanking: vi.fn(),
  mockDetectSybilPatterns: vi.fn(),
  mockStoreSybilAlerts: vi.fn(),
  mockSynthesizeScore: vi.fn(),
  mockClassifyAgent: vi.fn(),
  mockGenerateExplanation: vi.fn(),
  mockStoreExplanation: vi.fn(),
  mockAppendReputationResponse: vi.fn(),
  mockRouteTask: vi.fn(),
  mockPin: vi.fn(),
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

vi.mock('@/lib/protocols/erc8004/write-back', () => ({
  appendReputationResponse: mockAppendReputationResponse,
}));

vi.mock('@/lib/protocols/x402/client', () => ({
  executePayment: mockExecutePayment,
}));

vi.mock('@/lib/orchestrator/negotiation', () => ({
  negotiatePrice: mockNegotiatePrice,
}));

vi.mock('@/lib/orchestrator/routing', () => ({
  routeTask: mockRouteTask,
}));

vi.mock('@/lib/civic/identity-inspector', () => ({
  inspectIdentityMetadata: mockInspectIdentityMetadata,
}));

vi.mock('@/lib/civic/gateway', () => ({
  getCivicGateway: () => ({
    inspectBehavior: mockInspectBehavior,
  }),
}));

vi.mock('@/lib/civic/threat-handler', () => ({
  handleThreat: mockHandleThreat,
  storeFlag: mockStoreFlag,
  getFlags: mockGetFlags,
}));

vi.mock('@/lib/civic/reputation-bridge', () => ({
  getCivicPenalty: mockGetCivicPenalty,
  computePenalty: vi.fn().mockReturnValue(0),
}));

vi.mock('@/lib/reputation/engine', () => ({
  triggerReputationPipeline: mockTriggerReputationPipeline,
}));

vi.mock('@/lib/reputation/stake-weighting', () => ({
  computeStakeWeights: mockComputeStakeWeights,
}));

vi.mock('@/lib/reputation/graph', () => ({
  buildGraph: mockBuildGraph,
  getGraph: mockGetGraph,
  saveGraph: mockSaveGraph,
}));

vi.mock('@/lib/reputation/trust-propagation', () => ({
  computeTrustPropagation: mockComputeTrustPropagation,
  getGlobalTrustRanking: mockGetGlobalTrustRanking,
}));

vi.mock('@/lib/reputation/sybil-detection', () => ({
  detectSybilPatterns: mockDetectSybilPatterns,
  storeSybilAlerts: mockStoreSybilAlerts,
}));

vi.mock('@/lib/reputation/score-synthesis', () => ({
  synthesizeScore: mockSynthesizeScore,
  classifyAgent: mockClassifyAgent,
}));

vi.mock('@/lib/reputation/explanation', () => ({
  generateExplanation: mockGenerateExplanation,
  storeExplanation: mockStoreExplanation,
}));

vi.mock('@/lib/protocols/a2a/agent-card', () => ({
  generateAgentCard: vi.fn().mockResolvedValue({ id: 'card-1' }),
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
    REPUTATION_COMPUTING: 'reputation:computing',
    REPUTATION_UPDATED: 'reputation:updated',
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
  pin: mockPin,
}));

vi.mock('@/lib/storage/kv', () => ({
  kvSet: mockKvSet,
  kvGet: mockKvGet,
  kvLpush: mockKvLpush,
}));

vi.mock('@/lib/storage/ipfs', () => ({
  pin: mockPin,
  get: vi.fn(),
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
} from '../../seed/engine';

// ──────────────────────────────────────────
// Test Helpers
// ──────────────────────────────────────────

const TEST_STATE_DIR = path.join(process.cwd(), 'tests', 'seed', '.test-state');
const TEST_STATE_PATH = path.join(TEST_STATE_DIR, 'adversarial-state.json');

const ALL_AGENT_NAMES = [
  'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7',
  'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9',
  'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17',
  'X1', 'X2', 'X3', 'X4',
];

function createRegisteredState(overrides?: Partial<EngineState>): EngineState {
  const registeredAgents: Record<string, { agentId: string; tokenId: string; txHash: string }> = {};
  for (const name of ALL_AGENT_NAMES) {
    registeredAgents[name] = {
      agentId: `agent-${name}`,
      tokenId: name,
      txHash: `0xreg-${name}`,
    };
  }
  return {
    registeredAgents,
    completedInteractions: [],
    phasesCompleted: [],
    reputationComputed: [],
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

function createPhaseABCompletedState(): EngineState {
  const phaseAIds = Array.from({ length: 40 }, (_, i) => `A-${String(i + 1).padStart(3, '0')}`);
  const phaseBIds = Array.from({ length: 50 }, (_, i) => `B-${String(i + 1).padStart(3, '0')}`);
  return createRegisteredState({
    completedInteractions: [...phaseAIds, ...phaseBIds],
    phasesCompleted: ['A', 'B'],
    reputationComputed: ['B'],
  });
}

function setupDefaultMocks() {
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
  mockGiveFeedback.mockResolvedValue({ txHash: '0xfb123' });
  mockInspectIdentityMetadata.mockResolvedValue({ passed: true, flags: [] });

  // Civic L2 defaults: pass (no malicious content)
  mockInspectBehavior.mockResolvedValue({
    result: { passed: true, flags: [], warnings: [], verificationStatus: 'verified', timestamp: Date.now() },
  });
  mockHandleThreat.mockResolvedValue({ action: 'allowed', flag: null });
  mockGetFlags.mockResolvedValue([]);
  mockGetCivicPenalty.mockResolvedValue(0);

  // Reputation pipeline defaults
  mockComputeStakeWeights.mockReturnValue([]);
  mockBuildGraph.mockReturnValue({ nodes: [], edges: [] });
  mockSaveGraph.mockResolvedValue(undefined);
  mockComputeTrustPropagation.mockReturnValue({
    trustMatrix: new Map(),
    iterations: 3,
    converged: true,
    computeTimeMs: 10,
  });
  mockGetGlobalTrustRanking.mockReturnValue([]);
  mockDetectSybilPatterns.mockResolvedValue({
    alerts: [],
    analysisTimestamp: Date.now(),
    reasoning: 'No suspicious patterns',
  });
  mockStoreSybilAlerts.mockResolvedValue(undefined);
  mockSynthesizeScore.mockReturnValue({
    agentId: 'test',
    finalScore: 5.0,
    components: { stakeWeightedScore: 5, trustPropagationScore: 5, sybilPenalty: 0, civicPenalty: 0 },
    classification: 'neutral',
  });
  mockClassifyAgent.mockReturnValue('neutral');
  mockGenerateExplanation.mockResolvedValue('Test explanation');
  mockStoreExplanation.mockResolvedValue({ cid: 'QmTestCid123', storedInKV: true });
  mockAppendReputationResponse.mockResolvedValue({ txHash: '0xwriteback123' });
  mockTriggerReputationPipeline.mockResolvedValue(undefined);
  mockPin.mockResolvedValue('QmTestCid123');
}

// ──────────────────────────────────────────
// Lifecycle
// ──────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  if (!fs.existsSync(TEST_STATE_DIR)) {
    fs.mkdirSync(TEST_STATE_DIR, { recursive: true });
  }
  setupDefaultMocks();
});

afterEach(() => {
  if (fs.existsSync(TEST_STATE_PATH)) {
    fs.unlinkSync(TEST_STATE_PATH);
  }
});

// ══════════════════════════════════════════
// Phase C: Adversarial Entry
// ══════════════════════════════════════════

describe('Phase C execution', () => {
  it('processes all 30 Phase C interactions', async () => {
    const state = createPhaseABCompletedState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH, phases: ['C'] });
    engine.loadConfigs();
    await engine.executePhase('C');

    const updated = loadEngineState(TEST_STATE_PATH);
    const phaseCCompleted = updated!.completedInteractions.filter(id => id.startsWith('C-'));
    expect(phaseCCompleted).toHaveLength(30);
    expect(updated!.phasesCompleted).toContain('C');
  });

  it('executes Sybil ring circular payments (X2->X3, X3->X4, X4->X2)', async () => {
    const state = createPhaseABCompletedState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH, phases: ['C'] });
    engine.loadConfigs();
    await engine.executePhase('C');

    // Sybil ring interactions: C-005 through C-013 (9 circular payments)
    // Each should have called executePayment and giveFeedback
    const paymentCalls = mockExecutePayment.mock.calls;
    const sybilPayments = paymentCalls.filter(
      (call: unknown[]) => {
        const arg = call[0] as { payerAgentId: string; payeeAgentId: string };
        const payer = arg.payerAgentId;
        const payee = arg.payeeAgentId;
        return (
          (payer === 'agent-X2' && payee === 'agent-X3') ||
          (payer === 'agent-X3' && payee === 'agent-X4') ||
          (payer === 'agent-X4' && payee === 'agent-X2')
        );
      }
    );
    // 9 circular payments + 9 reputation farming = 18 Sybil-related payments
    // But circular specifically: X2->X3 (3), X3->X4 (3), X4->X2 (3) = 9
    expect(sybilPayments.length).toBeGreaterThanOrEqual(9);
  });

  it('executes X1 legitimate jobs with positive feedback', async () => {
    const state = createPhaseABCompletedState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH, phases: ['C'] });
    engine.loadConfigs();
    await engine.executePhase('C');

    // X1 is provider in C-001 through C-004 (4 legitimate jobs)
    const feedbackCalls = mockGiveFeedback.mock.calls.filter(
      (call: unknown[]) => (call[0] as { targetAgentId: string }).targetAgentId === 'agent-X1'
    );
    expect(feedbackCalls.length).toBeGreaterThanOrEqual(4);
    // All should be positive (isPositive=true)
    for (const call of feedbackCalls) {
      expect((call[0] as { isPositive: boolean }).isPositive).toBe(true);
    }
  });

  it('does not run Civic L2 inspection in Phase C (civicCheckEnabled=false)', async () => {
    const state = createPhaseABCompletedState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH, phases: ['C'] });
    engine.loadConfigs();
    await engine.executePhase('C');

    // Phase C has civicCheckEnabled=false, so inspectBehavior should not be called
    expect(mockInspectBehavior).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════
// Phase D: Detection and Consequences
// ══════════════════════════════════════════

describe('Phase D execution', () => {
  function createPhaseCCompletedState(): EngineState {
    const phaseCIds = Array.from({ length: 30 }, (_, i) => `C-${String(i + 1).padStart(3, '0')}`);
    return createRegisteredState({
      completedInteractions: [
        ...Array.from({ length: 40 }, (_, i) => `A-${String(i + 1).padStart(3, '0')}`),
        ...Array.from({ length: 50 }, (_, i) => `B-${String(i + 1).padStart(3, '0')}`),
        ...phaseCIds,
      ],
      phasesCompleted: ['A', 'B', 'C'],
      reputationComputed: ['B'],
    });
  }

  it('processes all 40 Phase D interactions', async () => {
    const state = createPhaseCCompletedState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH, phases: ['D'] });
    engine.loadConfigs();
    await engine.executePhase('D');

    const updated = loadEngineState(TEST_STATE_PATH);
    const phaseDCompleted = updated!.completedInteractions.filter(id => id.startsWith('D-'));
    expect(phaseDCompleted).toHaveLength(40);
  });

  it('runs Civic L2 inspection on deliverables in Phase D (civicCheckEnabled=true)', async () => {
    const state = createPhaseCCompletedState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH, phases: ['D'] });
    engine.loadConfigs();
    await engine.executePhase('D');

    // Phase D has civicCheckEnabled=true, so inspectBehavior should be called
    // for non-rejected interactions that have deliverables
    // D-001, D-002 are malicious; D-013 through D-040 are legitimate
    // D-003 through D-012 are rejected (no payment/delivery)
    expect(mockInspectBehavior).toHaveBeenCalled();
  });

  it('detects malicious content in D-001 and D-002 via Civic L2', async () => {
    // Mock Civic to catch malicious content on D-001 and D-002 interactions
    let inspectCallCount = 0;
    mockInspectBehavior.mockImplementation(async (agentId: string) => {
      inspectCallCount++;
      // X1 deliverables are malicious
      if (agentId === 'agent-X1') {
        return {
          result: {
            passed: false,
            flags: [{ severity: 'Critical', attackType: 'prompt_injection', message: 'Prompt injection detected' }],
            warnings: ['Malicious content detected'],
            verificationStatus: 'flagged',
            timestamp: Date.now(),
          },
        };
      }
      return {
        result: { passed: true, flags: [], warnings: [], verificationStatus: 'verified', timestamp: Date.now() },
      };
    });

    mockHandleThreat.mockResolvedValue({
      action: 'blocked',
      flag: {
        id: 'civic-test-flag',
        agentId: 'agent-X1',
        severity: 'Critical',
        layer: 'behavioral',
        attackType: 'prompt_injection',
        evidence: 'Prompt injection detected in deliverable',
        timestamp: Date.now(),
      },
    });

    const state = createPhaseCCompletedState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH, phases: ['D'] });
    engine.loadConfigs();
    await engine.executePhase('D');

    // handleThreat should have been called for X1's malicious deliverables
    const threatCalls = mockHandleThreat.mock.calls.filter(
      (call: unknown[]) => {
        const result = call[0] as { agentId: string };
        return result.agentId === 'agent-X1';
      }
    );
    expect(threatCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('submits negative feedback for Civic-caught malicious interactions', async () => {
    mockInspectBehavior.mockImplementation(async (agentId: string) => {
      if (agentId === 'agent-X1') {
        return {
          result: {
            passed: false,
            flags: [{ severity: 'Critical', attackType: 'prompt_injection' }],
            warnings: [],
            verificationStatus: 'flagged',
            timestamp: Date.now(),
          },
        };
      }
      return {
        result: { passed: true, flags: [], warnings: [], verificationStatus: 'verified', timestamp: Date.now() },
      };
    });
    mockHandleThreat.mockResolvedValue({ action: 'blocked', flag: null });

    const state = createPhaseCCompletedState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH, phases: ['D'] });
    engine.loadConfigs();
    await engine.executePhase('D');

    // D-001 and D-002: X1 delivers malicious content, feedback should be negative
    const x1Feedback = mockGiveFeedback.mock.calls.filter(
      (call: unknown[]) => (call[0] as { targetAgentId: string }).targetAgentId === 'agent-X1'
    );
    // D-001 and D-002 should have isPositive=false (Civic override)
    const negativeFeedback = x1Feedback.filter(
      (call: unknown[]) => (call[0] as { isPositive: boolean }).isPositive === false
    );
    expect(negativeFeedback.length).toBeGreaterThanOrEqual(2);
  });

  it('emits seed:civic-catch events for malicious detections', async () => {
    mockInspectBehavior.mockImplementation(async (agentId: string) => {
      if (agentId === 'agent-X1') {
        return {
          result: { passed: false, flags: [{ severity: 'Critical' }], warnings: [], verificationStatus: 'flagged', timestamp: Date.now() },
        };
      }
      return { result: { passed: true, flags: [], warnings: [], verificationStatus: 'verified', timestamp: Date.now() } };
    });
    mockHandleThreat.mockResolvedValue({ action: 'blocked', flag: null });

    const state = createPhaseCCompletedState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH, phases: ['D'] });
    engine.loadConfigs();
    await engine.executePhase('D');

    const civicEmits = mockEmit.mock.calls.filter(
      (call: unknown[]) => (call[0] as Record<string, unknown>).type === 'seed:civic-catch'
    );
    expect(civicEmits.length).toBeGreaterThanOrEqual(2);
  });

  it('handles rejected interactions without payment or delivery', async () => {
    const state = createPhaseCCompletedState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH, phases: ['D'] });
    engine.loadConfigs();
    await engine.executePhase('D');

    // Phase D has 12 rejected interactions (D-003 through D-012)
    // They should be completed but no payment executed
    const updated = loadEngineState(TEST_STATE_PATH);
    expect(updated!.completedInteractions).toContain('D-003');
    expect(updated!.completedInteractions).toContain('D-012');
  });
});

// ══════════════════════════════════════════
// Full Reputation Pipeline
// ══════════════════════════════════════════

describe('full reputation pipeline (computeReputation)', () => {
  function createFullState(): EngineState {
    return createRegisteredState({
      completedInteractions: [
        ...Array.from({ length: 40 }, (_, i) => `A-${String(i + 1).padStart(3, '0')}`),
        ...Array.from({ length: 50 }, (_, i) => `B-${String(i + 1).padStart(3, '0')}`),
        ...Array.from({ length: 30 }, (_, i) => `C-${String(i + 1).padStart(3, '0')}`),
        ...Array.from({ length: 40 }, (_, i) => `D-${String(i + 1).padStart(3, '0')}`),
      ],
      phasesCompleted: ['A', 'B', 'C', 'D'],
      reputationComputed: ['B'],
    });
  }

  it('calls computeStakeWeights with feedback records from completed interactions', async () => {
    const state = createFullState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.computeReputation('D');

    expect(mockComputeStakeWeights).toHaveBeenCalledTimes(1);
    const feedbackRecords = mockComputeStakeWeights.mock.calls[0][0];
    // Should have feedback for non-rejected interactions
    expect(feedbackRecords.length).toBeGreaterThan(0);
  });

  it('builds payment graph from transaction history', async () => {
    const state = createFullState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.computeReputation('D');

    expect(mockBuildGraph).toHaveBeenCalledTimes(1);
    expect(mockSaveGraph).toHaveBeenCalledTimes(1);
  });

  it('runs trust propagation on the payment graph', async () => {
    const state = createFullState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.computeReputation('D');

    expect(mockComputeTrustPropagation).toHaveBeenCalledTimes(1);
    expect(mockGetGlobalTrustRanking).toHaveBeenCalledTimes(1);
  });

  it('runs Sybil detection with graph and transaction history', async () => {
    const state = createFullState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.computeReputation('D');

    expect(mockDetectSybilPatterns).toHaveBeenCalledTimes(1);
    const input = mockDetectSybilPatterns.mock.calls[0][0];
    expect(input).toHaveProperty('graph');
    expect(input).toHaveProperty('transactionHistory');
    expect(input).toHaveProperty('agentIds');
  });

  it('stores Sybil alerts when detected', async () => {
    mockDetectSybilPatterns.mockResolvedValue({
      alerts: [
        {
          id: 'sybil-test-1',
          patternType: 'circular_payments',
          involvedAgents: ['agent-X2', 'agent-X3', 'agent-X4'],
          confidence: 0.95,
          evidence: 'Circular payment pattern X2->X3->X4->X2',
          timestamp: Date.now(),
        },
      ],
      analysisTimestamp: Date.now(),
      reasoning: 'Circular payments detected',
    });

    const state = createFullState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.computeReputation('D');

    expect(mockStoreSybilAlerts).toHaveBeenCalledTimes(1);
  });

  it('synthesizes scores for all 28 agents', async () => {
    const state = createFullState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.computeReputation('D');

    expect(mockSynthesizeScore).toHaveBeenCalledTimes(28);
    expect(mockClassifyAgent).toHaveBeenCalledTimes(28);
  });

  it('passes correct inputs to synthesizeScore for adversarial agents', async () => {
    mockDetectSybilPatterns.mockResolvedValue({
      alerts: [
        {
          id: 'sybil-test-1',
          patternType: 'circular_payments',
          involvedAgents: ['agent-X2', 'agent-X3', 'agent-X4'],
          confidence: 0.95,
          evidence: 'Circular payment pattern',
          timestamp: Date.now(),
        },
      ],
      analysisTimestamp: Date.now(),
      reasoning: 'Detected',
    });
    mockGetCivicPenalty.mockImplementation(async (agentId: string) => {
      if (agentId === 'agent-X1') return 8.0; // Critical civic flags
      return 0;
    });

    const state = createFullState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.computeReputation('D');

    // Find synthesizeScore call for X1
    const x1Call = mockSynthesizeScore.mock.calls.find(
      (call: unknown[]) => (call[0] as { agentId: string }).agentId === 'agent-X1'
    );
    expect(x1Call).toBeDefined();
    expect((x1Call![0] as { civicPenalty: number }).civicPenalty).toBe(8.0);

    // Find synthesizeScore call for X2
    const x2Call = mockSynthesizeScore.mock.calls.find(
      (call: unknown[]) => (call[0] as { agentId: string }).agentId === 'agent-X2'
    );
    expect(x2Call).toBeDefined();
    expect((x2Call![0] as { sybilAlerts: unknown[] }).sybilAlerts.length).toBeGreaterThanOrEqual(1);
  });

  it('generates explanations for all agents', async () => {
    const state = createFullState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.computeReputation('D');

    expect(mockGenerateExplanation).toHaveBeenCalledTimes(28);
    expect(mockStoreExplanation).toHaveBeenCalledTimes(28);
  });

  it('writes back enriched scores via appendReputationResponse for all 28 agents', async () => {
    const state = createFullState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.computeReputation('D');

    expect(mockAppendReputationResponse).toHaveBeenCalledTimes(28);

    // Each call should include agentId, score, explanationCid
    for (const call of mockAppendReputationResponse.mock.calls) {
      const data = call[0] as { agentId: string; score: number; explanationCid: string };
      expect(data.agentId).toBeTruthy();
      expect(typeof data.score).toBe('number');
      expect(typeof data.explanationCid).toBe('string');
    }
  });

  it('marks phase in reputationComputed after pipeline completes', async () => {
    const state = createFullState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.computeReputation('D');

    const updated = loadEngineState(TEST_STATE_PATH);
    expect(updated!.reputationComputed).toContain('D');
  });

  it('emits seed:reputation-computed event with Sybil alert count', async () => {
    mockDetectSybilPatterns.mockResolvedValue({
      alerts: [{ id: 'a1', patternType: 'circular_payments', involvedAgents: ['X2', 'X3', 'X4'], confidence: 0.9, evidence: 'test', timestamp: Date.now() }],
      analysisTimestamp: Date.now(),
      reasoning: 'test',
    });

    const state = createFullState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH });
    engine.loadConfigs();
    await engine.computeReputation('D');

    const repEmits = mockEmit.mock.calls.filter(
      (call: unknown[]) => (call[0] as Record<string, unknown>).type === 'seed:reputation-computed'
    );
    expect(repEmits.length).toBe(1);
    const emitData = (repEmits[0][0] as Record<string, unknown>).data as Record<string, unknown>;
    expect(emitData.sybilAlerts).toBe(1);
  });
});

// ══════════════════════════════════════════
// Phase E: Mature Ecosystem
// ══════════════════════════════════════════

describe('Phase E execution', () => {
  function createPhaseDCompletedState(): EngineState {
    return createRegisteredState({
      completedInteractions: [
        ...Array.from({ length: 40 }, (_, i) => `A-${String(i + 1).padStart(3, '0')}`),
        ...Array.from({ length: 50 }, (_, i) => `B-${String(i + 1).padStart(3, '0')}`),
        ...Array.from({ length: 30 }, (_, i) => `C-${String(i + 1).padStart(3, '0')}`),
        ...Array.from({ length: 40 }, (_, i) => `D-${String(i + 1).padStart(3, '0')}`),
      ],
      phasesCompleted: ['A', 'B', 'C', 'D'],
      reputationComputed: ['B', 'D'],
    });
  }

  it('processes all 50 Phase E interactions', async () => {
    const state = createPhaseDCompletedState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH, phases: ['E'] });
    engine.loadConfigs();
    await engine.executePhase('E');

    const updated = loadEngineState(TEST_STATE_PATH);
    const phaseECompleted = updated!.completedInteractions.filter(id => id.startsWith('E-'));
    expect(phaseECompleted).toHaveLength(50);
  });

  it('runs Civic L2 inspection in Phase E (civicCheckEnabled=true)', async () => {
    const state = createPhaseDCompletedState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({ statePath: TEST_STATE_PATH, phases: ['E'] });
    engine.loadConfigs();
    await engine.executePhase('E');

    // Phase E has civicCheckEnabled=true
    expect(mockInspectBehavior).toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════
// Verification Report
// ══════════════════════════════════════════

describe('verification report', () => {
  it('generateVerificationReport returns structured summary', async () => {
    const { generateVerificationReport } = await import('../../seed/verify');
    const { AGENT_ROSTER } = await import('../../seed/agents');

    mockKvGet.mockResolvedValue(null); // No cached scores

    const state = createRegisteredState({
      completedInteractions: [
        ...Array.from({ length: 40 }, (_, i) => `A-${String(i + 1).padStart(3, '0')}`),
        ...Array.from({ length: 50 }, (_, i) => `B-${String(i + 1).padStart(3, '0')}`),
        ...Array.from({ length: 30 }, (_, i) => `C-${String(i + 1).padStart(3, '0')}`),
        ...Array.from({ length: 40 }, (_, i) => `D-${String(i + 1).padStart(3, '0')}`),
        ...Array.from({ length: 50 }, (_, i) => `E-${String(i + 1).padStart(3, '0')}`),
      ],
      phasesCompleted: ['A', 'B', 'C', 'D', 'E'],
      reputationComputed: ['B', 'D', 'E'],
    });

    const report = await generateVerificationReport(state, AGENT_ROSTER);
    expect(report.totalAgents).toBe(28);
    expect(report.totalInteractions).toBe(210);
    expect(report.totalUsdcTransacted).toBeGreaterThan(0);
    expect(report.phasesCompleted).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('returns agent scores sorted descending', async () => {
    const { generateVerificationReport } = await import('../../seed/verify');
    const { AGENT_ROSTER } = await import('../../seed/agents');

    // Mock different scores for different agents
    mockKvGet.mockImplementation(async (key: string) => {
      if (key.includes('agent-S1')) return { score: 9.2 };
      if (key.includes('agent-S2')) return { score: 9.5 };
      if (key.includes('agent-X1')) return { score: 1.5 };
      if (key.includes('agent-X2')) return { score: 1.2 };
      if (key.includes('agent-X3')) return { score: 1.0 };
      if (key.includes('agent-X4')) return { score: 1.8 };
      return { score: 6.0 };
    });

    const state = createRegisteredState({
      completedInteractions: Array.from({ length: 210 }, (_, i) => {
        const phase = i < 40 ? 'A' : i < 90 ? 'B' : i < 120 ? 'C' : i < 160 ? 'D' : 'E';
        const num = i < 40 ? i + 1 : i < 90 ? i - 39 : i < 120 ? i - 89 : i < 160 ? i - 119 : i - 159;
        return `${phase}-${String(num).padStart(3, '0')}`;
      }),
      phasesCompleted: ['A', 'B', 'C', 'D', 'E'],
    });

    const report = await generateVerificationReport(state, AGENT_ROSTER);

    // Scores should be sorted descending
    for (let i = 1; i < report.agentScores.length; i++) {
      expect(report.agentScores[i - 1].score).toBeGreaterThanOrEqual(report.agentScores[i].score);
    }
  });
});

// ══════════════════════════════════════════
// Full C/D/E Run Orchestration
// ══════════════════════════════════════════

describe('full C/D/E run', () => {
  it('executes phases C->D->E sequentially with reputation after D and E', async () => {
    const state = createPhaseABCompletedState();
    saveEngineState(state, TEST_STATE_PATH);

    const engine = new SeedEngine({
      statePath: TEST_STATE_PATH,
      phases: ['C', 'D', 'E'],
    });
    await engine.run();

    const updated = loadEngineState(TEST_STATE_PATH);
    expect(updated!.phasesCompleted).toContain('C');
    expect(updated!.phasesCompleted).toContain('D');
    expect(updated!.phasesCompleted).toContain('E');

    // Phase D triggers reputation compute (triggerReputationCompute=true)
    // Phase E triggers reputation compute (triggerReputationCompute=true)
    expect(updated!.reputationComputed).toContain('D');
    expect(updated!.reputationComputed).toContain('E');
  });
});
