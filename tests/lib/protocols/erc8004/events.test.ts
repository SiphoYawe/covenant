import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// Mock KV for last processed block tracking
const mockKvGet = vi.fn();
const mockKvSet = vi.fn();
vi.mock('@vercel/kv', () => ({
  kv: {
    get: mockKvGet,
    set: mockKvSet,
    zadd: vi.fn(),
    zrange: vi.fn().mockResolvedValue([]),
  },
}));

// Mock viem for on-chain event watching
const mockGetLogs = vi.fn();
const mockGetBlockNumber = vi.fn();
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: () => ({
      getLogs: mockGetLogs,
      getBlockNumber: mockGetBlockNumber,
    }),
    http: vi.fn(),
  };
});

describe('On-Chain Event Listener (Story 3.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBlockNumber.mockResolvedValue(100000n);
    mockKvGet.mockResolvedValue(null);
  });

  describe('pollFeedbackEvents', () => {
    it('detects FeedbackGiven events and emits feedback:detected', async () => {
      mockGetLogs.mockResolvedValueOnce([
        {
          args: {
            targetAgentId: 'agent-b-id',
            feedbackerAddress: '0x1234',
            isPositive: true,
            feedbackURI: 'ipfs://Qm123',
          },
          blockNumber: 99999n,
          transactionHash: '0xevent_tx_1',
        },
      ]);

      const { pollFeedbackEvents } = await import('@/lib/protocols/erc8004/events');
      await pollFeedbackEvents();

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'feedback:detected',
          protocol: 'erc8004',
          data: expect.objectContaining({
            targetAgentId: 'agent-b-id',
            isPositive: true,
            txHash: '0xevent_tx_1',
          }),
        })
      );
    });

    it('tracks last processed block for crash recovery', async () => {
      mockGetLogs.mockResolvedValueOnce([
        {
          args: {
            targetAgentId: 'agent-c-id',
            feedbackerAddress: '0x5678',
            isPositive: false,
            feedbackURI: '',
          },
          blockNumber: 100050n,
          transactionHash: '0xevent_tx_2',
        },
      ]);

      const { pollFeedbackEvents } = await import('@/lib/protocols/erc8004/events');
      await pollFeedbackEvents();

      expect(mockKvSet).toHaveBeenCalledWith('erc8004:feedback:lastBlock', 100050);
    });

    it('resumes from last processed block on restart', async () => {
      mockKvGet.mockResolvedValueOnce(99000);
      mockGetLogs.mockResolvedValueOnce([]);

      const { pollFeedbackEvents } = await import('@/lib/protocols/erc8004/events');
      await pollFeedbackEvents();

      // Should query from block 99001 (one after last processed)
      expect(mockGetLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          fromBlock: 99001n,
        })
      );
    });

    it('returns empty when no new events', async () => {
      mockGetLogs.mockResolvedValueOnce([]);

      const { pollFeedbackEvents } = await import('@/lib/protocols/erc8004/events');
      const events = await pollFeedbackEvents();

      expect(events).toHaveLength(0);
      expect(mockEmit).not.toHaveBeenCalled();
    });
  });
});
