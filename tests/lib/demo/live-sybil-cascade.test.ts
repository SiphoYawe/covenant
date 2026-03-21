import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockEmit = vi.fn().mockResolvedValue({ id: 'e1', timestamp: Date.now() });
vi.mock('@/lib/events/bus', () => ({
  createEventBus: () => ({ emit: mockEmit, since: vi.fn().mockResolvedValue([]) }),
}));

vi.mock('@/lib/events/constants', async () => {
  const actual = await vi.importActual<typeof import('@/lib/events/constants')>('@/lib/events/constants');
  return actual;
});

vi.mock('@/lib/events/types', () => ({
  Protocol: {
    A2a: 'a2a',
    X402: 'x402',
    Civic: 'civic',
    Erc8004: 'erc8004',
    CovenantAi: 'covenant-ai',
    Mcp: 'mcp',
  },
}));

const mockDetectSybilPatterns = vi.fn().mockResolvedValue({
  alerts: [
    {
      id: 'sybil-1',
      patternType: 'circular_payment',
      involvedAgents: ['seed-X2', 'seed-X3', 'seed-X4'],
      confidence: 0.95,
      evidence: 'Circular payments: X2->X3->X4->X2',
    },
  ],
});

const mockStoreSybilAlerts = vi.fn().mockResolvedValue(undefined);

const mockBuildGraph = vi.fn().mockReturnValue({
  nodes: [
    { agentId: 'seed-X2' },
    { agentId: 'seed-X3' },
    { agentId: 'seed-X4' },
  ],
  edges: [
    { source: 'seed-X2', target: 'seed-X3', weight: 6 },
    { source: 'seed-X3', target: 'seed-X4', weight: 6 },
    { source: 'seed-X4', target: 'seed-X2', weight: 6 },
  ],
});

const mockGetGraph = vi.fn().mockResolvedValue({
  nodes: [
    { agentId: 'seed-X2' },
    { agentId: 'seed-X3' },
    { agentId: 'seed-X4' },
  ],
  edges: [
    { source: 'seed-X2', target: 'seed-X3', weight: 6 },
    { source: 'seed-X3', target: 'seed-X4', weight: 6 },
    { source: 'seed-X4', target: 'seed-X2', weight: 6 },
  ],
});

const mockSynthesizeScore = vi.fn().mockReturnValue({
  finalScore: 2.1,
  components: {},
});

const mockClassifyAgent = vi.fn().mockReturnValue('adversarial');

const mockGenerateExplanation = vi.fn().mockResolvedValue({
  explanation: 'Agent is part of a Sybil ring with circular payment patterns.',
  confidence: 0.95,
});

const mockStoreExplanation = vi.fn().mockResolvedValue({
  cid: 'Qm-explanation-123',
});

const mockAppendReputationResponse = vi.fn().mockResolvedValue({
  txHash: '0xwriteback123',
});

const mockComputeStakeWeights = vi.fn().mockReturnValue([
  { agentId: 'seed-X2', weightedAverage: 3.0 },
  { agentId: 'seed-X3', weightedAverage: 3.2 },
  { agentId: 'seed-X4', weightedAverage: 2.8 },
]);

const mockComputeTrustPropagation = vi.fn().mockReturnValue({
  scores: { 'seed-X2': 2.5, 'seed-X3': 2.8, 'seed-X4': 2.3 },
});

const mockGetGlobalTrustRanking = vi.fn().mockReturnValue([
  { agentId: 'seed-X2', avgTrust: 2.5 },
  { agentId: 'seed-X3', avgTrust: 2.8 },
  { agentId: 'seed-X4', avgTrust: 2.3 },
]);

const mockGetCivicPenalty = vi.fn().mockResolvedValue(0);

vi.mock('@/lib/reputation/sybil-detection', () => ({
  detectSybilPatterns: (...args: unknown[]) => mockDetectSybilPatterns(...args),
  storeSybilAlerts: (...args: unknown[]) => mockStoreSybilAlerts(...args),
}));

vi.mock('@/lib/reputation/graph', () => ({
  buildGraph: (...args: unknown[]) => mockBuildGraph(...args),
  getGraph: (...args: unknown[]) => mockGetGraph(...args),
  saveGraph: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/reputation/score-synthesis', () => ({
  synthesizeScore: (...args: unknown[]) => mockSynthesizeScore(...args),
  classifyAgent: (...args: unknown[]) => mockClassifyAgent(...args),
}));

vi.mock('@/lib/reputation/explanation', () => ({
  generateExplanation: (...args: unknown[]) => mockGenerateExplanation(...args),
  storeExplanation: (...args: unknown[]) => mockStoreExplanation(...args),
}));

vi.mock('@/lib/protocols/erc8004/write-back', () => ({
  appendReputationResponse: (...args: unknown[]) => mockAppendReputationResponse(...args),
}));

vi.mock('@/lib/reputation/stake-weighting', () => ({
  computeStakeWeights: (...args: unknown[]) => mockComputeStakeWeights(...args),
}));

vi.mock('@/lib/reputation/trust-propagation', () => ({
  computeTrustPropagation: (...args: unknown[]) => mockComputeTrustPropagation(...args),
  getGlobalTrustRanking: (...args: unknown[]) => mockGetGlobalTrustRanking(...args),
}));

vi.mock('@/lib/civic/reputation-bridge', () => ({
  getCivicPenalty: (...args: unknown[]) => mockGetCivicPenalty(...args),
}));

vi.mock('@/lib/storage/kv', () => ({
  kvGet: vi.fn().mockResolvedValue(null),
  kvSet: vi.fn().mockResolvedValue(undefined),
}));

describe('executeSybilCascade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects Sybil ring and returns structured result', async () => {
    const { executeSybilCascade } = await import('@/lib/demo/live-sybil-cascade');
    const result = await executeSybilCascade({
      ringAgentIds: ['seed-X2', 'seed-X3', 'seed-X4'],
    });

    expect(result.success).toBe(true);
    expect(result.ringMembers).toContain('seed-X2');
    expect(result.ringMembers).toContain('seed-X3');
    expect(result.ringMembers).toContain('seed-X4');
    expect(result.scoreDrops).toBeDefined();
    expect(result.explanation).toBeDefined();
  });

  it('calls Sybil detection with correct agents', async () => {
    const { executeSybilCascade } = await import('@/lib/demo/live-sybil-cascade');
    await executeSybilCascade({
      ringAgentIds: ['seed-X2', 'seed-X3', 'seed-X4'],
    });

    expect(mockDetectSybilPatterns).toHaveBeenCalledWith(
      expect.objectContaining({
        agentIds: ['seed-X2', 'seed-X3', 'seed-X4'],
      }),
    );
  });

  it('emits granular SSE events at each step', async () => {
    const { executeSybilCascade } = await import('@/lib/demo/live-sybil-cascade');
    await executeSybilCascade({
      ringAgentIds: ['seed-X2', 'seed-X3', 'seed-X4'],
    });

    const startEvents = mockEmit.mock.calls.filter(
      (call) => call[0].type === 'live:trigger-started',
    );
    expect(startEvents).toHaveLength(1);
    expect(startEvents[0][0].data.triggerType).toBe('sybil-cascade');

    const stepEvents = mockEmit.mock.calls.filter(
      (call) => call[0].type === 'live:trigger-step',
    );
    // evidence-flagged, analysis-started, pattern-detected, scores-dropping (per agent),
    // explanation-generating, onchain-writing, exclusion-applied
    expect(stepEvents.length).toBeGreaterThanOrEqual(6);

    const completeEvents = mockEmit.mock.calls.filter(
      (call) => call[0].type === 'live:trigger-completed',
    );
    expect(completeEvents).toHaveLength(1);
  });

  it('writes scores on-chain via appendReputationResponse', async () => {
    const { executeSybilCascade } = await import('@/lib/demo/live-sybil-cascade');
    await executeSybilCascade({
      ringAgentIds: ['seed-X2', 'seed-X3', 'seed-X4'],
    });

    // Should be called once per ring member
    expect(mockAppendReputationResponse).toHaveBeenCalledTimes(3);
  });

  it('generates explanations for ring members', async () => {
    const { executeSybilCascade } = await import('@/lib/demo/live-sybil-cascade');
    await executeSybilCascade({
      ringAgentIds: ['seed-X2', 'seed-X3', 'seed-X4'],
    });

    expect(mockGenerateExplanation).toHaveBeenCalledTimes(3);
  });

  it('returns tx hashes from on-chain write-back', async () => {
    const { executeSybilCascade } = await import('@/lib/demo/live-sybil-cascade');
    const result = await executeSybilCascade({
      ringAgentIds: ['seed-X2', 'seed-X3', 'seed-X4'],
    });

    expect(result.txHashes).toBeDefined();
    expect(Object.keys(result.txHashes).length).toBe(3);
  });

  it('handles detection failure gracefully', async () => {
    mockDetectSybilPatterns.mockRejectedValueOnce(new Error('Detection failed'));
    const { executeSybilCascade } = await import('@/lib/demo/live-sybil-cascade');
    const result = await executeSybilCascade({
      ringAgentIds: ['seed-X2', 'seed-X3', 'seed-X4'],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
