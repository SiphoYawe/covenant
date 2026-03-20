import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory stores for mocking
const kvStore = new Map<string, unknown>();

vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(async (key: string) => kvStore.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      kvStore.set(key, value);
    }),
    del: vi.fn(async (key: string) => {
      kvStore.delete(key);
    }),
  },
}));

// Mock Pinata SDK with a proper class
const mockUploadJson = vi.fn();
const mockGatewayGet = vi.fn();

vi.mock('pinata', () => {
  return {
    PinataSDK: class MockPinataSDK {
      upload = {
        public: {
          json: mockUploadJson,
        },
      };
      gateways = {
        public: {
          get: mockGatewayGet,
        },
      };
    },
  };
});

vi.mock('@/lib/config/env', () => ({
  env: { PINATA_JWT: 'test-jwt' },
}));

describe('IPFS Storage', () => {
  beforeEach(() => {
    kvStore.clear();
    mockUploadJson.mockReset();
    mockGatewayGet.mockReset();
    vi.resetModules();
  });

  it('pin() returns a valid CID string on success', async () => {
    mockUploadJson.mockResolvedValueOnce({ cid: 'QmTestCid123' });

    const { pin } = await import('@/lib/storage/ipfs');
    const cid = await pin({ name: 'test' });
    expect(cid).toBe('QmTestCid123');
    expect(mockUploadJson).toHaveBeenCalledWith({ name: 'test' });
  });

  it('get() retrieves pinned content by CID', async () => {
    mockGatewayGet.mockResolvedValueOnce({ data: { name: 'retrieved' } });

    const { get } = await import('@/lib/storage/ipfs');
    const data = await get('QmTestCid456');
    expect(data).toEqual({ name: 'retrieved' });
  });

  it('pin() falls back to KV and throws when Pinata unavailable', async () => {
    mockUploadJson.mockRejectedValueOnce(new Error('Pinata unavailable'));

    const { pin } = await import('@/lib/storage/ipfs');
    await expect(pin({ name: 'fallback' })).rejects.toThrow('IPFS pin failed');
  });

  it('get() returns cached data from KV on second call', async () => {
    // Pre-populate KV cache
    kvStore.set('ipfs:cache:QmCached', { cached: true });

    const { get } = await import('@/lib/storage/ipfs');
    const data = await get('QmCached');
    expect(data).toEqual({ cached: true });
    // Should not call Pinata gateway
    expect(mockGatewayGet).not.toHaveBeenCalled();
  });
});
