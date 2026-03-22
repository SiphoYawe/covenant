import { describe, it, expect, vi, beforeEach } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { kvStore, zaddCalls, clearKvStore, createKvMock } from '../../../helpers/kv-mock';

// --- Mock KV at the abstraction boundary ---
vi.mock('@/lib/storage/kv', () => createKvMock());

// Also mock @/lib/storage (re-exports from kv.ts)
vi.mock('@/lib/storage', async (importOriginal) => {
  const kvMock = createKvMock();
  return {
    kvGet: kvMock.kvGet,
    kvSet: kvMock.kvSet,
    kvDel: kvMock.kvDel,
    kvLpush: kvMock.kvLpush,
    kvLrange: kvMock.kvLrange,
    kvScan: kvMock.kvScan,
    pin: vi.fn(async () => 'QmTestCid'),
    get: vi.fn(async () => null),
  };
});

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

// --- Mock Civic Auth (not authenticated by default for provisioned/BYOW) ---
vi.mock('@civic/auth/nextjs', () => ({
  getUser: vi.fn(async () => null),
}));

vi.mock('@civic/auth-web3/server', () => ({
  getWallets: vi.fn(async () => []),
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
    clearKvStore();
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

      expect(mockSystemWriteContract).toHaveBeenCalled();
    });

    it('stores agent card in KV', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      await POST(createRequest(validProvisionedBody));

      const stored = kvStore.get('agent:42:card');
      expect(stored).toBeDefined();
      expect((stored!.value as Record<string, unknown>).name).toBe('Test Agent');
    });

    it('stores provisioned wallet private key in KV', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest(validProvisionedBody));
      const body = await response.json();

      const keyEntry = kvStore.get(`wallet:${body.address}:key`);
      expect(keyEntry).toBeDefined();
      expect((keyEntry!.value as string)).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('stores provisioned-at timestamp in KV', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest(validProvisionedBody));
      const body = await response.json();

      const atEntry = kvStore.get(`wallet:${body.address}:provisioned-at`);
      expect(atEntry).toBeDefined();
    });

    it('records funded amount in KV', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest(validProvisionedBody));
      const body = await response.json();

      const fundedEntry = kvStore.get(`wallet:${body.address}:funded-amount`);
      expect(fundedEntry).toBeDefined();
      expect(fundedEntry!.value).toBe(5_000_000);
    });

    it('emits AGENT_DEPLOYED event', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      await POST(createRequest(validProvisionedBody));

      expect(zaddCalls.length).toBeGreaterThan(0);
      const lastCall = zaddCalls[zaddCalls.length - 1];
      const event = JSON.parse((lastCall[1] as { member: string }).member);
      expect(event.type).toBe('agent:deployed');
      expect(event.data.mode).toBe('provisioned');
      expect(event.data.fundedAmount).toBe(5_000_000);
    });

    it('returns 503 when pool balance is insufficient', async () => {
      const { getPublicClient } = await import('@/lib/wallets/manager');
      (getPublicClient as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        readContract: vi.fn().mockResolvedValue(BigInt(1_000_000)),
      });

      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest(validProvisionedBody));
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.error.code).toBe('INSUFFICIENT_POOL_BALANCE');
    });

    it('handles registration failure gracefully', async () => {
      mockRegisterOnChain.mockRejectedValueOnce(new Error('Chain error'));

      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest(validProvisionedBody));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.code).toBe('DEPLOY_FAILED');
    });

    it('handles funding failure gracefully', async () => {
      mockSystemWriteContract.mockRejectedValueOnce(new Error('Transfer failed'));

      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest(validProvisionedBody));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.code).toBe('DEPLOY_FAILED');
    });

    it('generates unique wallets for each deployment', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const res1 = await POST(createRequest(validProvisionedBody));
      const body1 = await res1.json();

      const res2 = await POST(createRequest({ ...validProvisionedBody, name: 'Agent Two' }));
      const body2 = await res2.json();

      expect(body1.address).not.toBe(body2.address);
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

    it('stores config with TTL matching nonce', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      await POST(createRequest(validBYOWBody));

      const config = kvStore.get(`deploy:config:${validBYOWBody.address}`);
      expect(config).toBeDefined();
      expect(config!.expiresAt).toBeDefined();
    });

    it('does not fund wallet or register on-chain', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      await POST(createRequest(validBYOWBody));

      expect(mockSystemWriteContract).not.toHaveBeenCalled();
      expect(mockCreateAgent).not.toHaveBeenCalled();
    });

    it('generates unique nonces per request', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const res1 = await POST(createRequest(validBYOWBody));
      const body1 = await res1.json();

      const res2 = await POST(createRequest(validBYOWBody));
      const body2 = await res2.json();

      expect(body1.nonce).not.toBe(body2.nonce);
    });
  });

  describe('Validation errors', () => {
    it('returns 400 for missing mode', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest({ name: 'Test' }));
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe('INVALID_REQUEST');
    });

    it('returns 400 for name too short', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest({
        mode: 'provisioned', name: 'AB',
        description: 'Valid description here', capabilities: ['research'],
      }));
      expect(response.status).toBe(400);
    });

    it('returns 400 for name too long', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest({
        mode: 'provisioned', name: 'A'.repeat(51),
        description: 'Valid description here', capabilities: ['research'],
      }));
      expect(response.status).toBe(400);
    });

    it('returns 400 for description too short', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest({
        mode: 'provisioned', name: 'Valid Name',
        description: 'Short', capabilities: ['research'],
      }));
      expect(response.status).toBe(400);
    });

    it('returns 400 for empty capabilities', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest({
        mode: 'provisioned', name: 'Valid Name',
        description: 'Valid description here', capabilities: [],
      }));
      expect(response.status).toBe(400);
    });

    it('returns 400 for too many capabilities', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest({
        mode: 'provisioned', name: 'Valid Name',
        description: 'Valid description here',
        capabilities: Array.from({ length: 11 }, (_, i) => `cap_${i}`),
      }));
      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid BYOW address format', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest({
        mode: 'byow', address: 'not-a-hex-address',
        name: 'Valid Name', description: 'Valid description here', capabilities: ['research'],
      }));
      expect(response.status).toBe(400);
    });

    it('returns 400 for BYOW address too short', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest({
        mode: 'byow', address: '0x1234',
        name: 'Valid Name', description: 'Valid description here', capabilities: ['research'],
      }));
      expect(response.status).toBe(400);
    });

    it('returns 401 for human mode without Civic session', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest({
        mode: 'human', name: 'Human Agent', description: 'A human-deployed agent',
        capabilities: ['research'], linkReputation: true,
      }));
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe('AUTH_REQUIRED');
    });
  });
});

describe('POST /api/agents/deploy/verify', () => {
  beforeEach(() => {
    clearKvStore();
    vi.clearAllMocks();
    mockCreateAgent.mockReturnValue(mockAgent);
    mockRegisterOnChain.mockResolvedValue({ waitMined: mockWaitMined, hash: '0xabc123' });
    mockWaitMined.mockResolvedValue({ receipt: { transactionHash: '0xabc123' }, result: {} });
  });

  it('returns 201 with agentId on valid signature', async () => {
    const testKey = '0x' + 'ab'.repeat(32);
    const account = privateKeyToAccount(testKey as `0x${string}`);
    const nonce = 'a'.repeat(64);

    kvStore.set(`deploy:nonces:${account.address}`, { value: nonce });
    kvStore.set(`deploy:config:${account.address}`, {
      value: { name: 'BYOW Agent', description: 'Agent with own wallet', capabilities: ['research'] },
    });

    const signature = await account.signMessage({ message: nonce });

    const { POST } = await import('@/app/api/agents/deploy/verify/route');
    const response = await POST(createVerifyRequest({ address: account.address, nonce, signature }));
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

    expect(kvStore.has(`deploy:nonces:${account.address}`)).toBe(false);
  });

  it('cleans up deploy config after successful verification', async () => {
    const testKey = '0x' + 'ab'.repeat(32);
    const account = privateKeyToAccount(testKey as `0x${string}`);
    const nonce = 'c'.repeat(64);

    kvStore.set(`deploy:nonces:${account.address}`, { value: nonce });
    kvStore.set(`deploy:config:${account.address}`, {
      value: { name: 'Test', description: 'Test agent desc', capabilities: ['research'] },
    });

    const signature = await account.signMessage({ message: nonce });
    const { POST } = await import('@/app/api/agents/deploy/verify/route');
    await POST(createVerifyRequest({ address: account.address, nonce, signature }));

    expect(kvStore.has(`deploy:config:${account.address}`)).toBe(false);
  });

  it('returns 401 for invalid signature and does NOT consume nonce', async () => {
    const realKey = '0x' + 'ab'.repeat(32);
    const fakeKey = '0x' + 'cd'.repeat(32);
    const realAccount = privateKeyToAccount(realKey as `0x${string}`);
    const fakeAccount = privateKeyToAccount(fakeKey as `0x${string}`);
    const nonce = 'f'.repeat(64);

    kvStore.set(`deploy:nonces:${realAccount.address}`, { value: nonce });
    kvStore.set(`deploy:config:${realAccount.address}`, {
      value: { name: 'Test', description: 'Test agent desc', capabilities: ['research'] },
    });

    const signature = await fakeAccount.signMessage({ message: nonce });
    const { POST } = await import('@/app/api/agents/deploy/verify/route');
    const response = await POST(createVerifyRequest({
      address: realAccount.address, nonce, signature,
    }));

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe('INVALID_SIGNATURE');
    expect(kvStore.has(`deploy:nonces:${realAccount.address}`)).toBe(true);
  });

  it('returns 410 for expired or used nonce', async () => {
    const testKey = '0x' + 'ab'.repeat(32);
    const account = privateKeyToAccount(testKey as `0x${string}`);
    const nonce = '1'.repeat(64);
    const signature = await account.signMessage({ message: nonce });

    const { POST } = await import('@/app/api/agents/deploy/verify/route');
    const response = await POST(createVerifyRequest({ address: account.address, nonce, signature }));

    expect(response.status).toBe(410);
    expect((await response.json()).error.code).toBe('NONCE_EXPIRED');
  });

  it('returns 410 when deploy config has expired but nonce exists', async () => {
    const testKey = '0x' + 'ab'.repeat(32);
    const account = privateKeyToAccount(testKey as `0x${string}`);
    const nonce = '2'.repeat(64);

    kvStore.set(`deploy:nonces:${account.address}`, { value: nonce });
    // No config stored

    const signature = await account.signMessage({ message: nonce });
    const { POST } = await import('@/app/api/agents/deploy/verify/route');
    const response = await POST(createVerifyRequest({ address: account.address, nonce, signature }));

    expect(response.status).toBe(410);
    expect((await response.json()).error.code).toBe('CONFIG_EXPIRED');
  });

  it('returns 400 for malformed request body', async () => {
    const { POST } = await import('@/app/api/agents/deploy/verify/route');
    const response = await POST(createVerifyRequest({ address: 'not-hex', nonce: 'too-short' }));

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('INVALID_REQUEST');
  });

  it('prevents nonce replay (second attempt fails)', async () => {
    const testKey = '0x' + 'ab'.repeat(32);
    const account = privateKeyToAccount(testKey as `0x${string}`);
    const nonce = '3'.repeat(64);

    kvStore.set(`deploy:nonces:${account.address}`, { value: nonce });
    kvStore.set(`deploy:config:${account.address}`, {
      value: { name: 'Test', description: 'Test agent desc', capabilities: ['research'] },
    });

    const signature = await account.signMessage({ message: nonce });
    const { POST } = await import('@/app/api/agents/deploy/verify/route');

    const res1 = await POST(createVerifyRequest({ address: account.address, nonce, signature }));
    expect(res1.status).toBe(201);

    // Re-store config (was consumed) but nonce is gone
    kvStore.set(`deploy:config:${account.address}`, {
      value: { name: 'Test', description: 'Test agent desc', capabilities: ['research'] },
    });

    const res2 = await POST(createVerifyRequest({ address: account.address, nonce, signature }));
    expect(res2.status).toBe(410);
  });

  it('emits AGENT_DEPLOYED event with byow mode on successful verify', async () => {
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

    expect(zaddCalls.length).toBeGreaterThan(0);
    const lastCall = zaddCalls[zaddCalls.length - 1];
    const event = JSON.parse((lastCall[1] as { member: string }).member);
    expect(event.type).toBe('agent:deployed');
    expect(event.data.mode).toBe('byow');
  });
});

describe('Full BYOW E2E flow', () => {
  beforeEach(() => {
    clearKvStore();
    vi.clearAllMocks();
    mockCreateAgent.mockReturnValue(mockAgent);
    mockRegisterOnChain.mockResolvedValue({ waitMined: mockWaitMined, hash: '0xabc123' });
    mockWaitMined.mockResolvedValue({ receipt: { transactionHash: '0xabc123' }, result: {} });
  });

  it('completes full BYOW deployment: step1 (nonce) + step2 (verify + register)', async () => {
    const testKey = '0x' + 'ab'.repeat(32);
    const account = privateKeyToAccount(testKey as `0x${string}`);

    // Step 1: Request nonce
    const deployRoute = await import('@/app/api/agents/deploy/route');
    const step1Response = await deployRoute.POST(createRequest({
      mode: 'byow', address: account.address,
      name: 'E2E BYOW Agent', description: 'End to end test agent',
      capabilities: ['research', 'analysis'],
    }));

    expect(step1Response.status).toBe(200);
    const step1Body = await step1Response.json();
    expect(step1Body.nonce).toMatch(/^[0-9a-f]{64}$/);

    // Step 2: Sign the nonce and verify
    const signature = await account.signMessage({ message: step1Body.nonce });
    const verifyRoute = await import('@/app/api/agents/deploy/verify/route');
    const step2Response = await verifyRoute.POST(createVerifyRequest({
      address: account.address, nonce: step1Body.nonce, signature,
    }));

    expect(step2Response.status).toBe(201);
    const step2Body = await step2Response.json();
    expect(step2Body.agentId).toBe('42');
    expect(step2Body.address).toBe(account.address);
    expect(step2Body.agentCard).toBeDefined();
    expect(step2Body.agentCard.name).toBe('E2E BYOW Agent');

    // Verify cleanup
    expect(kvStore.has(`deploy:nonces:${account.address}`)).toBe(false);
    expect(kvStore.has(`deploy:config:${account.address}`)).toBe(false);
    expect(kvStore.has('agent:42:card')).toBe(true);
  });

  it('rejects BYOW verification with wrong wallet', async () => {
    const ownerKey = '0x' + 'ab'.repeat(32);
    const attackerKey = '0x' + 'cd'.repeat(32);
    const ownerAccount = privateKeyToAccount(ownerKey as `0x${string}`);
    const attackerAccount = privateKeyToAccount(attackerKey as `0x${string}`);

    const deployRoute = await import('@/app/api/agents/deploy/route');
    const step1Response = await deployRoute.POST(createRequest({
      mode: 'byow', address: ownerAccount.address,
      name: 'Victim Agent', description: 'Agent that attacker wants to steal',
      capabilities: ['research'],
    }));
    const { nonce } = await step1Response.json();

    const attackerSignature = await attackerAccount.signMessage({ message: nonce });
    const verifyRoute = await import('@/app/api/agents/deploy/verify/route');
    const step2Response = await verifyRoute.POST(createVerifyRequest({
      address: ownerAccount.address, nonce, signature: attackerSignature,
    }));

    expect(step2Response.status).toBe(401);
    expect(kvStore.has(`deploy:nonces:${ownerAccount.address}`)).toBe(true);
  });
});

describe('Full Provisioned E2E flow', () => {
  beforeEach(() => {
    clearKvStore();
    vi.clearAllMocks();
    mockCreateAgent.mockReturnValue(mockAgent);
    mockRegisterOnChain.mockResolvedValue({ waitMined: mockWaitMined, hash: '0xabc123' });
    mockWaitMined.mockResolvedValue({ receipt: { transactionHash: '0xabc123' }, result: {} });
  });

  it('completes full provisioned deployment in one call', async () => {
    const { POST } = await import('@/app/api/agents/deploy/route');
    const response = await POST(createRequest({
      mode: 'provisioned', name: 'Provisioned E2E Agent',
      description: 'Full end to end provisioned deployment',
      capabilities: ['research', 'code_review'],
    }));

    expect(response.status).toBe(201);
    const body = await response.json();

    expect(body.agentId).toBe('42');
    expect(body.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(body.agentCard.name).toBe('Provisioned E2E Agent');
    expect(kvStore.has(`wallet:${body.address}:key`)).toBe(true);
    expect(mockSystemWriteContract).toHaveBeenCalledTimes(1);
    expect(mockCreateAgent).toHaveBeenCalledWith('Provisioned E2E Agent', 'Full end to end provisioned deployment');
    expect(mockRegisterOnChain).toHaveBeenCalledTimes(1);

    const card = kvStore.get('agent:42:card');
    expect(card).toBeDefined();
    expect((card!.value as Record<string, unknown>).name).toBe('Provisioned E2E Agent');
  });
});
