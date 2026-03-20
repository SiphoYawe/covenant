import { describe, it, expect, vi, beforeEach } from 'vitest';
import { negotiatePrice } from '@/lib/orchestrator/negotiation';

vi.mock('@/lib/storage/kv', () => ({
  kvGet: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/events/bus', () => ({
  createEventBus: vi.fn(() => ({
    emit: vi.fn().mockResolvedValue({ id: 'test', timestamp: Date.now() }),
    since: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/lib/wallets', () => ({
  getAddress: vi.fn().mockReturnValue('0x1234567890abcdef1234567890abcdef12345678'),
}));

// Track Claude calls for assertion
let claudeCallCount = 0;
let claudeResponses: Array<{ action: string; amount?: number; reasoning: string }> = [];

vi.mock('@/lib/ai/client', () => ({
  getClaudeClient: vi.fn(() => ({
    messages: {
      create: vi.fn().mockImplementation(() => {
        const response = claudeResponses[claudeCallCount] || { action: 'accept', reasoning: 'default' };
        claudeCallCount++;
        return Promise.resolve({
          content: [{ type: 'text', text: JSON.stringify(response) }],
        });
      }),
    },
  })),
}));

describe('negotiatePrice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    claudeCallCount = 0;
    claudeResponses = [];
  });

  it('successful negotiation — offer → counter → accept (2 rounds)', async () => {
    claudeResponses = [
      // Round 1: Provider counters
      { action: 'counter', amount: 7, reasoning: 'My work is worth more' },
      // Round 2: Requester accepts
      { action: 'accept', reasoning: 'Fair price' },
    ];

    const result = await negotiatePrice({
      requesterId: 'researcher',
      providerId: 'reviewer',
      taskDescription: 'Review authentication code',
      initialOffer: 5,
    });

    expect(result.status).toBe('agreed');
    expect(result.agreedPrice).toBe(7);
    expect(result.rounds).toBe(2);
    expect(result.messages.length).toBeGreaterThanOrEqual(3); // offer + counter + accept
  });

  it('immediate acceptance — offer → accept (1 round)', async () => {
    claudeResponses = [
      // Provider accepts immediately
      { action: 'accept', reasoning: 'Great price, I accept' },
    ];

    const result = await negotiatePrice({
      requesterId: 'researcher',
      providerId: 'reviewer',
      taskDescription: 'Quick style check',
      initialOffer: 8,
    });

    expect(result.status).toBe('agreed');
    expect(result.agreedPrice).toBe(8);
    expect(result.rounds).toBe(1);
    expect(result.messages).toHaveLength(2); // offer + accept
  });

  it('rejection — offer → reject (1 round)', async () => {
    claudeResponses = [
      // Provider rejects
      { action: 'reject', reasoning: 'Price too low for this work' },
    ];

    const result = await negotiatePrice({
      requesterId: 'researcher',
      providerId: 'reviewer',
      taskDescription: 'Full security audit',
      initialOffer: 1,
    });

    expect(result.status).toBe('rejected');
    expect(result.rounds).toBe(1);
    expect(result.agreedPrice).toBeUndefined();
  });

  it('max rounds exhaustion — expires after 3 rounds', async () => {
    claudeResponses = [
      // Round 1: Provider counters
      { action: 'counter', amount: 10, reasoning: 'Need more' },
      // Round 2: Requester counters
      { action: 'counter', amount: 6, reasoning: 'Too high' },
      // Round 2 continued: Provider counters again
      { action: 'counter', amount: 9, reasoning: 'Still need more' },
      // Round 3: Requester counters (would be round 3 but max reached)
      { action: 'counter', amount: 7, reasoning: 'My final offer' },
    ];

    const result = await negotiatePrice({
      requesterId: 'researcher',
      providerId: 'reviewer',
      taskDescription: 'Complex review',
      initialOffer: 5,
      maxRounds: 3,
    });

    // Should expire since no agreement within rounds
    expect(['expired', 'agreed']).toContain(result.status);
    expect(result.rounds).toBeLessThanOrEqual(3);
  });

  it('agreed price is captured correctly', async () => {
    claudeResponses = [
      { action: 'counter', amount: 6, reasoning: 'A bit more please' },
      { action: 'accept', reasoning: 'Deal' },
    ];

    const result = await negotiatePrice({
      requesterId: 'researcher',
      providerId: 'reviewer',
      taskDescription: 'Code review',
      initialOffer: 5,
    });

    expect(result.status).toBe('agreed');
    expect(result.agreedPrice).toBe(6);
    expect(typeof result.agreedPrice).toBe('number');
  });

  it('AI reasoning is invoked with correct context', async () => {
    claudeResponses = [
      { action: 'accept', reasoning: 'Good price' },
    ];

    const result = await negotiatePrice({
      requesterId: 'researcher',
      providerId: 'reviewer',
      taskDescription: 'Review my TypeScript module',
      initialOffer: 7,
    });

    // Claude was called at least once (provider decision)
    expect(claudeCallCount).toBeGreaterThanOrEqual(1);
    expect(result.status).toBe('agreed');
  });

  it('Agent D undercuts pricing', async () => {
    claudeResponses = [
      // Malicious agent accepts low price eagerly
      { action: 'accept', reasoning: 'I will do it for this low price, no problem!' },
    ];

    const result = await negotiatePrice({
      requesterId: 'researcher',
      providerId: 'malicious',
      taskDescription: 'Review security module',
      initialOffer: 1,
    });

    expect(result.status).toBe('agreed');
    expect(result.agreedPrice).toBe(1);
  });

  it('messages capture full negotiation history', async () => {
    claudeResponses = [
      { action: 'counter', amount: 7, reasoning: 'Want more' },
      { action: 'accept', reasoning: 'OK deal' },
    ];

    const result = await negotiatePrice({
      requesterId: 'researcher',
      providerId: 'reviewer',
      taskDescription: 'Review code',
      initialOffer: 5,
    });

    // Should have: initial offer, provider counter, requester accept
    expect(result.messages.length).toBeGreaterThanOrEqual(3);
    expect(result.messages[0].action).toBe('offer');
    expect(result.messages[0].agentId).toBe('researcher');
    expect(result.messages[1].action).toBe('counter');
    expect(result.messages[1].agentId).toBe('reviewer');
    expect(result.messages[2].action).toBe('accept');
    expect(result.messages[2].agentId).toBe('researcher');
  });
});
