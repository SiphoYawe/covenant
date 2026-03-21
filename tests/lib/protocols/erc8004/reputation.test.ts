import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock agent0-sdk — sdk.giveFeedback(agentId, value, tag1, tag2, endpoint, feedbackFile)
const mockGiveFeedback = vi.fn();
vi.mock('agent0-sdk', () => ({
  SDK: class {
    giveFeedback = mockGiveFeedback;
  },
}));

vi.mock('@/lib/config/env', () => ({
  env: {
    ANTHROPIC_API_KEY: 'test-key',
    AGENT_A_PRIVATE_KEY: '0x' + '01'.repeat(32),
    AGENT_B_PRIVATE_KEY: '0x' + '02'.repeat(32),
    AGENT_C_PRIVATE_KEY: '0x' + '03'.repeat(32),
    AGENT_D_PRIVATE_KEY: '0x' + '04'.repeat(32),
    SYSTEM_PRIVATE_KEY: '0x' + '05'.repeat(32),
    BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
    PINATA_JWT: 'test',
    UPSTASH_REDIS_REST_URL: 'https://kv.test',
    UPSTASH_REDIS_REST_TOKEN: 'test',
    CIVIC_MCP_ENDPOINT: 'https://civic.test',
    X402_FACILITATOR_URL: 'https://x402.test',
  },
}));

const mockEmit = vi.fn().mockResolvedValue({ id: 'evt-1', timestamp: Date.now() });
vi.mock('@/lib/events/bus', () => ({
  createEventBus: () => ({ emit: mockEmit, since: vi.fn() }),
}));

vi.mock('@vercel/kv', () => ({
  kv: {
    set: vi.fn(),
    get: vi.fn(),
    zadd: vi.fn(),
    zrange: vi.fn().mockResolvedValue([]),
  },
}));

describe('On-Chain Feedback Submission (Story 3.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGiveFeedback.mockResolvedValue({
      hash: '0xfeedback_tx_hash_123',
      waitMined: vi.fn().mockResolvedValue({
        receipt: {
          transactionHash: '0xfeedback_tx_hash_123',
          blockNumber: 12345n,
          status: 'success',
          logs: [],
        },
        result: {
          agentId: 'agent-b-id',
          reviewer: '0x1234',
          value: 5,
          tags: ['covenant', 'positive'],
          createdAt: Date.now(),
        },
      }),
    });
  });

  describe('giveFeedback', () => {
    it('constructs correct transaction with all fields', async () => {
      const { giveFeedback } = await import('@/lib/protocols/erc8004/reputation');

      const result = await giveFeedback({
        targetAgentId: 'agent-b-id',
        isPositive: true,
        feedbackURI: '',
        proofOfPayment: '0xpayment_tx_hash',
        feedbackerAgentId: 'agent-a-id',
      });

      expect(result.txHash).toBe('0xfeedback_tx_hash_123');
      expect(result.feedbackerAgentId).toBe('agent-a-id');
      expect(result.targetAgentId).toBe('agent-b-id');
      expect(result.isPositive).toBe(true);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('submits positive feedback with correct value encoding (5 = positive)', async () => {
      const { giveFeedback } = await import('@/lib/protocols/erc8004/reputation');

      await giveFeedback({
        targetAgentId: 'agent-b-id',
        isPositive: true,
        feedbackURI: 'ipfs://Qm123',
        proofOfPayment: '0xpayment_tx',
        feedbackerAgentId: 'agent-a-id',
      });

      // sdk.giveFeedback(agentId, value, tag1, tag2, endpoint, feedbackFile)
      expect(mockGiveFeedback).toHaveBeenCalledWith(
        'agent-b-id', // agentId
        5, // value: positive
        'covenant', // tag1
        'positive', // tag2
        undefined, // endpoint
        expect.objectContaining({
          proofOfPayment: { txHash: '0xpayment_tx' },
        })
      );
    });

    it('submits negative feedback with correct value encoding (1 = negative)', async () => {
      const { giveFeedback } = await import('@/lib/protocols/erc8004/reputation');

      await giveFeedback({
        targetAgentId: 'agent-d-id',
        isPositive: false,
        feedbackURI: '',
        proofOfPayment: '0xpayment_for_bad_work',
        feedbackerAgentId: 'agent-a-id',
      });

      expect(mockGiveFeedback).toHaveBeenCalledWith(
        'agent-d-id', // agentId
        1, // value: negative
        'covenant', // tag1
        'negative', // tag2
        undefined, // endpoint
        expect.objectContaining({
          proofOfPayment: { txHash: '0xpayment_for_bad_work' },
        })
      );
    });

    it('emits feedback:submitted event on success', async () => {
      const { giveFeedback } = await import('@/lib/protocols/erc8004/reputation');

      await giveFeedback({
        targetAgentId: 'agent-b-id',
        isPositive: true,
        feedbackURI: '',
        proofOfPayment: '0xpayment_hash',
        feedbackerAgentId: 'agent-a-id',
      });

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'feedback:submitted',
          protocol: 'erc8004',
          agentId: 'agent-a-id',
          targetAgentId: 'agent-b-id',
          data: expect.objectContaining({
            isPositive: true,
            txHash: '0xfeedback_tx_hash_123',
            proofOfPayment: '0xpayment_hash',
          }),
        })
      );
    });

    it('emits feedback:failed event on transaction failure', async () => {
      mockGiveFeedback.mockRejectedValueOnce(new Error('Gas estimation failed'));

      const { giveFeedback } = await import('@/lib/protocols/erc8004/reputation');

      await expect(
        giveFeedback({
          targetAgentId: 'agent-b-id',
          isPositive: true,
          feedbackURI: '',
          proofOfPayment: '0xpayment',
          feedbackerAgentId: 'agent-a-id',
        })
      ).rejects.toThrow();

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'feedback:failed',
          protocol: 'erc8004',
          data: expect.objectContaining({
            error: 'Gas estimation failed',
          }),
        })
      );
    });
  });
});
