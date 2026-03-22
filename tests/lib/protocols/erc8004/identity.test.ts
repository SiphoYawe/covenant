import { describe, it, expect, vi, beforeEach } from 'vitest';
import { kvStore, zaddCalls, clearKvStore, createKvMock } from '../../../helpers/kv-mock';

const TEST_KEYS = {
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
  env: TEST_KEYS,
}));

// Mock KV at the abstraction boundary
vi.mock('@/lib/storage/kv', () => createKvMock());

// Mock agent0-sdk
const mockWaitMined = vi.fn().mockResolvedValue({ receipt: { transactionHash: '0xabc123' }, result: {} });
const mockRegisterOnChain = vi.fn().mockResolvedValue({ waitMined: mockWaitMined, hash: '0xabc123' });
const mockAgent = {
  get agentId() { return '42'; },
  get agentURI() { return 'data:application/json;base64,test'; },
  registerOnChain: mockRegisterOnChain,
};
const mockCreateAgent = vi.fn().mockReturnValue(mockAgent);
const mockGetAgent = vi.fn();

vi.mock('agent0-sdk', () => ({
  SDK: class MockSDK {
    createAgent = mockCreateAgent;
    getAgent = mockGetAgent;
    identityRegistryAddress = vi.fn().mockReturnValue('0x8004A818BFB912233c491871b3d84c89A494BD9e');
    reputationRegistryAddress = vi.fn().mockReturnValue('0x8004B663056A597Dffe9eCcC1965A193B7388713');
  },
}));

describe('Agent Registration (identity.ts)', () => {
  beforeEach(() => {
    clearKvStore();
    mockCreateAgent.mockClear();
    mockRegisterOnChain.mockClear();
    mockWaitMined.mockClear();
    mockGetAgent.mockClear();
    vi.resetModules();
  });

  it('registerAgent calls SDK createAgent and registerOnChain', async () => {
    const { registerAgent } = await import('@/lib/protocols/erc8004/identity');
    const result = await registerAgent('researcher');

    expect(mockCreateAgent).toHaveBeenCalledWith('Covenant Researcher', expect.any(String));
    expect(mockRegisterOnChain).toHaveBeenCalled();
    expect(result.agentId).toBe('42');
    expect(result.txHash).toBe('0xabc123');
    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('registerAgent caches profile in KV', async () => {
    const { registerAgent } = await import('@/lib/protocols/erc8004/identity');
    await registerAgent('reviewer');

    const entry = kvStore.get('agent:42:profile');
    expect(entry).toBeDefined();
    const profile = entry!.value as Record<string, unknown>;
    expect(profile.role).toBe('reviewer');
    expect(profile.agentId).toBe('42');
  });

  it('registerAgent adds agent to demo:agents list', async () => {
    const { registerAgent } = await import('@/lib/protocols/erc8004/identity');
    await registerAgent('summarizer');

    const entry = kvStore.get('demo:agents');
    const agents = entry ? (entry.value as string[]) : [];
    expect(agents).toContain('42');
  });

  it('registerAgent emits agent:registered event to bus', async () => {
    const { registerAgent } = await import('@/lib/protocols/erc8004/identity');
    await registerAgent('malicious');

    // Event bus uses kv.zadd — check it was called
    expect(zaddCalls.length).toBeGreaterThan(0);
  });

  it('registerAgent throws on SDK failure', async () => {
    mockRegisterOnChain.mockRejectedValueOnce(new Error('TX reverted'));

    const { registerAgent } = await import('@/lib/protocols/erc8004/identity');
    await expect(registerAgent('researcher')).rejects.toThrow('TX reverted');
  });
});

describe('Agent Queries (identity.ts)', () => {
  beforeEach(() => {
    clearKvStore();
    mockGetAgent.mockClear();
    vi.resetModules();
  });

  it('getAgent returns cached profile from KV', async () => {
    const profile = {
      agentId: '99',
      role: 'researcher',
      address: '0x1234',
      metadataURI: 'ipfs://test',
    };
    kvStore.set('agent:99:profile', { value: profile });

    const { getAgent } = await import('@/lib/protocols/erc8004/identity');
    const result = await getAgent('99');
    expect(result).toEqual(profile);
    // Should not call SDK
    expect(mockGetAgent).not.toHaveBeenCalled();
  });

  it('getAgent queries on-chain on cache miss', async () => {
    mockGetAgent.mockResolvedValueOnce({
      owners: ['0xOwnerAddress'],
      agentURI: 'data:application/json;base64,test',
    });

    const { getAgent } = await import('@/lib/protocols/erc8004/identity');
    const result = await getAgent('100');

    expect(mockGetAgent).toHaveBeenCalledWith('100');
    expect(result).not.toBeNull();
    expect(result!.agentId).toBe('100');
  });

  it('getAgent returns null for non-existent agent', async () => {
    mockGetAgent.mockResolvedValueOnce(null);

    const { getAgent } = await import('@/lib/protocols/erc8004/identity');
    const result = await getAgent('999');
    expect(result).toBeNull();
  });

  it('getAgent caches on-chain result in KV', async () => {
    mockGetAgent.mockResolvedValueOnce({
      owners: ['0xCached'],
      agentURI: 'data:test',
    });

    const { getAgent } = await import('@/lib/protocols/erc8004/identity');
    await getAgent('200');

    expect(kvStore.has('agent:200:profile')).toBe(true);
  });

  it('getAllAgents returns all registered agents', async () => {
    kvStore.set('demo:agents', { value: ['10', '20'] });
    kvStore.set('agent:10:profile', { value: { agentId: '10', role: 'researcher', address: '0x1', metadataURI: '' } });
    kvStore.set('agent:20:profile', { value: { agentId: '20', role: 'reviewer', address: '0x2', metadataURI: '' } });

    const { getAllAgents } = await import('@/lib/protocols/erc8004/identity');
    const agents = await getAllAgents();
    expect(agents).toHaveLength(2);
    expect(agents.map((a) => a.agentId)).toEqual(['10', '20']);
  });
});
