import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateAgentCard, getAgentCard } from '@/lib/protocols/a2a/agent-card';
import type { DemoAgentRole } from '@/lib/agents/types';

vi.mock('@/lib/storage/kv', () => ({
  kvGet: vi.fn(),
}));

// Mock wallet module
vi.mock('@/lib/wallets', () => ({
  getAddress: vi.fn().mockReturnValue('0x1234567890abcdef1234567890abcdef12345678'),
}));

import { kvGet } from '@/lib/storage/kv';

const mockedKvGet = vi.mocked(kvGet);

describe('generateAgentCard', () => {
  it('produces valid A2A-compliant card for researcher', () => {
    const card = generateAgentCard('researcher');
    expect(card.name).toBe('Covenant Researcher');
    expect(card.url).toContain('/api/agents/researcher/a2a');
    expect(card.skills).toHaveLength(3);
    expect(card.skills.map((s) => s.id)).toEqual(['research_topic', 'evaluate_deliverable', 'hire_agent']);
  });

  it('produces valid A2A-compliant card for reviewer', () => {
    const card = generateAgentCard('reviewer');
    expect(card.name).toBe('CodeGuard');
    expect(card.skills).toHaveLength(3);
    expect(card.skills.map((s) => s.id)).toEqual(['review_code', 'analyze_diff', 'check_style']);
  });

  it('produces valid A2A-compliant card for summarizer', () => {
    const card = generateAgentCard('summarizer');
    expect(card.name).toBe('SynthAI');
    expect(card.skills).toHaveLength(3);
    expect(card.skills.map((s) => s.id)).toEqual(['summarize_text', 'extract_key_points', 'generate_tldr']);
  });

  it('includes all required fields', () => {
    const card = generateAgentCard('reviewer', { erc8004AgentId: '0xabc' });
    expect(card).toHaveProperty('name');
    expect(card).toHaveProperty('description');
    expect(card).toHaveProperty('url');
    expect(card).toHaveProperty('skills');
    expect(card.erc8004AgentId).toBe('0xabc');
    expect(card.pricingHints).toBeDefined();
  });

  it('includes reputation score when provided via options', () => {
    const card = generateAgentCard('reviewer', { reputationScore: 8.5 });
    expect(card.reputationScore).toBe(8.5);
  });

  it('malicious agent card looks identical in structure to honest agents', () => {
    const honest = generateAgentCard('reviewer');
    const malicious = generateAgentCard('malicious');

    // Both have same structure
    expect(Object.keys(malicious).sort()).toEqual(Object.keys(honest).sort());

    // Malicious advertises review_code — same as honest reviewer
    expect(malicious.skills.some((s) => s.id === 'review_code')).toBe(true);

    // Has pricing hints like honest agent
    expect(malicious.pricingHints).toBeDefined();
  });
});

describe('getAgentCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enriches card with reputation from KV when available', async () => {
    mockedKvGet.mockResolvedValueOnce({ score: 9.2, explanation: 'Excellent agent' });

    const card = await getAgentCard('reviewer');
    expect(card.reputationScore).toBe(9.2);
    expect(mockedKvGet).toHaveBeenCalledWith('agent:reviewer:reputation');
  });

  it('returns card without score when KV has no data', async () => {
    mockedKvGet.mockResolvedValueOnce(null);

    const card = await getAgentCard('researcher');
    expect(card.reputationScore).toBeUndefined();
  });

  it('returns valid card for all roles', async () => {
    mockedKvGet.mockResolvedValue(null);

    const roles: DemoAgentRole[] = ['researcher', 'reviewer', 'summarizer', 'malicious'];
    for (const role of roles) {
      const card = await getAgentCard(role);
      expect(card.name).toBeTruthy();
      expect(card.url).toContain(role);
      expect(card.skills.length).toBeGreaterThan(0);
    }
  });
});
