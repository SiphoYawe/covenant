import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CivicLayer, CivicSeverity } from '@/lib/civic/types';
import type { CivicFlag } from '@/lib/civic/types';
import { computePenalty } from '@/lib/civic/reputation-bridge';

// Mock KV
const mockLrange = vi.fn().mockResolvedValue([]);
vi.mock('@/lib/storage/kv', () => ({
  kvLpush: vi.fn(),
  kvLrange: (...args: unknown[]) => mockLrange(...args),
}));

// Mock event bus (required by threat-handler import chain)
vi.mock('@/lib/events', () => ({
  createEventBus: () => ({ emit: vi.fn().mockResolvedValue({}), since: vi.fn() }),
  Protocol: { Civic: 'civic' },
  EVENT_TYPES: { CIVIC_RESOLVED: 'civic:resolved' },
}));

function makeFlag(severity: CivicSeverity, id?: string): CivicFlag {
  return {
    id: id || crypto.randomUUID(),
    agentId: 'malicious',
    timestamp: Date.now(),
    severity,
    layer: CivicLayer.Behavioral,
    attackType: 'prompt_injection',
    evidence: 'test',
  };
}

describe('Reputation Bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('computePenalty (pure)', () => {
    it('returns 0 for agent with no flags', () => {
      expect(computePenalty([])).toBe(0);
    });

    it('returns -3.0 for agent with 1 Critical flag', () => {
      expect(computePenalty([makeFlag(CivicSeverity.Critical)])).toBe(-3.0);
    });

    it('returns -2.0 for agent with 1 High flag', () => {
      expect(computePenalty([makeFlag(CivicSeverity.High)])).toBe(-2.0);
    });

    it('returns -1.0 for agent with 1 Medium flag', () => {
      expect(computePenalty([makeFlag(CivicSeverity.Medium)])).toBe(-1.0);
    });

    it('returns -0.5 for agent with 1 Low flag', () => {
      expect(computePenalty([makeFlag(CivicSeverity.Low)])).toBe(-0.5);
    });

    it('aggregates mixed flags correctly', () => {
      const flags = [
        makeFlag(CivicSeverity.Critical),  // -3.0
        makeFlag(CivicSeverity.High),      // -2.0
        makeFlag(CivicSeverity.Medium),    // -1.0
        makeFlag(CivicSeverity.Low),       // -0.5
      ];
      expect(computePenalty(flags)).toBe(-6.5);
    });

    it('stacks multiple flags of same severity', () => {
      const flags = [
        makeFlag(CivicSeverity.High),  // -2.0
        makeFlag(CivicSeverity.High),  // -2.0
      ];
      expect(computePenalty(flags)).toBe(-4.0);
    });
  });

  describe('getCivicPenalty (async)', () => {
    it('returns 0 for agent with no flags', async () => {
      mockLrange.mockResolvedValue([]);

      const { getCivicPenalty } = await import('@/lib/civic/reputation-bridge');
      const penalty = await getCivicPenalty('researcher');

      expect(penalty).toBe(0);
    });

    it('returns correct penalty for agent with stored flags', async () => {
      mockLrange.mockResolvedValue([
        JSON.stringify(makeFlag(CivicSeverity.Critical)),
        JSON.stringify(makeFlag(CivicSeverity.Medium)),
      ]);

      const { getCivicPenalty } = await import('@/lib/civic/reputation-bridge');
      const penalty = await getCivicPenalty('malicious');

      expect(penalty).toBe(-4.0); // -3.0 + -1.0
    });
  });
});
