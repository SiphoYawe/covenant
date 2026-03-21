import { describe, it, expect, vi, beforeEach } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';

// Generate deterministic test private keys
const TEST_KEYS = {
  AGENT_A_PRIVATE_KEY: '0x' + '01'.repeat(32),
  AGENT_B_PRIVATE_KEY: '0x' + '02'.repeat(32),
  AGENT_C_PRIVATE_KEY: '0x' + '03'.repeat(32),
  AGENT_D_PRIVATE_KEY: '0x' + '04'.repeat(32),
  SYSTEM_PRIVATE_KEY: '0x' + '05'.repeat(32),
  BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
} as const;

// Derive expected addresses from test keys
const expectedAddresses = {
  researcher: privateKeyToAccount(TEST_KEYS.AGENT_A_PRIVATE_KEY).address,
  reviewer: privateKeyToAccount(TEST_KEYS.AGENT_B_PRIVATE_KEY).address,
  summarizer: privateKeyToAccount(TEST_KEYS.AGENT_C_PRIVATE_KEY).address,
  malicious: privateKeyToAccount(TEST_KEYS.AGENT_D_PRIVATE_KEY).address,
  system: privateKeyToAccount(TEST_KEYS.SYSTEM_PRIVATE_KEY).address,
};

// Mock env module to return test keys
vi.mock('@/lib/config/env', () => ({
  env: {
    ...TEST_KEYS,
    ANTHROPIC_API_KEY: 'test',
    PINATA_JWT: 'test',
    UPSTASH_REDIS_REST_URL: 'https://kv.test',
    UPSTASH_REDIS_REST_TOKEN: 'test',
    CIVIC_MCP_ENDPOINT: 'https://civic.test',
    X402_FACILITATOR_URL: 'https://x402.test',
  },
}));

describe('Wallet Manager', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('getWallet returns a valid WalletClient for researcher', async () => {
    const { getWallet } = await import('@/lib/wallets/manager');
    const client = getWallet('researcher');
    expect(client).toBeDefined();
    expect(client.account).toBeDefined();
    expect(client.chain).toBeDefined();
    expect(client.chain!.id).toBe(84532);
  });

  it('getWallet returns a valid WalletClient for system', async () => {
    const { getWallet } = await import('@/lib/wallets/manager');
    const client = getWallet('system');
    expect(client).toBeDefined();
    expect(client.account).toBeDefined();
  });

  it('getAddress returns a valid hex address for each role', async () => {
    const { getAddress } = await import('@/lib/wallets/manager');
    for (const role of ['researcher', 'reviewer', 'summarizer', 'malicious', 'system'] as const) {
      const addr = getAddress(role);
      expect(addr).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });

  it('getAddress returns the correct derived address for researcher', async () => {
    const { getAddress } = await import('@/lib/wallets/manager');
    expect(getAddress('researcher')).toBe(expectedAddresses.researcher);
  });

  it('all 5 roles return different addresses', async () => {
    const { getAddress } = await import('@/lib/wallets/manager');
    const addresses = new Set([
      getAddress('researcher'),
      getAddress('reviewer'),
      getAddress('summarizer'),
      getAddress('malicious'),
      getAddress('system'),
    ]);
    expect(addresses.size).toBe(5);
  });

  it('getWallet throws for invalid role', async () => {
    const { getWallet } = await import('@/lib/wallets/manager');
    expect(() => getWallet('invalid' as never)).toThrow();
  });

  it('getPublicClient returns a valid public client for reads', async () => {
    const { getPublicClient } = await import('@/lib/wallets/manager');
    const client = getPublicClient();
    expect(client).toBeDefined();
    expect(client.chain).toBeDefined();
    expect(client.chain!.id).toBe(84532);
  });

  it('getWalletInfo returns role, address, and client', async () => {
    const { getWalletInfo } = await import('@/lib/wallets/manager');
    const info = getWalletInfo('reviewer');
    expect(info.role).toBe('reviewer');
    expect(info.address).toBe(expectedAddresses.reviewer);
    expect(info.client).toBeDefined();
    expect(info.client.account).toBeDefined();
  });
});
