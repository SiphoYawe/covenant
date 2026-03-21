import { describe, it, expect, vi, beforeEach } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';

// --- In-memory KV mock ---
const kvStore = new Map<string, { value: unknown; expiresAt?: number }>();
const kvLists = new Map<string, string[]>();

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
    lpush: vi.fn(async (key: string, value: string) => {
      const list = kvLists.get(key) ?? [];
      list.unshift(value);
      kvLists.set(key, list);
    }),
    lrange: vi.fn(async (key: string, start: number, end: number) => {
      const list = kvLists.get(key) ?? [];
      return list.slice(start, end === -1 ? undefined : end + 1);
    }),
    zadd: vi.fn(async () => {}),
    zrange: vi.fn(async () => []),
  },
}));

// --- Env mock ---
const TEST_ENV = {
  AGENT_A_PRIVATE_KEY: '0x' + '01'.repeat(32),
  AGENT_B_PRIVATE_KEY: '0x' + '02'.repeat(32),
  AGENT_C_PRIVATE_KEY: '0x' + '03'.repeat(32),
  AGENT_D_PRIVATE_KEY: '0x' + '04'.repeat(32),
  SYSTEM_PRIVATE_KEY: '0x' + '05'.repeat(32),
  BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
  PINATA_JWT: 'test-jwt',
  ANTHROPIC_API_KEY: 'test',
  UPSTASH_REDIS_REST_URL: 'https://kv.test',
  UPSTASH_REDIS_REST_TOKEN: 'test',
  CIVIC_MCP_ENDPOINT: 'https://civic.test',
  X402_FACILITATOR_URL: 'https://x402.test',
  SENTRY_DSN: 'https://sentry.test',
};

vi.mock('@/lib/config/env', () => ({
  env: TEST_ENV,
}));

// --- Mock agent0-sdk ---
const mockWaitMined = vi.fn().mockResolvedValue({ receipt: { transactionHash: '0xabc123' }, result: {} });
const mockRegisterOnChain = vi.fn().mockResolvedValue({ waitMined: mockWaitMined, hash: '0xabc123' });
const mockAgent = {
  get agentId() { return '42'; },
  get agentURI() { return 'data:application/json;base64,test'; },
  registerOnChain: mockRegisterOnChain,
};
const mockCreateAgent = vi.fn().mockReturnValue(mockAgent);

vi.mock('agent0-sdk', () => ({
  SDK: class MockSDK {
    createAgent = mockCreateAgent;
    getAgent = vi.fn();
    identityRegistryAddress = vi.fn().mockReturnValue('0x8004A818BFB912233c491871b3d84c89A494BD9e');
    reputationRegistryAddress = vi.fn().mockReturnValue('0x8004B663056A597Dffe9eCcC1965A193B7388713');
  },
}));

// --- Mock wallet manager ---
const mockSystemWriteContract = vi.fn().mockResolvedValue('0xtxhash');

vi.mock('@/lib/wallets', () => ({
  getWallet: vi.fn().mockReturnValue({
    writeContract: mockSystemWriteContract,
  }),
  getAddress: vi.fn().mockReturnValue('0x' + 'aa'.repeat(20)),
}));

vi.mock('@/lib/wallets/manager', () => ({
  getPublicClient: vi.fn().mockReturnValue({
    readContract: vi.fn().mockResolvedValue(BigInt(10_000_000)), // 10 USDC by default
  }),
}));

// --- Helper to create a Request ---
function createRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/agents/deploy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createVerifyRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/agents/deploy/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/agents/deploy', () => {
  beforeEach(() => {
    kvStore.clear();
    kvLists.clear();
    vi.clearAllMocks();
    mockCreateAgent.mockReturnValue(mockAgent);
    mockRegisterOnChain.mockResolvedValue({ waitMined: mockWaitMined, hash: '0xabc123' });
    mockWaitMined.mockResolvedValue({ receipt: { transactionHash: '0xabc123' }, result: {} });
  });

  describe('Provisioned mode', () => {
    const validProvisionedBody = {
      mode: 'provisioned',
      name: 'Test Agent',
      description: 'A test agent for validation purposes',
      capabilities: ['research'],
    };

    it('returns 201 with agentId, address, and agentCard on success', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest(validProvisionedBody));
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.agentId).toBe('42');
      expect(body.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(body.agentCard).toBeDefined();
      expect(body.agentCard.name).toBe('Test Agent');
    });

    it('provisions a wallet and registers on ERC-8004', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      await POST(createRequest(validProvisionedBody));

      expect(mockCreateAgent).toHaveBeenCalledWith('Test Agent', 'A test agent for validation purposes');
      expect(mockRegisterOnChain).toHaveBeenCalled();
    });

    it('funds the wallet from pool', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      await POST(createRequest(validProvisionedBody));

      // fundFromPool calls system wallet writeContract
      expect(mockSystemWriteContract).toHaveBeenCalled();
    });

    it('emits AGENT_DEPLOYED event', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      await POST(createRequest(validProvisionedBody));

      const { kv } = await import('@vercel/kv');
      // Event bus uses kv.zadd
      expect(kv.zadd).toHaveBeenCalled();

      // Check the emitted event data
      const zaddCall = (kv.zadd as ReturnType<typeof vi.fn>).mock.calls;
      const lastCall = zaddCall[zaddCall.length - 1];
      const eventStr = lastCall[1].member;
      const event = JSON.parse(eventStr);
      expect(event.type).toBe('agent:deployed');
      expect(event.data.mode).toBe('provisioned');
      expect(event.data.fundedAmount).toBe(5_000_000);
    });

    it('stores agent card in KV', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      await POST(createRequest(validProvisionedBody));

      const stored = kvStore.get('agent:42:card');
      expect(stored).toBeDefined();
      expect((stored!.value as Record<string, unknown>).name).toBe('Test Agent');
    });

    it('returns 503 when pool balance is insufficient', async () => {
      // Override pool balance to be low
      const { getPublicClient } = await import('@/lib/wallets/manager');
      (getPublicClient as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        readContract: vi.fn().mockResolvedValue(BigInt(1_000_000)), // Only 1 USDC
      });

      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest(validProvisionedBody));
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.error.code).toBe('INSUFFICIENT_POOL_BALANCE');
    });
  });

  describe('BYOW mode', () => {
    const validBYOWBody = {
      mode: 'byow',
      address: '0x' + 'ab'.repeat(20),
      name: 'BYOW Agent',
      description: 'An agent with its own wallet',
      capabilities: ['research'],
    };

    it('returns 200 with nonce and expiresAt', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest(validBYOWBody));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.nonce).toMatch(/^[0-9a-f]{64}$/);
      expect(body.expiresAt).toBeDefined();
    });

    it('stores deploy config in KV for verify step', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      await POST(createRequest(validBYOWBody));

      const config = kvStore.get(`deploy:config:${validBYOWBody.address}`);
      expect(config).toBeDefined();
      expect((config!.value as Record<string, unknown>).name).toBe('BYOW Agent');
    });

    it('stores nonce in KV with TTL', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      await POST(createRequest(validBYOWBody));

      const nonce = kvStore.get(`deploy:nonces:${validBYOWBody.address}`);
      expect(nonce).toBeDefined();
      expect(nonce!.expiresAt).toBeDefined();
    });
  });

  describe('Validation errors', () => {
    it('returns 400 for missing mode', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest({ name: 'Test' }));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    it('returns 400 for name too short', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest({
        mode: 'provisioned',
        name: 'AB',
        description: 'Valid description here',
        capabilities: ['research'],
      }));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.details).toBeDefined();
    });

    it('returns 400 for empty capabilities', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest({
        mode: 'provisioned',
        name: 'Valid Name',
        description: 'Valid description here',
        capabilities: [],
      }));

      expect((await response.json()).error.code).toBe('INVALID_REQUEST');
      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid BYOW address format', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest({
        mode: 'byow',
        address: 'not-a-hex-address',
        name: 'Valid Name',
        description: 'Valid description here',
        capabilities: ['research'],
      }));

      expect(response.status).toBe(400);
    });

    it('returns 501 for human mode (not yet implemented)', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest({
        mode: 'human',
        name: 'Human Agent',
        description: 'A human-deployed agent',
        capabilities: ['research'],
        linkReputation: true,
      }));

      expect(response.status).toBe(501);
      expect((await response.json()).error.code).toBe('NOT_IMPLEMENTED');
    });
  });
});

describe('POST /api/agents/deploy/verify', () => {
  beforeEach(() => {
    kvStore.clear();
    kvLists.clear();
    vi.clearAllMocks();
    mockCreateAgent.mockReturnValue(mockAgent);
    mockRegisterOnChain.mockResolvedValue({ waitMined: mockWaitMined, hash: '0xabc123' });
    mockWaitMined.mockResolvedValue({ receipt: { transactionHash: '0xabc123' }, result: {} });
  });

  it('returns 201 with agentId on valid signature', async () => {
    // Create a test account
    const testKey = '0x' + 'ab'.repeat(32);
    const account = privateKeyToAccount(testKey as `0x${string}`);

    // Simulate nonce generation (store nonce + config in KV)
    const nonce = 'a'.repeat(64);
    kvStore.set(`deploy:nonces:${account.address}`, { value: nonce });
    kvStore.set(`deploy:config:${account.address}`, {
      value: {
        name: 'BYOW Agent',
        description: 'Agent with own wallet',
        capabilities: ['research'],
      },
    });

    // Sign the nonce
    const signature = await account.signMessage({ message: nonce });

    const { POST } = await import('@/app/api/agents/deploy/verify/route');
    const response = await POST(createVerifyRequest({
      address: account.address,
      nonce,
      signature,
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.agentId).toBe('42');
    expect(body.address).toBe(account.address);
    expect(body.agentCard).toBeDefined();
  });

  it('consumes the nonce after successful verification', async () => {
    const testKey = '0x' + 'ab'.repeat(32);
    const account = privateKeyToAccount(testKey as `0x${string}`);
    const nonce = 'b'.repeat(64);

    kvStore.set(`deploy:nonces:${account.address}`, { value: nonce });
    kvStore.set(`deploy:config:${account.address}`, {
      value: { name: 'Test', description: 'Test agent desc', capabilities: ['research'] },
    });

    const signature = await account.signMessage({ message: nonce });

    const { POST } = await import('@/app/api/agents/deploy/verify/route');
    await POST(createVerifyRequest({ address: account.address, nonce, signature }));

    // Nonce should be consumed
    expect(kvStore.has(`deploy:nonces:${account.address}`)).toBe(false);
  });

  it('returns 401 for invalid signature and does NOT consume nonce', async () => {
    const realKey = '0x' + 'ab'.repeat(32);
    const fakeKey = '0x' + 'cd'.repeat(32);
    const realAccount = privateKeyToAccount(realKey as `0x${string}`);
    const fakeAccount = privateKeyToAccount(fakeKey as `0x${string}`);

    const nonce = 'c'.repeat(64);
    kvStore.set(`deploy:nonces:${realAccount.address}`, { value: nonce });
    kvStore.set(`deploy:config:${realAccount.address}`, {
      value: { name: 'Test', description: 'Test agent desc', capabilities: ['research'] },
    });

    // Sign with wrong account
    const signature = await fakeAccount.signMessage({ message: nonce });

    const { POST } = await import('@/app/api/agents/deploy/verify/route');
    const response = await POST(createVerifyRequest({
      address: realAccount.address,
      nonce,
      signature,
    }));

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe('INVALID_SIGNATURE');

    // Nonce should NOT be consumed
    expect(kvStore.has(`deploy:nonces:${realAccount.address}`)).toBe(true);
  });

  it('returns 410 for expired or used nonce', async () => {
    const testKey = '0x' + 'ab'.repeat(32);
    const account = privateKeyToAccount(testKey as `0x${string}`);
    const nonce = 'd'.repeat(64);

    // No nonce stored (simulates expired/used)
    const signature = await account.signMessage({ message: nonce });

    const { POST } = await import('@/app/api/agents/deploy/verify/route');
    const response = await POST(createVerifyRequest({
      address: account.address,
      nonce,
      signature,
    }));

    expect(response.status).toBe(410);
    expect((await response.json()).error.code).toBe('NONCE_EXPIRED');
  });

  it('returns 400 for malformed request body', async () => {
    const { POST } = await import('@/app/api/agents/deploy/verify/route');
    const response = await POST(createVerifyRequest({
      address: 'not-hex',
      nonce: 'too-short',
    }));

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('INVALID_REQUEST');
  });

  it('emits AGENT_DEPLOYED event with byow mode', async () => {
    const testKey = '0x' + 'ab'.repeat(32);
    const account = privateKeyToAccount(testKey as `0x${string}`);
    const nonce = 'e'.repeat(64);

    kvStore.set(`deploy:nonces:${account.address}`, { value: nonce });
    kvStore.set(`deploy:config:${account.address}`, {
      value: { name: 'BYOW', description: 'Test agent desc', capabilities: ['research'] },
    });

    const signature = await account.signMessage({ message: nonce });

    const { POST } = await import('@/app/api/agents/deploy/verify/route');
    await POST(createVerifyRequest({ address: account.address, nonce, signature }));

    const { kv } = await import('@vercel/kv');
    const zaddCalls = (kv.zadd as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = zaddCalls[zaddCalls.length - 1];
    const event = JSON.parse(lastCall[1].member);
    expect(event.type).toBe('agent:deployed');
    expect(event.data.mode).toBe('byow');
  });

  it('returns 410 when deploy config has expired', async () => {
    const testKey = '0x' + 'ab'.repeat(32);
    const account = privateKeyToAccount(testKey as `0x${string}`);
    const nonce = 'f'.repeat(64);

    // Store nonce but NOT config (simulates config expiry)
    kvStore.set(`deploy:nonces:${account.address}`, { value: nonce });

    const signature = await account.signMessage({ message: nonce });

    const { POST } = await import('@/app/api/agents/deploy/verify/route');
    const response = await POST(createVerifyRequest({
      address: account.address,
      nonce,
      signature,
    }));

    expect(response.status).toBe(410);
    expect((await response.json()).error.code).toBe('CONFIG_EXPIRED');
  });
});
