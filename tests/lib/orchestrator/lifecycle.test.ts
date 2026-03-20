import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeLifecycle } from '@/lib/orchestrator/lifecycle';
import type { LifecycleRequest } from '@/lib/orchestrator/types';
import { LifecycleStep } from '@/lib/orchestrator/types';
import { CivicSeverity, CivicLayer } from '@/lib/civic/types';
import type { CivicFlag } from '@/lib/civic/types';

// --- Mocks ---

const mockEmit = vi.fn().mockResolvedValue({ id: 'test', timestamp: Date.now() });

vi.mock('@/lib/events/bus', () => ({
  createEventBus: vi.fn(() => ({
    emit: mockEmit,
    since: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/lib/storage/kv', () => ({
  kvGet: vi.fn().mockResolvedValue(null),
  kvSet: vi.fn(),
  kvDel: vi.fn(),
  kvLrange: vi.fn().mockResolvedValue([]),
  kvLpush: vi.fn(),
}));

// Mock A2A discovery
const mockDiscoverAgents = vi.fn();
vi.mock('@/lib/protocols/a2a/client', () => ({
  discoverAgents: (...args: unknown[]) => mockDiscoverAgents(...args),
  sendTask: vi.fn().mockResolvedValue({
    id: 'task-123',
    status: 'completed',
    messages: [],
    artifacts: [{ type: 'text', data: 'Deliverable content here' }],
  }),
}));

// Mock task router
const mockRouteTask = vi.fn();
vi.mock('@/lib/orchestrator/task-router', () => ({
  routeTask: (...args: unknown[]) => mockRouteTask(...args),
}));

// Mock negotiation
const mockNegotiatePrice = vi.fn();
vi.mock('@/lib/orchestrator/negotiation', () => ({
  negotiatePrice: (...args: unknown[]) => mockNegotiatePrice(...args),
}));

// Mock Civic gateway
const mockInspectBehavior = vi.fn();
vi.mock('@/lib/civic/gateway', () => ({
  getCivicGateway: vi.fn(() => ({
    inspectBehavior: (...args: unknown[]) => mockInspectBehavior(...args),
    inspectIdentity: vi.fn().mockResolvedValue({ result: { passed: true, flags: [] } }),
  })),
  CivicGateway: vi.fn(),
}));

// Mock x402 payment
const mockExecutePayment = vi.fn();
vi.mock('@/lib/protocols/x402/client', () => ({
  executePayment: (...args: unknown[]) => mockExecutePayment(...args),
}));

// Mock x402 proof
vi.mock('@/lib/protocols/x402/proof', () => ({
  recordPaymentProofs: vi.fn().mockResolvedValue(undefined),
}));

// Mock A2A server (for task execution)
vi.mock('@/lib/protocols/mcp/server', () => ({
  executeTool: vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'Task result' }],
    isError: false,
  }),
}));

// Mock evaluator
const mockEvaluateDeliverable = vi.fn();
const mockPrepareFeedback = vi.fn();
vi.mock('@/lib/agents/evaluator', () => ({
  evaluateDeliverable: (...args: unknown[]) => mockEvaluateDeliverable(...args),
  prepareFeedback: (...args: unknown[]) => mockPrepareFeedback(...args),
}));

// Mock ERC-8004 feedback
const mockGiveFeedback = vi.fn();
vi.mock('@/lib/protocols/erc8004/reputation', () => ({
  giveFeedback: (...args: unknown[]) => mockGiveFeedback(...args),
}));

// Mock reputation engine
const mockTriggerReputationPipeline = vi.fn();
vi.mock('@/lib/reputation/engine', () => ({
  triggerReputationPipeline: (...args: unknown[]) => mockTriggerReputationPipeline(...args),
}));

// Mock wallets
vi.mock('@/lib/wallets', () => ({
  getAddress: vi.fn().mockReturnValue('0x1234567890abcdef1234567890abcdef12345678'),
  getWallet: vi.fn(),
  getWalletInfo: vi.fn(),
  getPublicClient: vi.fn(),
}));

vi.mock('@/lib/config/env', () => ({
  env: {
    CIVIC_MCP_ENDPOINT: 'http://mock-civic',
    CIVIC_TOKEN: 'mock-token',
    ANTHROPIC_API_KEY: 'mock-key',
  },
}));

// --- Helper to set up happy path mocks ---

function setupHappyPath() {
  mockDiscoverAgents.mockResolvedValue([
    { name: 'CodeGuard', skills: [{ id: 'review_code' }], erc8004AgentId: 'agent-b', reputationScore: 9.1 },
  ]);

  mockRouteTask.mockResolvedValue({
    selectedAgentId: 'agent-b',
    capability: 'review_code',
    candidates: [{ agentId: 'agent-b', role: 'reviewer', reputationScore: 9.1 }],
    excluded: [],
    reason: 'Highest reputation',
  });

  mockNegotiatePrice.mockResolvedValue({
    status: 'agreed',
    agreedPrice: 6,
    rounds: 1,
    messages: [],
  });

  // Civic passes input and output
  mockInspectBehavior.mockResolvedValue({
    result: { passed: true, flags: [], layer: CivicLayer.Behavioral, agentId: 'agent-b', warnings: [], verificationStatus: 'verified', timestamp: Date.now() },
  });

  mockExecutePayment.mockResolvedValue({
    txHash: '0xpayment123',
    payer: '0xpayer',
    payee: '0xpayee',
    amount: '6.00',
    status: 'settled',
    timestamp: Date.now(),
  });

  mockEvaluateDeliverable.mockResolvedValue({
    decision: 'accept',
    reasoning: 'Good quality work',
    scores: { completeness: 9, accuracy: 9, relevance: 9, quality: 9 },
    evaluatorAgentId: 'researcher',
    targetAgentId: 'agent-b',
    taskId: 'task-123',
  });

  mockPrepareFeedback.mockReturnValue({
    targetAgentId: 'agent-b',
    isPositive: true,
    reasoning: 'Good quality work',
    proofOfPayment: '0xpayment123',
    paymentAmount: '6.00',
  });

  mockGiveFeedback.mockResolvedValue({
    txHash: '0xfeedback456',
    feedbackerAgentId: 'researcher',
    targetAgentId: 'agent-b',
    isPositive: true,
    timestamp: Date.now(),
  });

  mockTriggerReputationPipeline.mockResolvedValue({
    agentId: 'agent-b',
    status: 'computing',
    pipelineStages: [],
    startedAt: Date.now(),
  });
}

// --- Tests ---

const defaultRequest: LifecycleRequest = {
  requesterId: 'researcher',
  taskDescription: 'Review the authentication module for security vulnerabilities',
  capability: 'review_code',
  maxBudget: 10,
};

describe('executeLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it('happy path: full 10-step lifecycle completes successfully', async () => {
    const result = await executeLifecycle(defaultRequest);

    expect(result.success).toBe(true);
    expect(result.selectedAgentId).toBe('agent-b');
    expect(result.negotiatedPrice).toBe(6);
    expect(result.paymentTxHash).toBe('0xpayment123');
    expect(result.deliverable).toBeDefined();
    expect(result.feedbackTxHash).toBe('0xfeedback456');
    expect(result.reputationUpdated).toBe(true);
    expect(result.civicFlags).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it('payment failure at Step 5 halts lifecycle, no task execution occurs', async () => {
    mockExecutePayment.mockRejectedValue(new Error('PAYMENT_FAILED: Insufficient USDC'));

    const result = await executeLifecycle(defaultRequest);

    expect(result.success).toBe(false);
    expect(result.error?.error.code).toBe('PAYMENT_FAILED');
    // Evaluator should NOT have been called (no task execution after payment failure)
    expect(mockEvaluateDeliverable).not.toHaveBeenCalled();
  });

  it('Civic critical flag at Step 7 auto-rejects and submits negative feedback', async () => {
    const criticalFlag: CivicFlag = {
      id: 'flag-1',
      agentId: 'agent-b',
      timestamp: Date.now(),
      severity: CivicSeverity.Critical,
      layer: CivicLayer.Behavioral,
      attackType: 'malicious_content',
      evidence: 'Prompt injection detected in deliverable',
    };

    // Input passes, output flagged
    let callCount = 0;
    mockInspectBehavior.mockImplementation(() => {
      callCount++;
      if (callCount <= 1) {
        // Input inspection passes
        return Promise.resolve({
          result: { passed: true, flags: [], layer: CivicLayer.Behavioral, agentId: 'agent-b', warnings: [], verificationStatus: 'verified', timestamp: Date.now() },
        });
      }
      // Output inspection fails with critical flag
      return Promise.resolve({
        result: { passed: false, flags: [criticalFlag], layer: CivicLayer.Behavioral, agentId: 'agent-b', warnings: ['Critical threat'], verificationStatus: 'flagged', timestamp: Date.now() },
      });
    });

    // The auto-reject should prepare negative feedback
    mockPrepareFeedback.mockReturnValue({
      targetAgentId: 'agent-b',
      isPositive: false,
      reasoning: 'Civic critical flag: malicious_content',
      proofOfPayment: '0xpayment123',
      paymentAmount: '6.00',
    });

    const result = await executeLifecycle(defaultRequest);

    expect(result.success).toBe(false);
    expect(result.civicFlags).toHaveLength(1);
    expect(result.civicFlags[0].severity).toBe(CivicSeverity.Critical);
    // Evaluation should be skipped
    expect(mockEvaluateDeliverable).not.toHaveBeenCalled();
    // But feedback should still be submitted (negative)
    expect(mockGiveFeedback).toHaveBeenCalled();
  });

  it('no qualified agents at Step 2 fails with NO_QUALIFIED_AGENTS error', async () => {
    mockRouteTask.mockRejectedValue(
      new Error('NO_QUALIFIED_AGENTS: No agents with reputation >= 3.0 available for capability: review_code')
    );

    const result = await executeLifecycle(defaultRequest);

    expect(result.success).toBe(false);
    expect(result.error?.error.code).toBe('NO_QUALIFIED_AGENTS');
  });

  it('negotiation failure at Step 3 halts lifecycle', async () => {
    mockNegotiatePrice.mockResolvedValue({
      status: 'rejected',
      rounds: 1,
      messages: [],
    });

    const result = await executeLifecycle(defaultRequest);

    expect(result.success).toBe(false);
    expect(result.error?.error.code).toBe('NEGOTIATION_FAILED');
    expect(mockExecutePayment).not.toHaveBeenCalled();
  });

  it('each step emits lifecycle:step-completed event', async () => {
    await executeLifecycle(defaultRequest);

    // Check that step-completed events were emitted for each step
    const stepCompletedCalls = mockEmit.mock.calls.filter(
      (call) => call[0]?.type === 'lifecycle:step-completed'
    );

    // Should have events for all 10 steps
    expect(stepCompletedCalls.length).toBe(10);
  });

  it('lifecycle:started emitted at beginning', async () => {
    await executeLifecycle(defaultRequest);

    const startedCalls = mockEmit.mock.calls.filter(
      (call) => call[0]?.type === 'lifecycle:started'
    );

    expect(startedCalls).toHaveLength(1);
    expect(startedCalls[0][0].data.taskDescription).toBe(defaultRequest.taskDescription);
  });

  it('lifecycle:completed emitted at end with full result', async () => {
    await executeLifecycle(defaultRequest);

    const completedCalls = mockEmit.mock.calls.filter(
      (call) => call[0]?.type === 'lifecycle:completed'
    );

    expect(completedCalls).toHaveLength(1);
    expect(completedCalls[0][0].data.success).toBe(true);
  });

  it('lifecycle:failed emitted on error with correct step info', async () => {
    mockExecutePayment.mockRejectedValue(new Error('PAYMENT_FAILED: No funds'));

    await executeLifecycle(defaultRequest);

    const failedCalls = mockEmit.mock.calls.filter(
      (call) => call[0]?.type === 'lifecycle:failed'
    );

    expect(failedCalls).toHaveLength(1);
    expect(failedCalls[0][0].data.step).toBe(LifecycleStep.Payment);
  });

  it('evaluation rejection submits negative feedback and triggers reputation update', async () => {
    mockEvaluateDeliverable.mockResolvedValue({
      decision: 'reject',
      reasoning: 'Low quality work',
      scores: { completeness: 3, accuracy: 4, relevance: 5, quality: 3 },
      evaluatorAgentId: 'researcher',
      targetAgentId: 'agent-b',
      taskId: 'task-123',
    });

    mockPrepareFeedback.mockReturnValue({
      targetAgentId: 'agent-b',
      isPositive: false,
      reasoning: 'Low quality work',
      proofOfPayment: '0xpayment123',
      paymentAmount: '6.00',
    });

    const result = await executeLifecycle(defaultRequest);

    // Lifecycle completes but marks as unsuccessful due to rejection
    expect(result.success).toBe(false);
    expect(mockGiveFeedback).toHaveBeenCalled();
    expect(mockTriggerReputationPipeline).toHaveBeenCalled();
  });

  it('feedback/reputation failure does not fail the lifecycle', async () => {
    mockGiveFeedback.mockRejectedValue(new Error('On-chain feedback failed'));
    mockTriggerReputationPipeline.mockRejectedValue(new Error('Pipeline error'));

    const result = await executeLifecycle(defaultRequest);

    // Lifecycle should still succeed since feedback/reputation are best-effort
    expect(result.success).toBe(true);
    expect(result.reputationUpdated).toBe(false);
  });
});
