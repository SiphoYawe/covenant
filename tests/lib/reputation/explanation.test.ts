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

// Mock Claude client
const mockCreate = vi.fn();
vi.mock('@/lib/ai/client', () => ({
  getClaudeClient: () => ({
    messages: { create: mockCreate },
  }),
}));

// Mock IPFS
const mockPin = vi.fn();
vi.mock('@/lib/storage/ipfs', () => ({
  pin: (...args: unknown[]) => mockPin(...args),
}));

import {
  generateExplanation,
  storeExplanation,
  cacheReputationWithExplanation,
  generateAndStoreExplanation,
  retryDeferredPinning,
} from '@/lib/reputation/explanation';
import type { ExplanationInput, AgentReputationCache } from '@/lib/reputation/types';

function makeExplanationInput(overrides: Partial<ExplanationInput> = {}): ExplanationInput {
  return {
    agentId: 'agent-b',
    agentName: 'Agent B',
    agentRole: 'code-reviewer',
    score: 8.5,
    classification: 'trusted',
    jobCount: 2,
    successRate: 1.0,
    failureRate: 0.0,
    paymentVolume: 11.0,
    civicFlags: [],
    trustGraphPosition: { inboundTrust: 0.8, outboundTrust: 0.6 },
    sybilAlerts: [],
    stakeWeightedAverage: 0.9,
    ...overrides,
  };
}

describe('Explanation Generation', () => {
  beforeEach(() => {
    kvStore.clear();
    vi.clearAllMocks();
  });

  describe('generateExplanation', () => {
    test('calls Claude with all signal types in prompt and returns text', async () => {
      const input = makeExplanationInput();
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Agent B: 8.5/10. 2 jobs completed with 100% success rate.' }],
      });

      const result = await generateExplanation(input);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('explanation is contextual (varies for honest vs malicious agent)', async () => {
      const honestInput = makeExplanationInput({ agentId: 'agent-b', score: 8.5, classification: 'trusted' });
      const maliciousInput = makeExplanationInput({
        agentId: 'agent-d',
        agentName: 'Agent D',
        score: 1.2,
        classification: 'adversarial',
        jobCount: 1,
        successRate: 0.0,
        failureRate: 1.0,
        civicFlags: [{ severity: 'Critical', attackType: 'prompt_injection', evidence: 'Detected in output' }],
      });

      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Agent B: 8.5/10. Trusted code reviewer with 100% success rate.' }],
      });
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Agent D: 1.2/10. 1 job, 100% rejection rate, Civic flagged for prompt injection.' }],
      });

      const honest = await generateExplanation(honestInput);
      const malicious = await generateExplanation(maliciousInput);

      expect(honest).not.toBe(malicious);
    });

    test('prompt includes all signal types', async () => {
      const input = makeExplanationInput({
        civicFlags: [{ severity: 'Critical', attackType: 'prompt_injection', evidence: 'test' }],
        sybilAlerts: [
          { id: 'a', patternType: 'adversarial_behavior', involvedAgents: ['agent-b'], confidence: 0.9, evidence: 'test', timestamp: 1 },
        ],
      });

      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'explanation' }],
      });

      await generateExplanation(input);

      const callArgs = mockCreate.mock.calls[0][0];
      const messages = JSON.stringify(callArgs.messages);
      expect(messages).toContain('Agent B');
      expect(messages).toContain('code-reviewer');
      expect(messages).toContain('prompt_injection');
      expect(messages).toContain('adversarial_behavior');
    });
  });

  describe('storeExplanation', () => {
    test('pins to IPFS and returns a valid CID', async () => {
      mockPin.mockResolvedValueOnce('bafybeig12345');

      const result = await storeExplanation('agent-b', 'Explanation text');

      expect(result.cid).toBe('bafybeig12345');
      expect(result.storedInKV).toBe(false);
      expect(mockPin).toHaveBeenCalledTimes(1);
    });

    test('graceful degradation: when Pinata fails, stores in KV with retry flag', async () => {
      mockPin.mockRejectedValueOnce(new Error('Pinata unavailable'));

      const result = await storeExplanation('agent-b', 'Explanation text');

      expect(result.cid).toBeNull();
      expect(result.storedInKV).toBe(true);
    });
  });

  describe('cacheReputationWithExplanation', () => {
    test('writes correct structure to KV', async () => {
      const { kv } = await import('@vercel/kv');

      await cacheReputationWithExplanation('agent-b', 8.5, 'bafybeig12345', null, false);

      expect(kv.set).toHaveBeenCalled();
      const setCall = vi.mocked(kv.set).mock.calls.find((c) => c[0] === 'agent:agent-b:reputation');
      expect(setCall).toBeDefined();
      const cached = setCall![1] as AgentReputationCache;
      expect(cached.score).toBe(8.5);
      expect(cached.explanationCID).toBe('bafybeig12345');
      expect(cached.retryPinning).toBe(false);
    });
  });

  describe('generateAndStoreExplanation', () => {
    test('orchestrates full pipeline (generate -> store -> cache -> event)', async () => {
      const { kv } = await import('@vercel/kv');
      const input = makeExplanationInput();

      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Agent B is a trusted agent.' }],
      });
      mockPin.mockResolvedValueOnce('bafybeig67890');

      const result = await generateAndStoreExplanation(input);

      expect(result.agentId).toBe('agent-b');
      expect(result.explanation).toBe('Agent B is a trusted agent.');
      expect(result.cid).toBe('bafybeig67890');
      expect(result.storedInKV).toBe(false);
      expect(result.retryPinning).toBe(false);
      expect(result.generatedAt).toBeGreaterThan(0);

      // Event should have been emitted via kv.zadd
      expect(kv.zadd).toHaveBeenCalled();
    });

    test('handles Pinata failure gracefully in full pipeline', async () => {
      const input = makeExplanationInput();

      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Agent B explanation.' }],
      });
      mockPin.mockRejectedValueOnce(new Error('Pinata down'));

      const result = await generateAndStoreExplanation(input);

      expect(result.cid).toBeNull();
      expect(result.retryPinning).toBe(true);
      expect(result.explanation).toBe('Agent B explanation.');
    });
  });

  describe('retryDeferredPinning', () => {
    test('succeeds when Pinata recovers', async () => {
      kvStore.set('agent:agent-b:reputation', {
        score: 8.5,
        explanationCID: null,
        explanationText: 'Agent B explanation text',
        retryPinning: true,
        updatedAt: Date.now(),
      } satisfies AgentReputationCache);

      mockPin.mockResolvedValueOnce('bafybeigrecovered');

      const result = await retryDeferredPinning('agent-b');

      expect(result.success).toBe(true);
      expect(result.cid).toBe('bafybeigrecovered');
    });

    test('no-ops when no deferred explanation exists', async () => {
      const result = await retryDeferredPinning('agent-unknown');

      expect(result.success).toBe(false);
      expect(result.cid).toBeNull();
    });

    test('no-ops when retryPinning is false', async () => {
      kvStore.set('agent:agent-b:reputation', {
        score: 8.5,
        explanationCID: 'bafyexisting',
        explanationText: null,
        retryPinning: false,
        updatedAt: Date.now(),
      } satisfies AgentReputationCache);

      const result = await retryDeferredPinning('agent-b');

      expect(result.success).toBe(false);
      expect(result.cid).toBeNull();
    });
  });
});
