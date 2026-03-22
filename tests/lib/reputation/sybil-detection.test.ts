import { describe, test, expect, vi, beforeEach } from 'vitest';
import { kvStore, zaddCalls, clearKvStore, createKvMock } from '../../helpers/kv-mock';

// Mock KV at the abstraction boundary
vi.mock('@/lib/storage/kv', () => createKvMock());

// Mock Claude client
const mockCreate = vi.fn();
vi.mock('@/lib/ai/client', () => ({
  getClaudeClient: () => ({
    messages: { create: mockCreate },
  }),
}));

import {
  extractCircularPayments,
  extractUniformFeedback,
  extractTransactionPadding,
  extractRapidRepeats,
  analyzePatternsWithAI,
  detectSybilPatterns,
  storeSybilAlerts,
  getSybilAlerts,
  getSybilAlertsForAgent,
} from '@/lib/reputation/sybil-detection';
import type {
  PaymentGraph,
  TransactionRecord,
  SybilDetectionInput,
  AgentContext,
  ExtractedPatterns,
} from '@/lib/reputation/types';

function makeGraph(
  edges: Array<{ source: string; target: string; amount: string; outcome?: 'success' | 'fail' }>
): PaymentGraph {
  const nodeIds = new Set<string>();
  for (const e of edges) {
    nodeIds.add(e.source);
    nodeIds.add(e.target);
  }
  return {
    nodes: [...nodeIds].sort().map((id) => ({ id, agentId: id, role: '', label: id })),
    edges: edges.map((e, i) => ({
      id: `e${i}`,
      source: e.source,
      target: e.target,
      amount: e.amount,
      txHash: `0x${i}`,
      outcome: e.outcome ?? 'success',
      timestamp: 1000 + i,
    })),
  };
}

function makeTxRecord(from: string, to: string, amount: number, timestamp: number, feedbackValue = 1): TransactionRecord {
  return { from, to, amount, timestamp, txHash: `0x${Math.random().toString(16).slice(2, 10)}`, feedbackValue };
}

describe('Sybil Detection', () => {
  beforeEach(() => {
    clearKvStore();
    vi.clearAllMocks();
  });

  describe('extractCircularPayments', () => {
    test('finds A->B->C->A cycle in graph', () => {
      const graph = makeGraph([
        { source: 'agent-a', target: 'agent-b', amount: '5.00' },
        { source: 'agent-b', target: 'agent-c', amount: '5.00' },
        { source: 'agent-c', target: 'agent-a', amount: '5.00' },
      ]);

      const cycles = extractCircularPayments(graph);

      expect(cycles.length).toBeGreaterThan(0);
      // The cycle should contain all three agents
      const allAgents = cycles.flatMap((c) => c.cycle);
      expect(allAgents).toContain('agent-a');
      expect(allAgents).toContain('agent-b');
      expect(allAgents).toContain('agent-c');
    });

    test('returns empty for acyclic graph', () => {
      const graph = makeGraph([
        { source: 'agent-a', target: 'agent-b', amount: '5.00' },
        { source: 'agent-b', target: 'agent-c', amount: '3.00' },
      ]);

      const cycles = extractCircularPayments(graph);
      expect(cycles).toEqual([]);
    });

    test('returns empty for empty graph', () => {
      const graph: PaymentGraph = { nodes: [], edges: [] };
      const cycles = extractCircularPayments(graph);
      expect(cycles).toEqual([]);
    });
  });

  describe('extractUniformFeedback', () => {
    test('detects all-identical feedback scores for an agent', () => {
      const history: TransactionRecord[] = [
        makeTxRecord('x', 'agent-b', 5, 1000, 1),
        makeTxRecord('y', 'agent-b', 5, 2000, 1),
        makeTxRecord('z', 'agent-b', 5, 3000, 1),
        makeTxRecord('w', 'agent-b', 5, 4000, 1),
        makeTxRecord('v', 'agent-b', 5, 5000, 1),
      ];

      const results = extractUniformFeedback(history);
      const agentB = results.find((r) => r.agentId === 'agent-b');

      expect(agentB).toBeDefined();
      expect(agentB!.variance).toBe(0);
    });

    test('ignores agents with varied feedback', () => {
      const history: TransactionRecord[] = [
        makeTxRecord('x', 'agent-b', 5, 1000, 1),
        makeTxRecord('y', 'agent-b', 5, 2000, -1),
        makeTxRecord('z', 'agent-b', 5, 3000, 1),
      ];

      const results = extractUniformFeedback(history);
      // agent-b has varied feedback so should not appear (or have non-zero variance)
      const agentB = results.find((r) => r.agentId === 'agent-b');
      if (agentB) {
        expect(agentB.variance).toBeGreaterThan(0);
      }
    });
  });

  describe('extractTransactionPadding', () => {
    test('detects many tiny (<0.10 USDC) transactions', () => {
      const history: TransactionRecord[] = [
        makeTxRecord('x', 'agent-b', 0.01, 1000),
        makeTxRecord('y', 'agent-b', 0.02, 2000),
        makeTxRecord('z', 'agent-b', 0.01, 3000),
        makeTxRecord('w', 'agent-b', 0.05, 4000),
        makeTxRecord('v', 'agent-b', 0.03, 5000),
        makeTxRecord('u', 'agent-b', 0.01, 6000),
      ];

      const results = extractTransactionPadding(history);
      const agentB = results.find((r) => r.agentId === 'agent-b');

      expect(agentB).toBeDefined();
      expect(agentB!.tinyTxCount).toBeGreaterThanOrEqual(5);
    });

    test('ignores normal transaction sizes', () => {
      const history: TransactionRecord[] = [
        makeTxRecord('x', 'agent-b', 5.00, 1000),
        makeTxRecord('y', 'agent-b', 3.00, 2000),
        makeTxRecord('z', 'agent-b', 6.00, 3000),
      ];

      const results = extractTransactionPadding(history);
      expect(results).toEqual([]);
    });
  });

  describe('extractRapidRepeats', () => {
    test('detects >3 transactions between same pair within 60s', () => {
      const baseTime = 100000;
      const history: TransactionRecord[] = [
        makeTxRecord('agent-a', 'agent-b', 1, baseTime),
        makeTxRecord('agent-a', 'agent-b', 1, baseTime + 10000),
        makeTxRecord('agent-a', 'agent-b', 1, baseTime + 20000),
        makeTxRecord('agent-a', 'agent-b', 1, baseTime + 30000),
      ];

      const results = extractRapidRepeats(history);

      expect(results.length).toBeGreaterThan(0);
      const pair = results.find(
        (r) =>
          (r.pair[0] === 'agent-a' && r.pair[1] === 'agent-b') ||
          (r.pair[0] === 'agent-b' && r.pair[1] === 'agent-a')
      );
      expect(pair).toBeDefined();
      expect(pair!.count).toBeGreaterThanOrEqual(4);
    });

    test('ignores normal transaction frequency', () => {
      const history: TransactionRecord[] = [
        makeTxRecord('agent-a', 'agent-b', 5, 100000),
        makeTxRecord('agent-a', 'agent-b', 3, 300000), // 200s apart
        makeTxRecord('agent-a', 'agent-b', 6, 600000), // 300s apart
      ];

      const results = extractRapidRepeats(history);
      expect(results).toEqual([]);
    });
  });

  describe('analyzePatternsWithAI', () => {
    test('calls Claude with correct prompt structure', async () => {
      const patterns: ExtractedPatterns = {
        circularPayments: [{ cycle: ['agent-a', 'agent-b', 'agent-c'], edgeCount: 3 }],
        uniformFeedback: [],
        transactionPadding: [],
        rapidRepeats: [],
      };
      const agentContexts: AgentContext[] = [];

      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ alerts: [] }) }],
      });

      await analyzePatternsWithAI(patterns, agentContexts);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.model).toBeDefined();
      expect(callArgs.messages).toBeDefined();
    });

    test('classifies Agent D (paid, failed, Civic-flagged) as adversarial, not Sybil', async () => {
      const patterns: ExtractedPatterns = {
        circularPayments: [],
        uniformFeedback: [],
        transactionPadding: [],
        rapidRepeats: [],
      };
      const agentContexts: AgentContext[] = [
        {
          agentId: 'agent-d',
          civicFlags: [{ severity: 'Critical', attackType: 'prompt_injection', evidence: 'Prompt injection detected in deliverable' }],
          feedbackHistory: [{ value: -1, outcome: 'fail' }],
        },
      ];

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              alerts: [
                {
                  patternType: 'adversarial_behavior',
                  involvedAgents: ['agent-d'],
                  confidence: 0.95,
                  evidence: 'Civic flagged for prompt injection, payment failed',
                },
              ],
            }),
          },
        ],
      });

      const alerts = await analyzePatternsWithAI(patterns, agentContexts);

      expect(alerts.length).toBeGreaterThan(0);
      const dAlert = alerts.find((a) => a.involvedAgents.includes('agent-d'));
      expect(dAlert).toBeDefined();
      expect(dAlert!.patternType).toBe('adversarial_behavior');
    });

    test('classifies circular payment ring as Sybil with high confidence', async () => {
      const patterns: ExtractedPatterns = {
        circularPayments: [{ cycle: ['agent-x', 'agent-y', 'agent-z'], edgeCount: 3 }],
        uniformFeedback: [],
        transactionPadding: [],
        rapidRepeats: [],
      };

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              alerts: [
                {
                  patternType: 'circular_payments',
                  involvedAgents: ['agent-x', 'agent-y', 'agent-z'],
                  confidence: 0.85,
                  evidence: 'Circular payment ring detected',
                },
              ],
            }),
          },
        ],
      });

      const alerts = await analyzePatternsWithAI(patterns, []);

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].patternType).toBe('circular_payments');
      expect(alerts[0].confidence).toBeGreaterThanOrEqual(0.8);
    });

    test('handles Claude API failure gracefully', async () => {
      const patterns: ExtractedPatterns = {
        circularPayments: [{ cycle: ['a', 'b', 'c'], edgeCount: 3 }],
        uniformFeedback: [],
        transactionPadding: [],
        rapidRepeats: [],
      };

      mockCreate.mockRejectedValueOnce(new Error('API error'));
      mockCreate.mockRejectedValueOnce(new Error('API error retry'));

      const alerts = await analyzePatternsWithAI(patterns, []);
      expect(alerts).toEqual([]);
    });
  });

  describe('detectSybilPatterns', () => {
    test('orchestrates full pipeline (extraction -> AI -> alerts)', async () => {
      const graph = makeGraph([
        { source: 'agent-a', target: 'agent-b', amount: '5.00' },
        { source: 'agent-b', target: 'agent-c', amount: '5.00' },
        { source: 'agent-c', target: 'agent-a', amount: '5.00' },
      ]);

      const input: SybilDetectionInput = {
        graph,
        transactionHistory: [
          makeTxRecord('agent-a', 'agent-b', 5, 1000),
          makeTxRecord('agent-b', 'agent-c', 5, 2000),
          makeTxRecord('agent-c', 'agent-a', 5, 3000),
        ],
        agentIds: ['agent-a', 'agent-b', 'agent-c'],
      };

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              alerts: [
                {
                  patternType: 'circular_payments',
                  involvedAgents: ['agent-a', 'agent-b', 'agent-c'],
                  confidence: 0.9,
                  evidence: 'Circular payment ring',
                },
              ],
            }),
          },
        ],
      });

      const result = await detectSybilPatterns(input);

      expect(result.alerts.length).toBeGreaterThan(0);
      expect(result.analysisTimestamp).toBeGreaterThan(0);
      expect(mockCreate).toHaveBeenCalled();
    });

    test('returns early when no patterns found', async () => {
      const graph = makeGraph([
        { source: 'agent-a', target: 'agent-b', amount: '5.00' },
      ]);

      const input: SybilDetectionInput = {
        graph,
        transactionHistory: [makeTxRecord('agent-a', 'agent-b', 5, 1000)],
        agentIds: ['agent-a', 'agent-b'],
      };

      const result = await detectSybilPatterns(input);

      expect(result.alerts).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('storeSybilAlerts', () => {
    test('writes to KV at correct keys', async () => {
      const alerts = [
        {
          id: 'alert-1',
          patternType: 'adversarial_behavior' as const,
          involvedAgents: ['agent-d'],
          confidence: 0.95,
          evidence: 'Prompt injection',
          timestamp: Date.now(),
        },
      ];

      await storeSybilAlerts(alerts);

      const { kvSet } = await import('@/lib/storage/kv');
      expect(kvSet).toHaveBeenCalled();
    });

    test('emits reputation:sybil-alert event per alert', async () => {
      const alerts = [
        {
          id: 'alert-1',
          patternType: 'adversarial_behavior' as const,
          involvedAgents: ['agent-d'],
          confidence: 0.95,
          evidence: 'Prompt injection',
          timestamp: Date.now(),
        },
      ];

      await storeSybilAlerts(alerts);

      // Event bus uses kv.zadd
      expect(zaddCalls.length).toBeGreaterThan(0);
    });
  });

  describe('getSybilAlerts', () => {
    test('reads all alerts from KV', async () => {
      const alerts = [
        {
          id: 'alert-1',
          patternType: 'circular_payments' as const,
          involvedAgents: ['a', 'b'],
          confidence: 0.8,
          evidence: 'test',
          timestamp: 1000,
        },
      ];
      kvStore.set('sybil:alerts', { value: alerts });

      const result = await getSybilAlerts();
      expect(result).toEqual(alerts);
    });
  });

  describe('getSybilAlertsForAgent', () => {
    test('returns only alerts involving that agent', async () => {
      const alerts = [
        {
          id: 'alert-1',
          patternType: 'circular_payments' as const,
          involvedAgents: ['agent-a', 'agent-b'],
          confidence: 0.8,
          evidence: 'test',
          timestamp: 1000,
        },
        {
          id: 'alert-2',
          patternType: 'adversarial_behavior' as const,
          involvedAgents: ['agent-d'],
          confidence: 0.95,
          evidence: 'test',
          timestamp: 2000,
        },
      ];
      kvStore.set('sybil:alerts', { value: alerts });

      const result = await getSybilAlertsForAgent('agent-d');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('alert-2');
    });
  });
});
