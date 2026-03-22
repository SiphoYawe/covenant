import { describe, it, expect, vi, beforeEach } from 'vitest';
import { kvStore, zaddCalls, clearKvStore, createKvMock } from '../../../helpers/kv-mock';

// --- Mock KV at the abstraction boundary ---
vi.mock('@/lib/storage/kv', () => createKvMock());
vi.mock('@/lib/storage', async () => {
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
    clearKvStore();
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
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe('AUTH_REQUIRED');
    });

    it('returns 400 when no embedded wallets found', async () => {
      mockWallets = [];
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest(validHumanBody));
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe('NO_WALLET');
    });
  });

  describe('Deployment with useOwnWallet', () => {
    it('uses embedded wallet as agent wallet when useOwnWallet is true', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest({ ...validHumanBody, useOwnWallet: true }));
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.address).toBe(humanWalletAddress);
      expect(body.humanAddress).toBe(humanWalletAddress);
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
      expect(mockSystemWriteContract).toHaveBeenCalled();
    });

    it('returns 503 when pool balance insufficient', async () => {
      const { getPublicClient } = await import('@/lib/wallets/manager');
      (getPublicClient as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        readContract: vi.fn().mockResolvedValue(BigInt(1_000_000)),
      });

      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest(validHumanBody));
      expect(response.status).toBe(503);
    });
  });

  describe('Reputation linking', () => {
    it('writes attestation when linkReputation is true', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest({ ...validHumanBody, linkReputation: true }));
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.linkedReputation).toBe(true);

      const attestation = kvStore.get(`agent:${body.agentId}:deployer-attestation`);
      expect(attestation).toBeDefined();

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
      expect(kvStore.has(`agent:${body.agentId}:deployer-attestation`)).toBe(false);
    });

    it('stores reverse lookup from agent to deployer', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest({ ...validHumanBody, linkReputation: true }));
      const body = await response.json();

      const deployer = kvStore.get(`agent:${body.agentId}:deployer`);
      expect(deployer).toBeDefined();
      expect(deployer!.value).toBe(humanWalletAddress);
    });
  });

  describe('Response shape', () => {
    it('returns HumanDeployResponse with all fields', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest({ ...validHumanBody, linkReputation: true }));
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.agentId).toBe('42');
      expect(body.address).toBeDefined();
      expect(body.humanAddress).toBe(humanWalletAddress);
      expect(body.linkedReputation).toBe(true);
      expect(body.agentCard).toBeDefined();
    });

    it('includes agent card with correct metadata', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      const response = await POST(createRequest(validHumanBody));
      const body = await response.json();

      expect(body.agentCard.name).toBe('Human Agent');
      expect(body.agentCard.description).toBe('An agent deployed by a human');
    });
  });

  describe('Registration', () => {
    it('registers agent on ERC-8004', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      await POST(createRequest(validHumanBody));

      expect(mockCreateAgent).toHaveBeenCalledWith('Human Agent', 'An agent deployed by a human');
      expect(mockRegisterOnChain).toHaveBeenCalled();
    });

    it('stores agent card in KV', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      await POST(createRequest(validHumanBody));

      const card = kvStore.get('agent:42:card');
      expect(card).toBeDefined();
      expect((card!.value as Record<string, unknown>).name).toBe('Human Agent');
    });

    it('emits AGENT_DEPLOYED_HUMAN event', async () => {
      const { POST } = await import('@/app/api/agents/deploy/route');
      await POST(createRequest(validHumanBody));

      const deployEvent = zaddCalls.find((call) => {
        const event = JSON.parse((call[1] as { member: string }).member);
        return event.type === 'agent:deployed-human';
      });
      expect(deployEvent).toBeDefined();
      const event = JSON.parse((deployEvent![1] as { member: string }).member);
      expect(event.data.mode).toBe('human');
      expect(event.data.humanAddress).toBe(humanWalletAddress);
    });
  });
});
