import { describe, it, expect, vi, beforeEach } from 'vitest';
import { discoverAgents, sendTask, getTask } from '@/lib/protocols/a2a/client';

vi.mock('@/lib/storage/kv', () => ({
  kvGet: vi.fn(),
}));

vi.mock('@/lib/wallets', () => ({
  getAddress: vi.fn().mockReturnValue('0x1234567890abcdef1234567890abcdef12345678'),
}));

import { kvGet } from '@/lib/storage/kv';

const mockedKvGet = vi.mocked(kvGet);

describe('discoverAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all 4 agents when no capability filter', async () => {
    mockedKvGet.mockResolvedValue(null);

    const agents = await discoverAgents();
    expect(agents).toHaveLength(4);
    const names = agents.map((a) => a.name);
    expect(names).toContain('Covenant Researcher');
    expect(names).toContain('CodeGuard');
    expect(names).toContain('SynthAI');
    expect(names).toContain('ShadowReview');
  });

  it('filters by review_code — returns reviewer and malicious', async () => {
    mockedKvGet.mockResolvedValue(null);

    const agents = await discoverAgents('review_code');
    expect(agents).toHaveLength(2);
    const names = agents.map((a) => a.name);
    expect(names).toContain('CodeGuard');
    expect(names).toContain('ShadowReview');
  });

  it('filters by summarize_text — returns only summarizer', async () => {
    mockedKvGet.mockResolvedValue(null);

    const agents = await discoverAgents('summarize_text');
    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe('SynthAI');
  });

  it('returns empty array for nonexistent skill', async () => {
    mockedKvGet.mockResolvedValue(null);

    const agents = await discoverAgents('nonexistent_skill');
    expect(agents).toHaveLength(0);
  });

  it('includes KV reputation scores when available', async () => {
    mockedKvGet.mockImplementation(async (key: string) => {
      if (key === 'agent:reviewer:reputation') return { score: 9.0, explanation: 'Great' };
      return null;
    });

    const agents = await discoverAgents();
    const reviewer = agents.find((a) => a.name === 'CodeGuard');
    expect(reviewer?.reputationScore).toBe(9.0);
  });

  it('defaults to 5.0 for agents without KV reputation', async () => {
    mockedKvGet.mockResolvedValue(null);

    const agents = await discoverAgents();
    for (const agent of agents) {
      expect(agent.reputationScore).toBe(5.0);
    }
  });

  it('discovery uses parallel lookups (no N+1)', async () => {
    mockedKvGet.mockResolvedValue(null);

    await discoverAgents();
    // 4 agents = 4 KV lookups (one per agent for reputation)
    expect(mockedKvGet).toHaveBeenCalledTimes(4);
  });
});

describe('sendTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          jsonrpc: '2.0',
          id: 'req-1',
          result: { id: 'task-1', status: 'submitted', messages: [], artifacts: [] },
        }),
      })
    );
  });

  it('makes correct HTTP POST with JSON-RPC format', async () => {
    const task = await sendTask('http://localhost:3000/api/agents/reviewer/a2a', {
      description: 'Review this code',
      capability: 'review_code',
      offeredPayment: 5,
      requesterId: 'researcher',
    });

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/agents/reviewer/a2a', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('"method":"tasks/send"'),
    });
    expect(task.status).toBe('submitted');
  });

  it('parses successful response', async () => {
    const task = await sendTask('http://localhost:3000/api/agents/reviewer/a2a', {
      description: 'Review code',
      capability: 'review_code',
      offeredPayment: 5,
      requesterId: 'researcher',
    });

    expect(task.id).toBe('task-1');
    expect(task.status).toBe('submitted');
  });

  it('handles JSON-RPC error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          jsonrpc: '2.0',
          id: 'req-1',
          error: { code: -32602, message: 'Invalid params' },
        }),
      })
    );

    await expect(
      sendTask('http://localhost:3000/api/agents/reviewer/a2a', {
        description: '',
        capability: '',
        offeredPayment: 0,
        requesterId: '',
      })
    ).rejects.toThrow('A2A error');
  });
});

describe('getTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          jsonrpc: '2.0',
          id: 'req-1',
          result: { id: 'task-1', status: 'completed', messages: [], artifacts: [] },
        }),
      })
    );
  });

  it('retrieves task by ID', async () => {
    const task = await getTask('http://localhost:3000/api/agents/reviewer/a2a', 'task-1');
    expect(task.id).toBe('task-1');
    expect(task.status).toBe('completed');
  });
});
