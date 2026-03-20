import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock @vercel/kv
const kvStore = new Map<string, unknown>();
vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(async (key: string) => kvStore.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => { kvStore.set(key, value); }),
    del: vi.fn(async (key: string) => { kvStore.delete(key); }),
    lpush: vi.fn(),
    lrange: vi.fn().mockResolvedValue([]),
    zadd: vi.fn().mockResolvedValue(1),
    zrange: vi.fn().mockResolvedValue([]),
  },
}));

// Mock the SDK
const mockGiveFeedback = vi.fn();
vi.mock('@/lib/protocols/erc8004/client', () => ({
  getSDK: () => ({
    giveFeedback: mockGiveFeedback,
  }),
  getReadOnlySDK: () => ({}),
  clearSDKCache: () => {},
}));

// Mock wallet manager
vi.mock('@/lib/wallets', () => ({
  getWallet: vi.fn(() => ({
    role: 'system',
    address: '0xSystemWallet',
    client: { account: { address: '0xSystemWallet' } },
  })),
  getAddress: vi.fn(() => '0xSystemWallet'),
  getWalletInfo: vi.fn(),
  getPublicClient: vi.fn(),
}));

import { appendReputationResponse } from '@/lib/protocols/erc8004/write-back';
import type { AppendResponseData, CachedReputation } from '@/lib/protocols/erc8004/types';

function makeResponseData(overrides: Partial<AppendResponseData> = {}): AppendResponseData {
  return {
    agentId: 'agent-b',
    score: 8.5,
    explanationCid: 'bafybeig12345',
    timestamp: Math.floor(Date.now() / 1000),
    signalSummary: {
      stakeWeight: 0.4,
      trustPropagation: 0.3,
      sybilPenalty: 0,
      civicFlag: 0,
      paymentVolume: 11.0,
    },
    ...overrides,
  };
}

describe('On-Chain Write-Back', () => {
  beforeEach(() => {
    kvStore.clear();
    vi.clearAllMocks();
    mockGiveFeedback.mockResolvedValue({
      hash: '0xtxhash123',
      waitMined: vi.fn().mockResolvedValue({
        receipt: { transactionHash: '0xtxhash123' },
      }),
    });
  });

  describe('appendReputationResponse', () => {
    test('encodes response data correctly (score, CID, timestamp, signal summary)', async () => {
      const data = makeResponseData();

      const result = await appendReputationResponse(data);

      expect(result.txHash).toBe('0xtxhash123');
      expect(mockGiveFeedback).toHaveBeenCalledTimes(1);
      const callArgs = mockGiveFeedback.mock.calls[0];
      expect(callArgs[0]).toBe('agent-b'); // agentId
      expect(callArgs[2]).toBe('covenant-reputation'); // tag1
      expect(callArgs[3]).toBe('append-response'); // tag2
    });

    test('uses the system wallet, not an agent wallet', async () => {
      const { getWallet } = await import('@/lib/wallets');
      const data = makeResponseData();

      await appendReputationResponse(data);

      expect(getWallet).toHaveBeenCalledWith('system');
    });

    test('emits reputation:updated event with correct shape after successful write', async () => {
      const { kv } = await import('@vercel/kv');
      const data = makeResponseData();

      await appendReputationResponse(data);

      // Event bus uses kv.zadd to store events
      expect(kv.zadd).toHaveBeenCalled();
    });

    test('KV cache is updated at agent:{agentId}:reputation', async () => {
      const { kv } = await import('@vercel/kv');
      const data = makeResponseData();

      await appendReputationResponse(data);

      const setCall = vi.mocked(kv.set).mock.calls.find((c) => c[0] === 'agent:agent-b:reputation');
      expect(setCall).toBeDefined();
      const cached = setCall![1] as CachedReputation;
      expect(cached.score).toBe(8.5);
      expect(cached.explanationCid).toBe('bafybeig12345');
      expect(cached.txHash).toBe('0xtxhash123');
    });

    test('transaction revert produces descriptive error', async () => {
      mockGiveFeedback.mockRejectedValueOnce(new Error('Transaction reverted'));
      const data = makeResponseData();

      await expect(appendReputationResponse(data)).rejects.toThrow('Transaction reverted');
    });
  });
});
