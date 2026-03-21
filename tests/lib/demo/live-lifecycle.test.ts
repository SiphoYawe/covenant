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

const mockDiscoverAgents = vi.fn().mockResolvedValue([
  { agentId: 'seed-S2', name: 'AuditShield', capabilities: ['audit_contract'] },
]);

const mockRouteTask = vi.fn().mockResolvedValue({
  selectedAgentId: 'seed-S2',
  candidates: [{ agentId: 'seed-S2', role: 'provider', reputationScore: 9.5 }],
  excluded: [],
  reason: 'Highest reputation',
});

const mockNegotiatePrice = vi.fn().mockResolvedValue({
  status: 'agreed',
  agreedPrice: 12,
  rounds: 2,
  messages: [],
});

const mockExecutePayment = vi.fn().mockResolvedValue({
  txHash: '0xpay123',
  amount: '12.00',
  timestamp: Date.now(),
});

const mockRecordPaymentProofs = vi.fn().mockResolvedValue(undefined);

const mockSendTask = vi.fn().mockResolvedValue({
  id: 'task-1',
  artifacts: [{ data: 'Audit report: no vulnerabilities found.' }],
  messages: [],
});

const mockInspectBehavior = vi.fn().mockResolvedValue({
  result: { passed: true, flags: [] },
});

const mockGiveFeedback = vi.fn().mockResolvedValue({
  txHash: '0xfeedback123',
});

const mockTriggerReputationPipeline = vi.fn().mockResolvedValue({
  agentId: 'seed-S2',
  status: 'computing',
  pipelineStages: [],
  startedAt: Date.now(),
});

vi.mock('@/lib/protocols/a2a/client', () => ({
  discoverAgents: (...args: unknown[]) => mockDiscoverAgents(...args),
  sendTask: (...args: unknown[]) => mockSendTask(...args),
}));

vi.mock('@/lib/orchestrator/task-router', () => ({
  routeTask: (...args: unknown[]) => mockRouteTask(...args),
}));

vi.mock('@/lib/orchestrator/negotiation', () => ({
  negotiatePrice: (...args: unknown[]) => mockNegotiatePrice(...args),
}));

vi.mock('@/lib/protocols/x402/client', () => ({
  executePayment: (...args: unknown[]) => mockExecutePayment(...args),
}));

vi.mock('@/lib/protocols/x402/proof', () => ({
  recordPaymentProofs: (...args: unknown[]) => mockRecordPaymentProofs(...args),
}));

vi.mock('@/lib/civic/gateway', () => ({
  getCivicGateway: () => ({
    inspectBehavior: (...args: unknown[]) => mockInspectBehavior(...args),
  }),
}));

vi.mock('@/lib/protocols/erc8004/reputation', () => ({
  giveFeedback: (...args: unknown[]) => mockGiveFeedback(...args),
}));

vi.mock('@/lib/reputation/engine', () => ({
  triggerReputationPipeline: (...args: unknown[]) => mockTriggerReputationPipeline(...args),
}));

vi.mock('@/lib/agents/evaluator', () => ({
  evaluateDeliverable: vi.fn().mockResolvedValue({
    decision: 'accept',
    reasoning: 'Quality audit',
    scores: { completeness: 8, accuracy: 9, relevance: 9, quality: 8 },
  }),
  prepareFeedback: vi.fn().mockReturnValue({
    targetAgentId: 'seed-S2',
    isPositive: true,
    reasoning: 'Accepted',
    proofOfPayment: '0xpay123',
    paymentAmount: '12.00',
  }),
}));

vi.mock('@/lib/config/constants', () => ({
  DEFAULT_REPUTATION_THRESHOLD: 5.0,
}));

describe('executeLiveLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes full lifecycle and returns structured result', async () => {
    const { executeLiveLifecycle } = await import('@/lib/demo/live-lifecycle');
    const result = await executeLiveLifecycle({
      requesterId: 'seed-R1',
      providerId: 'seed-S2',
      taskDescription: 'Audit the token transfer contract for reentrancy vulnerabilities',
      capability: 'audit_contract',
      maxBudget: 15,
    });

    expect(result.success).toBe(true);
    expect(result.providerId).toBe('seed-S2');
    expect(result.requesterId).toBe('seed-R1');
    expect(result.paymentTxHash).toBe('0xpay123');
    expect(result.feedbackTxHash).toBe('0xfeedback123');
    expect(result.negotiatedPrice).toBe(12);
  });

  it('calls protocol modules in correct sequence', async () => {
    const { executeLiveLifecycle } = await import('@/lib/demo/live-lifecycle');
    await executeLiveLifecycle({
      requesterId: 'seed-R1',
      providerId: 'seed-S2',
      taskDescription: 'Audit contract',
      capability: 'audit_contract',
      maxBudget: 15,
    });

    // Discovery
    expect(mockDiscoverAgents).toHaveBeenCalledWith('audit_contract');
    // Negotiation
    expect(mockNegotiatePrice).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterId: 'seed-R1',
        providerId: 'seed-S2',
      }),
    );
    // Payment
    expect(mockExecutePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        payerAgentId: 'seed-R1',
        payeeAgentId: 'seed-S2',
      }),
    );
    // Feedback
    expect(mockGiveFeedback).toHaveBeenCalled();
    // Reputation
    expect(mockTriggerReputationPipeline).toHaveBeenCalled();
  });

  it('emits granular SSE events at every step', async () => {
    const { executeLiveLifecycle } = await import('@/lib/demo/live-lifecycle');
    await executeLiveLifecycle({
      requesterId: 'seed-R1',
      providerId: 'seed-S2',
      taskDescription: 'Audit contract',
      capability: 'audit_contract',
      maxBudget: 15,
    });

    // Should emit LIVE_TRIGGER_STARTED, multiple LIVE_TRIGGER_STEP, and LIVE_TRIGGER_COMPLETED
    const startEvents = mockEmit.mock.calls.filter(
      (call) => call[0].type === 'live:trigger-started',
    );
    expect(startEvents).toHaveLength(1);

    const stepEvents = mockEmit.mock.calls.filter(
      (call) => call[0].type === 'live:trigger-step',
    );
    // At minimum: discovery-started, discovery-matched, negotiation-started, negotiation-agreed,
    // payment-initiated, payment-confirmed, delivery-started, delivery-complete,
    // civic-inspecting, civic-passed, feedback-submitting, feedback-confirmed,
    // reputation-computing, reputation-updated
    expect(stepEvents.length).toBeGreaterThanOrEqual(10);

    const completeEvents = mockEmit.mock.calls.filter(
      (call) => call[0].type === 'live:trigger-completed',
    );
    expect(completeEvents).toHaveLength(1);
  });

  it('returns steps array with timing for each step', async () => {
    const { executeLiveLifecycle } = await import('@/lib/demo/live-lifecycle');
    const result = await executeLiveLifecycle({
      requesterId: 'seed-R1',
      providerId: 'seed-S2',
      taskDescription: 'Audit contract',
      capability: 'audit_contract',
      maxBudget: 15,
    });

    expect(result.steps).toBeDefined();
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.steps[0]).toHaveProperty('name');
    expect(result.steps[0]).toHaveProperty('status');
  });

  it('handles payment failure gracefully', async () => {
    mockExecutePayment.mockRejectedValueOnce(new Error('Insufficient USDC'));
    const { executeLiveLifecycle } = await import('@/lib/demo/live-lifecycle');
    const result = await executeLiveLifecycle({
      requesterId: 'seed-R1',
      providerId: 'seed-S2',
      taskDescription: 'Audit contract',
      capability: 'audit_contract',
      maxBudget: 15,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('includes trigger type as lifecycle in events', async () => {
    const { executeLiveLifecycle } = await import('@/lib/demo/live-lifecycle');
    await executeLiveLifecycle({
      requesterId: 'seed-R1',
      providerId: 'seed-S2',
      taskDescription: 'Audit contract',
      capability: 'audit_contract',
      maxBudget: 15,
    });

    const startEvent = mockEmit.mock.calls.find(
      (call) => call[0].type === 'live:trigger-started',
    );
    expect(startEvent?.[0].data.triggerType).toBe('lifecycle');
  });
});
