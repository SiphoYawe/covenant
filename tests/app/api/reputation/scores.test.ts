import { describe, test, expect, vi, beforeEach } from 'vitest';
import { kvStore, clearKvStore, createKvMock } from '../../../helpers/kv-mock';

// Mock KV at the abstraction boundary
vi.mock('@/lib/storage/kv', () => createKvMock());

import { GET } from '@/app/api/reputation/scores/route';

describe('GET /api/reputation/scores', () => {
  beforeEach(() => {
    clearKvStore();
    vi.clearAllMocks();
  });

  test('returns empty array when no agents have scores', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
  });

  test('returns all agents with reputation data from KV', async () => {
    kvStore.set('demo:agents', { value: ['agent-b', 'agent-c'] });
    kvStore.set('agent:agent-b:reputation', {
      value: {
        score: 8.5,
        explanationCid: 'bafyb',
        txHash: '0x1',
        updatedAt: 1000,
      },
    });
    kvStore.set('agent:agent-c:reputation', {
      value: {
        score: 8.0,
        explanationCid: 'bafyc',
        txHash: '0x2',
        updatedAt: 2000,
      },
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0].agentId).toBe('agent-b');
    expect(data[0].score).toBe(8.5);
  });

  test('filters out agents with no reputation entry', async () => {
    kvStore.set('demo:agents', { value: ['agent-b', 'agent-c', 'agent-d'] });
    kvStore.set('agent:agent-b:reputation', {
      value: {
        score: 8.5,
        explanationCid: 'bafyb',
        txHash: '0x1',
        updatedAt: 1000,
      },
    });
    // agent-c and agent-d have no reputation data

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].agentId).toBe('agent-b');
  });

  test('returns correct response shape for each agent', async () => {
    kvStore.set('demo:agents', { value: ['agent-b'] });
    kvStore.set('agent:agent-b:reputation', {
      value: {
        score: 8.5,
        explanationCid: 'bafybeig12345',
        txHash: '0xabc',
        updatedAt: 1711216000,
      },
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
