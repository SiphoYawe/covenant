import { describe, test, expect } from 'vitest';
import {
  ReputationScoreSchema,
  TrustEdgeSchema,
  PaymentGraphSchema,
  SybilAlertSchema,
  FeedbackEventSchema,
  ReputationComputeRequestSchema,
  ReputationComputeResultSchema,
} from '@/lib/reputation/types';

describe('Reputation Types - Zod Validation', () => {
  describe('ReputationScoreSchema', () => {
    test('validates a well-formed reputation score', () => {
      const valid = {
        agentId: 'agent-a',
        score: 8.5,
        confidence: 0.92,
        signalCount: 5,
        lastUpdated: Date.now(),
        explanationCid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oczesb4',
        contributingSignals: { stakeWeight: 0.7, trustPropagation: 0.2, civicFlags: 0.1 },
      };
      expect(ReputationScoreSchema.parse(valid)).toEqual(valid);
    });

    test('rejects score outside 0-10 range', () => {
      const invalid = {
        agentId: 'agent-a',
        score: 11,
        confidence: 0.5,
        signalCount: 1,
        lastUpdated: Date.now(),
      };
      expect(() => ReputationScoreSchema.parse(invalid)).toThrow();
    });

    test('rejects confidence outside 0-1 range', () => {
      const invalid = {
        agentId: 'agent-a',
        score: 5,
        confidence: 1.5,
        signalCount: 1,
        lastUpdated: Date.now(),
      };
      expect(() => ReputationScoreSchema.parse(invalid)).toThrow();
    });

    test('allows optional fields to be omitted', () => {
      const minimal = {
        agentId: 'agent-a',
        score: 5.0,
        confidence: 0.5,
        signalCount: 0,
        lastUpdated: Date.now(),
      };
      const result = ReputationScoreSchema.parse(minimal);
      expect(result.agentId).toBe('agent-a');
      expect(result.explanationCid).toBeUndefined();
    });
  });

  describe('TrustEdgeSchema', () => {
    test('validates a well-formed trust edge', () => {
      const valid = {
        id: 'edge-1',
        source: 'agent-a',
        target: 'agent-b',
        amount: '6.00',
        txHash: '0xabc123',
        outcome: 'success' as const,
        timestamp: Date.now(),
      };
      expect(TrustEdgeSchema.parse(valid)).toEqual(valid);
    });

    test('rejects invalid outcome', () => {
      const invalid = {
        id: 'edge-1',
        source: 'agent-a',
        target: 'agent-b',
        amount: '6.00',
        txHash: '0xabc',
        outcome: 'maybe',
        timestamp: Date.now(),
      };
      expect(() => TrustEdgeSchema.parse(invalid)).toThrow();
    });
  });

  describe('PaymentGraphSchema', () => {
    test('validates a graph with nodes and edges', () => {
      const valid = {
        nodes: [{ id: 'agent-a', agentId: 'agent-a', role: 'researcher', label: 'Agent A' }],
        edges: [
          {
            id: 'edge-1',
            source: 'agent-a',
            target: 'agent-b',
            amount: '6.00',
            txHash: '0xabc',
            outcome: 'success' as const,
            timestamp: Date.now(),
          },
        ],
      };
      expect(PaymentGraphSchema.parse(valid)).toEqual(valid);
    });

    test('accepts empty graph', () => {
      const empty = { nodes: [], edges: [] };
      expect(PaymentGraphSchema.parse(empty)).toEqual(empty);
    });
  });

  describe('SybilAlertSchema', () => {
    test('validates a well-formed sybil alert', () => {
      const valid = {
        id: 'alert-1',
        patternType: 'circular_payments' as const,
        involvedAgents: ['agent-a', 'agent-b'],
        confidence: 0.85,
        evidence: 'Circular payment pattern detected between agents',
        timestamp: Date.now(),
      };
      expect(SybilAlertSchema.parse(valid)).toEqual(valid);
    });

    test('rejects invalid pattern type', () => {
      const invalid = {
        id: 'alert-1',
        patternType: 'unknown_pattern',
        involvedAgents: [],
        confidence: 0.5,
        evidence: 'test',
        timestamp: Date.now(),
      };
      expect(() => SybilAlertSchema.parse(invalid)).toThrow();
    });

    test('rejects confidence outside 0-1 range', () => {
      const invalid = {
        id: 'alert-1',
        patternType: 'circular_payments',
        involvedAgents: ['a'],
        confidence: 2.0,
        evidence: 'test',
        timestamp: Date.now(),
      };
      expect(() => SybilAlertSchema.parse(invalid)).toThrow();
    });
  });

  describe('FeedbackEventSchema', () => {
    test('validates a feedback event', () => {
      const valid = {
        targetAgentId: 'agent-b',
        feedbackValue: 1,
        feedbackUri: 'ipfs://bafybeig...',
        proofOfPayment: '0xtxhash',
        sourceAgentId: 'agent-a',
        timestamp: Date.now(),
      };
      expect(FeedbackEventSchema.parse(valid)).toEqual(valid);
    });

    test('rejects missing required fields', () => {
      expect(() => FeedbackEventSchema.parse({})).toThrow();
    });
  });

  describe('ReputationComputeRequestSchema', () => {
    test('validates request with agentId', () => {
      const valid = { agentId: 'agent-a' };
      expect(ReputationComputeRequestSchema.parse(valid)).toEqual(valid);
    });

    test('validates request without agentId (recompute all)', () => {
      const valid = {};
      expect(ReputationComputeRequestSchema.parse(valid)).toEqual({});
    });
  });

  describe('ReputationComputeResultSchema', () => {
    test('validates a compute result', () => {
      const valid = {
        agentId: 'agent-a',
        status: 'computing' as const,
        pipelineStages: ['stake-weighting', 'graph', 'trust-propagation'],
        startedAt: Date.now(),
      };
      expect(ReputationComputeResultSchema.parse(valid)).toEqual(valid);
    });
  });
});
