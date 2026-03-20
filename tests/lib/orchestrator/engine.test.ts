import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrchestratorEngine } from '@/lib/orchestrator/engine';
import { LifecycleStep } from '@/lib/orchestrator/types';
import type { LifecycleRequest, LifecycleResult } from '@/lib/orchestrator/types';

// --- Mocks (same as lifecycle.test.ts) ---

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

vi.mock('@/lib/protocols/a2a/client', () => ({
  discoverAgents: vi.fn().mockResolvedValue([
    { name: 'CodeGuard', skills: [{ id: 'review_code' }], erc8004AgentId: 'agent-b', reputationScore: 9.1 },
  ]),
  sendTask: vi.fn().mockResolvedValue({
    id: 'task-123',
    status: 'completed',
    messages: [],
    artifacts: [{ type: 'text', data: 'Deliverable content' }],
  }),
}));

vi.mock('@/lib/orchestrator/task-router', () => ({
  routeTask: vi.fn().mockResolvedValue({
    selectedAgentId: 'agent-b',
    capability: 'review_code',
    candidates: [{ agentId: 'agent-b', role: 'reviewer', reputationScore: 9.1 }],
    excluded: [],
    reason: 'Highest reputation',
  }),
}));

vi.mock('@/lib/orchestrator/negotiation', () => ({
  negotiatePrice: vi.fn().mockResolvedValue({
    status: 'agreed',
    agreedPrice: 6,
    rounds: 1,
    messages: [],
  }),
}));

vi.mock('@/lib/civic/gateway', () => ({
  getCivicGateway: vi.fn(() => ({
    inspectBehavior: vi.fn().mockResolvedValue({
      result: { passed: true, flags: [], layer: 'behavioral', agentId: 'agent-b', warnings: [], verificationStatus: 'verified', timestamp: Date.now() },
    }),
    inspectIdentity: vi.fn().mockResolvedValue({ result: { passed: true, flags: [] } }),
  })),
  CivicGateway: vi.fn(),
}));

vi.mock('@/lib/protocols/x402/client', () => ({
  executePayment: vi.fn().mockResolvedValue({
    txHash: '0xpayment123',
    payer: '0xpayer',
    payee: '0xpayee',
    amount: '6.00',
    status: 'settled',
    timestamp: Date.now(),
  }),
}));

vi.mock('@/lib/protocols/x402/proof', () => ({
  recordPaymentProofs: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/protocols/mcp/server', () => ({
  executeTool: vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'Task result' }],
    isError: false,
  }),
}));

vi.mock('@/lib/agents/evaluator', () => ({
  evaluateDeliverable: vi.fn().mockResolvedValue({
    decision: 'accept',
    reasoning: 'Good quality',
    scores: { completeness: 9, accuracy: 9, relevance: 9, quality: 9 },
    evaluatorAgentId: 'researcher',
    targetAgentId: 'agent-b',
    taskId: 'task-123',
  }),
  prepareFeedback: vi.fn().mockReturnValue({
    targetAgentId: 'agent-b',
    isPositive: true,
    reasoning: 'Good quality',
    proofOfPayment: '0xpayment123',
    paymentAmount: '6.00',
  }),
}));

vi.mock('@/lib/protocols/erc8004/reputation', () => ({
  giveFeedback: vi.fn().mockResolvedValue({
    txHash: '0xfeedback456',
    feedbackerAgentId: 'researcher',
    targetAgentId: 'agent-b',
    isPositive: true,
    timestamp: Date.now(),
  }),
}));

vi.mock('@/lib/reputation/engine', () => ({
  triggerReputationPipeline: vi.fn().mockResolvedValue({
    agentId: 'agent-b',
    status: 'computing',
    pipelineStages: [],
    startedAt: Date.now(),
  }),
}));

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

describe('OrchestratorEngine', () => {
  let engine: OrchestratorEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new OrchestratorEngine();
  });

  it('coordinates all modules correctly via executeLifecycle', async () => {
    const request: LifecycleRequest = {
      requesterId: 'researcher',
      taskDescription: 'Review auth code',
      capability: 'review_code',
      maxBudget: 10,
    };

    const result = await engine.executeLifecycle(request);

    expect(result.success).toBe(true);
    expect(result.selectedAgentId).toBe('agent-b');
    expect(result.negotiatedPrice).toBe(6);
    expect(result.paymentTxHash).toBe('0xpayment123');
  });

  it('state tracking works across steps', async () => {
    const request: LifecycleRequest = {
      requesterId: 'researcher',
      taskDescription: 'Review code',
      capability: 'review_code',
    };

    const result = await engine.executeLifecycle(request);

    // Final result should have accumulated state from all steps
    expect(result.selectedAgentId).toBe('agent-b');
    expect(result.negotiatedPrice).toBe(6);
    expect(result.paymentTxHash).toBe('0xpayment123');
    expect(result.feedbackTxHash).toBe('0xfeedback456');
    expect(result.reputationUpdated).toBe(true);
  });

  it('result contains all expected fields', async () => {
    const request: LifecycleRequest = {
      requesterId: 'researcher',
      taskDescription: 'Review code',
      capability: 'review_code',
    };

    const result: LifecycleResult = await engine.executeLifecycle(request);

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('selectedAgentId');
    expect(result).toHaveProperty('negotiatedPrice');
    expect(result).toHaveProperty('paymentTxHash');
    expect(result).toHaveProperty('deliverable');
    expect(result).toHaveProperty('feedbackTxHash');
    expect(result).toHaveProperty('reputationUpdated');
    expect(result).toHaveProperty('civicFlags');
  });
});
