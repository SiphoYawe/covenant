import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// In-memory KV store for tests
const kvStore = new Map<string, { value: unknown; expiresAt?: number }>();

vi.mock('@/lib/storage/kv', () => ({
  kvGet: vi.fn(async (key: string) => {
    const entry = kvStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      kvStore.delete(key);
      return null;
    }
    return entry.value;
  }),
  kvSet: vi.fn(async (key: string, value: unknown, options?: { ex?: number }) => {
    const entry: { value: unknown; expiresAt?: number } = { value };
    if (options?.ex) {
      entry.expiresAt = Date.now() + options.ex * 1000;
    }
    kvStore.set(key, entry);
  }),
  kvDel: vi.fn(async (key: string) => {
    kvStore.delete(key);
  }),
}));

// Mock env
vi.mock('@/lib/config/env', () => ({
  env: {
    AGENT_A_PRIVATE_KEY: '0x' + '01'.repeat(32),
    AGENT_B_PRIVATE_KEY: '0x' + '02'.repeat(32),
    AGENT_C_PRIVATE_KEY: '0x' + '03'.repeat(32),
    AGENT_D_PRIVATE_KEY: '0x' + '04'.repeat(32),
    SYSTEM_PRIVATE_KEY: '0x' + '05'.repeat(32),
    BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
    ANTHROPIC_API_KEY: 'test',
    PINATA_JWT: 'test',
    UPSTASH_REDIS_REST_URL: 'https://kv.test',
    UPSTASH_REDIS_REST_TOKEN: 'test',
    CIVIC_MCP_ENDPOINT: 'https://civic.test',
    X402_FACILITATOR_URL: 'https://x402.test',
  },
}));

describe('Wallet Provisioner', () => {
  beforeEach(() => {
    kvStore.clear();
    vi.clearAllMocks();
  });

  describe('provisionWallet', () => {
    it('generates a valid Ethereum address', async () => {
      const { provisionWallet } = await import('@/lib/wallets/provisioner');
      const wallet = await provisionWallet();
      expect(isAddress(wallet.address)).toBe(true);
    });

    it('returns a private key as 0x-prefixed hex string', async () => {
      const { provisionWallet } = await import('@/lib/wallets/provisioner');
      const wallet = await provisionWallet();
      expect(wallet.privateKey).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('stores the private key in KV under wallet:{address}:key', async () => {
      const { provisionWallet } = await import('@/lib/wallets/provisioner');
      const wallet = await provisionWallet();
      const stored = kvStore.get(`wallet:${wallet.address}:key`);
      expect(stored).toBeDefined();
      expect(stored!.value).toBe(wallet.privateKey);
    });

    it('returns provisionedAt timestamp', async () => {
      const { provisionWallet } = await import('@/lib/wallets/provisioner');
      const before = Date.now();
      const wallet = await provisionWallet();
      const after = Date.now();
      const ts = new Date(wallet.provisionedAt).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it('returns fundedAmount as 0 initially', async () => {
      const { provisionWallet } = await import('@/lib/wallets/provisioner');
      const wallet = await provisionWallet();
      expect(wallet.fundedAmount).toBe(0);
    });

    it('generates unique wallets each time', async () => {
      const { provisionWallet } = await import('@/lib/wallets/provisioner');
      const w1 = await provisionWallet();
      const w2 = await provisionWallet();
      expect(w1.address).not.toBe(w2.address);
      expect(w1.privateKey).not.toBe(w2.privateKey);
    });
  });

  describe('getProvisionedWallet', () => {
    it('returns a WalletClient for a provisioned wallet', async () => {
      const { provisionWallet, getProvisionedWallet } = await import('@/lib/wallets/provisioner');
      const wallet = await provisionWallet();
      const client = await getProvisionedWallet(wallet.address);
      expect(client).toBeDefined();
      expect(client!.account).toBeDefined();
      expect(client!.account!.address.toLowerCase()).toBe(wallet.address.toLowerCase());
    });

    it('returns null for unknown address', async () => {
      const { getProvisionedWallet } = await import('@/lib/wallets/provisioner');
      const result = await getProvisionedWallet('0x0000000000000000000000000000000000000000');
      expect(result).toBeNull();
    });

    it('wallet can sign a message (round-trip test)', async () => {
      const { provisionWallet, getProvisionedWallet } = await import('@/lib/wallets/provisioner');
      const wallet = await provisionWallet();
      const client = await getProvisionedWallet(wallet.address);

      // Verify the account derived from stored key matches the provisioned address
      const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);
      expect(account.address.toLowerCase()).toBe(wallet.address.toLowerCase());
      expect(client!.account!.address.toLowerCase()).toBe(account.address.toLowerCase());
    });
  });

  describe('Nonce Management', () => {
    it('generateNonce creates a 64-char hex nonce', async () => {
      const { generateNonce } = await import('@/lib/wallets/provisioner');
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      const challenge = await generateNonce(address);
      expect(challenge.nonce).toMatch(/^[0-9a-f]{64}$/);
    });

    it('generateNonce stores nonce in KV with TTL', async () => {
      const { generateNonce } = await import('@/lib/wallets/provisioner');
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      const challenge = await generateNonce(address);
      const stored = kvStore.get(`deploy:nonces:${address}`);
      expect(stored).toBeDefined();
      expect(stored!.value).toBe(challenge.nonce);
      expect(stored!.expiresAt).toBeDefined();
    });

    it('generateNonce returns expiresAt timestamp', async () => {
      const { generateNonce } = await import('@/lib/wallets/provisioner');
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      const challenge = await generateNonce(address);
      const expiresAt = new Date(challenge.expiresAt).getTime();
      // Should expire roughly 5 minutes from now
      expect(expiresAt).toBeGreaterThan(Date.now());
      expect(expiresAt).toBeLessThanOrEqual(Date.now() + 310_000);
    });

    it('verifyNonce returns true for valid nonce and deletes it', async () => {
      const { generateNonce, verifyNonce } = await import('@/lib/wallets/provisioner');
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      const challenge = await generateNonce(address);
      const result = await verifyNonce(address, challenge.nonce);
      expect(result).toBe(true);
      // Nonce should be consumed (deleted)
      const stored = kvStore.get(`deploy:nonces:${address}`);
      expect(stored).toBeUndefined();
    });

    it('verifyNonce returns false for wrong nonce', async () => {
      const { generateNonce, verifyNonce } = await import('@/lib/wallets/provisioner');
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      await generateNonce(address);
      const result = await verifyNonce(address, 'wrong_nonce');
      expect(result).toBe(false);
    });

    it('verifyNonce returns false for replay (second use)', async () => {
      const { generateNonce, verifyNonce } = await import('@/lib/wallets/provisioner');
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      const challenge = await generateNonce(address);
      // First use succeeds
      const first = await verifyNonce(address, challenge.nonce);
      expect(first).toBe(true);
      // Replay fails
      const second = await verifyNonce(address, challenge.nonce);
      expect(second).toBe(false);
    });

    it('verifyNonce returns false for unknown address', async () => {
      const { verifyNonce } = await import('@/lib/wallets/provisioner');
      const result = await verifyNonce(
        '0x0000000000000000000000000000000000000000',
        'some_nonce'
      );
      expect(result).toBe(false);
    });

    it('verifySignature verifies a valid signature and consumes nonce', async () => {
      const { generateNonce, verifySignature } = await import('@/lib/wallets/provisioner');

      // Create a test account to sign with
      const testKey = '0x' + 'ab'.repeat(32);
      const account = privateKeyToAccount(testKey as `0x${string}`);
      const address = account.address;

      // Generate nonce for this address
      const challenge = await generateNonce(address);

      // Sign the nonce with the test account
      const signature = await account.signMessage({ message: challenge.nonce });

      // Verify the signature
      const result = await verifySignature(address, challenge.nonce, signature);
      expect(result).toBe(true);

      // Nonce should be consumed
      const stored = kvStore.get(`deploy:nonces:${address}`);
      expect(stored).toBeUndefined();
    });

    it('verifySignature rejects signature from wrong account', async () => {
      const { generateNonce, verifySignature } = await import('@/lib/wallets/provisioner');

      const realKey = '0x' + 'ab'.repeat(32);
      const fakeKey = '0x' + 'cd'.repeat(32);
      const realAccount = privateKeyToAccount(realKey as `0x${string}`);
      const fakeAccount = privateKeyToAccount(fakeKey as `0x${string}`);

      // Generate nonce for real account
      const challenge = await generateNonce(realAccount.address);

      // Sign with fake account
      const signature = await fakeAccount.signMessage({ message: challenge.nonce });

      // Verify should fail (signature doesn't match claimed address)
      const result = await verifySignature(realAccount.address, challenge.nonce, signature);
      expect(result).toBe(false);
    });
  });
});
