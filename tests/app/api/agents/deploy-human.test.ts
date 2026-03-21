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
    lpush: vi.fn(async (key: string, value: string) => {}),
    lrange: vi.fn(async () => []),
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
};

vi.mock('@/lib/config/env', () => ({
  env: TEST_ENV,
}));

// --- Mock agent0-sdk ---
const mockWaitMined = vi.fn().mockResolvedValue({ receipt: { transactionHash: '0xabc123' }, result: {} });
const mockRegisterOnChain = vi.fn().mockResolvedValue({ waitMined: mockWaitMined, hash: '0xabc123' });
const mockGiveFeedback = vi.fn().mockResolvedValue({ waitMined: mockWaitMined, hash: '0xattest' });
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
    giveFeedback = mockGiveFeedback;
    identityRegistryAddress = vi.fn().mockReturnValue('0x8004A818BFB912233c491871b3d84c89A494BD9e');
    reputationRegistryAddress = vi.fn().mockReturnValue('0x8004B663056A597Dffe9eCcC1965A193B7388713');
  },
}));

// --- Mock wallet manager ---
const mockSystemWriteContract = vi.fn().mockResolvedValue('0xtxhash');

vi.mock('@/lib/wallets', () => ({
  getWallet: vi.fn().mockReturnValue({
    client: { account: { address: '0x' + 'aa'.repeat(20) } },
    writeContract: mockSystemWriteContract,
  }),
  getAddress: vi.fn().mockReturnValue('0x' + 'aa'.repeat(20)),
}));

vi.mock('@/lib/wallets/manager', () => ({
  getPublicClient: vi.fn().mockReturnValue({
    readContract: vi.fn().mockResolvedValue(BigInt(10_000_000)),
  }),
}));

// --- Mock Civic Auth ---
const humanWalletAddress = '0x' + 'cc'.repeat(20);
let mockUser: Record<string, unknown> | null = { id: 'civic-user-1', email: 'test@test.com' };
let mockWallets: string[] = [humanWalletAddress];

vi.mock('@civic/auth/nextjs', () => ({
  getUser: vi.fn(async () => mockUser),
}));

vi.mock('@civic/auth-web3/server', () => ({
  getWallets: vi.fn(async () => mockWallets.map(addr => ({ walletAddress: addr }))),
}));

function createRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/agents/deploy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validHumanBody = {
  mode: 'human',
  name: 'Human Agent',
  description: 'An agent deployed by a human',
  capabilities: ['research'],
  linkReputation: false,
};

describe('POST /api/agents/deploy (human mode)', () => {
  beforeEach(() => {
    kvStore.clear();
    vi.clearAllMocks();
    mockUser = { id: 'civic-user-1', email: 'test@test.com' };
    mockWallets = [humanWalletAddress];
    mockCreateAgent.mockReturnValue(mockAgent);
    mockRegisterOnChain.mockResolvedValue({ waitMined: mockWaitMined, hash: '0xabc123' });
    mockWaitMined.mockResolvedValue({ receipt: { transactionHash: '0xabc123' }, result: {} });
    mockGiveFeedback.mockResolvedValue({ waitMined: mockWaitMined, hash: '0xattest' });
  });

  describe('Authentication', () => {
    it('returns 401 when no Civic session', async () => {
      mockUser = null;

      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest(validHumanBody));
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error.code).toBe('AUTH_REQUIRED');
    });

    it('returns 400 when no embedded wallets found', async () => {
      mockWallets = [];

      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest(validHumanBody));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error.code).toBe('NO_WALLET');
    });
  });

  describe('Deployment with useOwnWallet', () => {
    it('uses embedded wallet as agent wallet when useOwnWallet is true', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest({
        ...validHumanBody,
        useOwnWallet: true,
      }));
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.address).toBe(humanWalletAddress);
      expect(body.humanAddress).toBe(humanWalletAddress);
      // Should NOT call fundFromPool
      expect(mockSystemWriteContract).not.toHaveBeenCalled();
    });
  });

  describe('Deployment with provisioned wallet', () => {
    it('provisions new wallet when useOwnWallet is false', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest(validHumanBody));
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.agentId).toBe('42');
      expect(body.humanAddress).toBe(humanWalletAddress);
      // Should call fundFromPool (via writeContract on system wallet)
      expect(mockSystemWriteContract).toHaveBeenCalled();
    });
  });

  describe('Reputation linking', () => {
    it('writes attestation when linkReputation is true', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest({
        ...validHumanBody,
        linkReputation: true,
      }));
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.linkedReputation).toBe(true);

      // Attestation should be stored in KV
      const attestation = kvStore.get(`agent:${body.agentId}:deployer-attestation`);
      expect(attestation).toBeDefined();

      // Deployer profile should be created with linked agent
      const profile = kvStore.get(`deployer:${humanWalletAddress}:profile`);
      expect(profile).toBeDefined();
      const profileValue = profile!.value as { linkedAgents: string[] };
      expect(profileValue.linkedAgents).toContain(body.agentId);
    });

    it('skips attestation when linkReputation is false', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest(validHumanBody));
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.linkedReputation).toBe(false);

      // No attestation
      const attestation = kvStore.get(`agent:${body.agentId}:deployer-attestation`);
      expect(attestation).toBeUndefined();
    });
  });

  describe('Events', () => {
    it('emits AGENT_DEPLOYED_HUMAN event', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      await POST(createRequest(validHumanBody));

      const { kv } = await import('@vercel/kv');
      const zaddCalls = (kv.zadd as ReturnType<typeof vi.fn>).mock.calls;
      // Find the human deploy event
      const deployEvent = zaddCalls.find((call) => {
        const event = JSON.parse(call[1].member);
        return event.type === 'agent:deployed-human';
      });
      expect(deployEvent).toBeDefined();
      const event = JSON.parse(deployEvent![1].member);
      expect(event.data.mode).toBe('human');
      expect(event.data.humanAddress).toBe(humanWalletAddress);
    });
  });

  describe('Response shape', () => {
    it('returns HumanDeployResponse with all fields', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest({
        ...validHumanBody,
        linkReputation: true,
      }));
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.agentId).toBe('42');
      expect(body.address).toBeDefined();
      expect(body.humanAddress).toBe(humanWalletAddress);
      expect(body.linkedReputation).toBe(true);
      expect(body.agentCard).toBeDefined();
    });
  });
});
