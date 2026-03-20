import { describe, it, expect, vi, beforeEach } from 'vitest';
import { discoverAgents } from '@/lib/protocols/a2a/client';

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
