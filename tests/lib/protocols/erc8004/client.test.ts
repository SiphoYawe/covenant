import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/config/env', () => ({
  env: {
    BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
    PINATA_JWT: 'test-jwt',
  },
}));

// Mock the SDK constructor
const mockSDK = {
  chainId: vi.fn().mockResolvedValue(84532),
  identityRegistryAddress: vi.fn().mockReturnValue('0x8004A818BFB912233c491871b3d84c89A494BD9e'),
  reputationRegistryAddress: vi.fn().mockReturnValue('0x8004B663056A597Dffe9eCcC1965A193B7388713'),
  isReadOnly: false,
  createAgent: vi.fn(),
  getAgent: vi.fn(),
  loadAgent: vi.fn(),
};

vi.mock('agent0-sdk', () => ({
  SDK: class MockSDK {
    constructor() {
      return mockSDK;
    }
  },
}));

describe('ERC-8004 Client', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('getSDK returns an SDK instance configured for Base Sepolia', async () => {
    const { getSDK, clearSDKCache } = await import('@/lib/protocols/erc8004/client');
    clearSDKCache();
    const sdk = getSDK('0x' + '01'.repeat(32));
    expect(sdk).toBeDefined();
    expect(sdk.identityRegistryAddress()).toBe('0x8004A818BFB912233c491871b3d84c89A494BD9e');
  });

  it('getSDK caches instances by private key', async () => {
    const { getSDK, clearSDKCache } = await import('@/lib/protocols/erc8004/client');
    clearSDKCache();
    const key = '0x' + '01'.repeat(32);
    const sdk1 = getSDK(key);
    const sdk2 = getSDK(key);
    expect(sdk1).toBe(sdk2);
  });

  it('getReadOnlySDK returns a read-only SDK', async () => {
    const { getReadOnlySDK, clearSDKCache } = await import('@/lib/protocols/erc8004/client');
    clearSDKCache();
    const sdk = getReadOnlySDK();
    expect(sdk).toBeDefined();
  });
});
