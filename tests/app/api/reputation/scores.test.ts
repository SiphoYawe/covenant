import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock @vercel/kv
const kvStore = new Map<string, unknown>();
vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(async (key: string) => kvStore.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => { kvStore.set(key, value); }),
    del: vi.fn(async (key: string) => { kvStore.delete(key); }),
    lpush: vi.fn(),
    lrange: vi.fn().mockResolvedValue([]),
    zadd: vi.fn().mockResolvedValue(1),
    zrange: vi.fn().mockResolvedValue([]),
  },
}));

import { GET } from '@/app/api/reputation/scores/route';

describe('GET /api/reputation/scores', () => {
  beforeEach(() => {
    kvStore.clear();
    vi.clearAllMocks();
  });

  test('returns empty array when no agents have scores', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
  });

  test('returns all agents with reputation data from KV', async () => {
    kvStore.set('demo:agents', ['agent-b', 'agent-c']);
    kvStore.set('agent:agent-b:reputation', {
      score: 8.5,
      explanationCid: 'bafyb',
      txHash: '0x1',
      updatedAt: 1000,
    });
    kvStore.set('agent:agent-c:reputation', {
      score: 8.0,
      explanationCid: 'bafyc',
      txHash: '0x2',
      updatedAt: 2000,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0].agentId).toBe('agent-b');
    expect(data[0].score).toBe(8.5);
  });

  test('filters out agents with no reputation entry', async () => {
    kvStore.set('demo:agents', ['agent-b', 'agent-c', 'agent-d']);
    kvStore.set('agent:agent-b:reputation', {
      score: 8.5,
      explanationCid: 'bafyb',
      txHash: '0x1',
      updatedAt: 1000,
    });
    // agent-c and agent-d have no reputation data

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].agentId).toBe('agent-b');
  });

  test('returns correct response shape for each agent', async () => {
    kvStore.set('demo:agents', ['agent-b']);
    kvStore.set('agent:agent-b:reputation', {
      score: 8.5,
      explanationCid: 'bafybeig12345',
      txHash: '0xabc',
      updatedAt: 1711216000,
    });

    const response = await GET();
    const data = await response.json();

    expect(data[0]).toEqual({
      agentId: 'agent-b',
      score: 8.5,
      explanationCid: 'bafybeig12345',
      txHash: '0xabc',
      updatedAt: 1711216000,
    });
  });
});
