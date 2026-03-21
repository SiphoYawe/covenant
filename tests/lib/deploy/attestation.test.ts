import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- In-memory KV mock ---
const kvStore = new Map<string, { value: unknown; expiresAt?: number }>();

vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(async (key: string) => {
      const entry = kvStore.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        kvStore.delete(key);
        return null;
      }
      return entry.value;
    }),
    set: vi.fn(async (key: string, value: unknown, options?: { ex?: number }) => {
      const entry: { value: unknown; expiresAt?: number } = { value };
      if (options?.ex) {
        entry.expiresAt = Date.now() + options.ex * 1000;
      }
      kvStore.set(key, entry);
    }),
    del: vi.fn(async (key: string) => {
      kvStore.delete(key);
    }),
    zadd: vi.fn(async () => {}),
    zrange: vi.fn(async () => []),
  },
}));

// --- Mock ERC-8004 SDK ---
const mockWaitMined = vi.fn().mockResolvedValue({ receipt: { transactionHash: '0xattest123' } });
const mockGiveFeedback = vi.fn().mockResolvedValue({ waitMined: mockWaitMined, hash: '0xattest123' });

vi.mock('agent0-sdk', () => ({
  SDK: class MockSDK {
    giveFeedback = mockGiveFeedback;
    identityRegistryAddress = vi.fn().mockReturnValue('0x8004A818BFB912233c491871b3d84c89A494BD9e');
    reputationRegistryAddress = vi.fn().mockReturnValue('0x8004B663056A597Dffe9eCcC1965A193B7388713');
  },
}));

// --- Env mock ---
vi.mock('@/lib/config/env', () => ({
  env: {
    SYSTEM_PRIVATE_KEY: '0x' + '05'.repeat(32),
    BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
    PINATA_JWT: 'test-jwt',
  },
}));

vi.mock('@/lib/wallets', () => ({
  getWallet: vi.fn().mockReturnValue({
    client: { account: { address: '0x' + 'aa'.repeat(20) } },
    writeContract: vi.fn().mockResolvedValue('0xtxhash'),
  }),
  getAddress: vi.fn().mockReturnValue('0x' + 'aa'.repeat(20)),
}));

describe('Reputation Attestation', () => {
  beforeEach(() => {
    kvStore.clear();
    vi.clearAllMocks();
    mockGiveFeedback.mockResolvedValue({ waitMined: mockWaitMined, hash: '0xattest123' });
    mockWaitMined.mockResolvedValue({ receipt: { transactionHash: '0xattest123' } });
  });

  const testAgentId = '42';
  const testDeployerAddress = '0x' + 'bb'.repeat(20);

  describe('writeDeployerAttestation', () => {
    it('calls appendResponse (giveFeedback) on ERC-8004 with attestation payload', async () => {
      const { writeDeployerAttestation } = await import('@/lib/deploy/attestation');

      const result = await writeDeployerAttestation(testAgentId, testDeployerAddress);

      expect(mockGiveFeedback).toHaveBeenCalledWith(
        testAgentId,
        expect.any(Number),
        'covenant-deployer',
        'deployer-attestation',
        undefined,
        expect.objectContaining({
          text: expect.stringContaining(testDeployerAddress),
        }),
      );
      expect(result.txHash).toBe('0xattest123');
    });

    it('stores attestation record in KV', async () => {
      const { writeDeployerAttestation } = await import('@/lib/deploy/attestation');
      await writeDeployerAttestation(testAgentId, testDeployerAddress);

      const stored = kvStore.get(`agent:${testAgentId}:deployer-attestation`);
      expect(stored).toBeDefined();
      const attestation = stored!.value as Record<string, unknown>;
      expect(attestation.type).toBe('deployer-attestation');
      expect(attestation.deployerAddress).toBe(testDeployerAddress);
      expect(attestation.reputationLinked).toBe(true);
      expect(attestation.txHash).toBe('0xattest123');
    });

    it('returns the transaction hash', async () => {
      const { writeDeployerAttestation } = await import('@/lib/deploy/attestation');
      const result = await writeDeployerAttestation(testAgentId, testDeployerAddress);
      expect(result.txHash).toBe('0xattest123');
    });

    it('emits DEPLOYER_REPUTATION_LINKED event', async () => {
      const { writeDeployerAttestation } = await import('@/lib/deploy/attestation');
      await writeDeployerAttestation(testAgentId, testDeployerAddress);

      const { kv } = await import('@vercel/kv');
      const zaddCalls = (kv.zadd as ReturnType<typeof vi.fn>).mock.calls;
      expect(zaddCalls.length).toBeGreaterThan(0);
      const lastCall = zaddCalls[zaddCalls.length - 1];
      const event = JSON.parse(lastCall[1].member);
      expect(event.type).toBe('deployer:reputation-linked');
    });
  });
});
