import { describe, test, expect } from 'vitest';
import {
  computeTrustPropagation,
  getTrustScore,
  getAgentTrustScores,
  getGlobalTrustRanking,
} from '@/lib/reputation/trust-propagation';
import type { PaymentGraph, TrustPropagationResult } from '@/lib/reputation/types';

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

describe('Trust Propagation (PageRank-style)', () => {
  describe('edge cases', () => {
    test('empty graph returns empty trust matrix, 0 iterations, converged = true', () => {
      const graph: PaymentGraph = { nodes: [], edges: [] };
      const result = computeTrustPropagation(graph);

      expect(result.trustMatrix.size).toBe(0);
      expect(result.iterations).toBe(0);
      expect(result.converged).toBe(true);
      expect(result.computeTimeMs).toBeGreaterThanOrEqual(0);
    });

    test('single agent with no edges returns identity trust', () => {
      const graph: PaymentGraph = {
        nodes: [{ id: 'agent-a', agentId: 'agent-a', role: '', label: 'A' }],
        edges: [],
      };
      const result = computeTrustPropagation(graph);

      expect(getTrustScore(result, 'agent-a', 'agent-a')).toBe(1.0);
      expect(result.iterations).toBe(0);
    });
  });

  describe('direct trust', () => {
    test('two agents with direct edge produces correct direct trust score', () => {
      const graph = makeGraph([
        { source: 'agent-a', target: 'agent-b', amount: '6.00' },
      ]);
      const result = computeTrustPropagation(graph);

      const trustAB = getTrustScore(result, 'agent-a', 'agent-b');
      expect(trustAB).toBeGreaterThan(0);
      expect(trustAB).toBeLessThanOrEqual(1.0);
    });
  });

  describe('transitive trust decay', () => {
    test('three agents A->B->C produces decayed transitive trust for A->C', () => {
      const graph = makeGraph([
        { source: 'agent-a', target: 'agent-b', amount: '6.00' },
        { source: 'agent-b', target: 'agent-c', amount: '5.00' },
      ]);
      const result = computeTrustPropagation(graph);

      const trustAB = getTrustScore(result, 'agent-a', 'agent-b');
      const trustBC = getTrustScore(result, 'agent-b', 'agent-c');
      const trustAC = getTrustScore(result, 'agent-a', 'agent-c');

      // A->C should be less than both A->B and B->C (decay)
      expect(trustAC).toBeLessThan(trustAB);
      expect(trustAC).toBeLessThan(trustBC);
      expect(trustAC).toBeGreaterThan(0);
    });

    test('trust decay is multiplicative: three-hop trust < two-hop trust', () => {
      const graph = makeGraph([
        { source: 'agent-a', target: 'agent-b', amount: '6.00' },
        { source: 'agent-b', target: 'agent-c', amount: '5.00' },
        { source: 'agent-c', target: 'agent-d', amount: '4.00' },
      ]);
      const result = computeTrustPropagation(graph);

      const twoHop = getTrustScore(result, 'agent-a', 'agent-c');
      const threeHop = getTrustScore(result, 'agent-a', 'agent-d');

      expect(threeHop).toBeLessThan(twoHop);
    });
  });

  describe('convergence', () => {
    test('algorithm converges within 5 iterations for demo graph', () => {
      const graph = makeGraph([
        { source: 'agent-a', target: 'agent-b', amount: '6.00' },
        { source: 'agent-a', target: 'agent-c', amount: '3.00' },
        { source: 'agent-b', target: 'agent-c', amount: '2.00' },
        { source: 'agent-a', target: 'agent-d', amount: '1.00', outcome: 'fail' },
      ]);
      const result = computeTrustPropagation(graph);

      expect(result.iterations).toBeLessThanOrEqual(5);
      expect(result.converged).toBe(true);
    });

    test('convergence detected when score delta < threshold (early termination)', () => {
      const graph = makeGraph([
        { source: 'agent-a', target: 'agent-b', amount: '6.00' },
      ]);
      const result = computeTrustPropagation(graph, { convergenceThreshold: 1.0 });

      // With a high threshold, should converge in 1 iteration
      expect(result.converged).toBe(true);
      expect(result.iterations).toBeLessThanOrEqual(2);
    });
  });

  describe('distrust propagation', () => {
    test('negative edge (failed transaction) reduces trust through that path', () => {
      const graph = makeGraph([
        { source: 'agent-a', target: 'agent-b', amount: '6.00', outcome: 'success' },
        { source: 'agent-a', target: 'agent-d', amount: '3.00', outcome: 'fail' },
      ]);
      const result = computeTrustPropagation(graph);

      const trustAB = getTrustScore(result, 'agent-a', 'agent-b');
      const trustAD = getTrustScore(result, 'agent-a', 'agent-d');

      expect(trustAD).toBeLessThan(trustAB);
    });

    test('Agent D with failed transaction has lower inferred trust than honest agents', () => {
      const graph = makeGraph([
        { source: 'agent-a', target: 'agent-b', amount: '6.00', outcome: 'success' },
        { source: 'agent-a', target: 'agent-c', amount: '3.00', outcome: 'success' },
        { source: 'agent-b', target: 'agent-c', amount: '2.00', outcome: 'success' },
        { source: 'agent-a', target: 'agent-d', amount: '1.00', outcome: 'fail' },
      ]);
      const result = computeTrustPropagation(graph);

      const ranking = getGlobalTrustRanking(result);
      const agentD = ranking.find((r) => r.agentId === 'agent-d');
      const agentB = ranking.find((r) => r.agentId === 'agent-b');

      expect(agentD).toBeDefined();
      expect(agentB).toBeDefined();
      expect(agentD!.avgTrust).toBeLessThan(agentB!.avgTrust);
    });

    test('distrust does not destroy trust of innocent intermediaries', () => {
      const graph = makeGraph([
        { source: 'agent-a', target: 'agent-b', amount: '6.00', outcome: 'success' },
        { source: 'agent-b', target: 'agent-d', amount: '2.00', outcome: 'fail' },
      ]);
      const result = computeTrustPropagation(graph);

      const trustAB = getTrustScore(result, 'agent-a', 'agent-b');
      // Agent B should still have decent trust from A despite B's bad interaction with D
      expect(trustAB).toBeGreaterThan(0.3);
    });
  });

  describe('determinism', () => {
    test('same graph input produces identical output on repeated runs', () => {
      const graph = makeGraph([
        { source: 'agent-a', target: 'agent-b', amount: '6.00' },
        { source: 'agent-b', target: 'agent-c', amount: '3.00' },
        { source: 'agent-a', target: 'agent-d', amount: '1.00', outcome: 'fail' },
      ]);

      const result1 = computeTrustPropagation(graph);
      const result2 = computeTrustPropagation(graph);

      expect(result1.iterations).toBe(result2.iterations);
      expect(result1.converged).toBe(result2.converged);

      // Compare all trust scores
      for (const [src, targets] of result1.trustMatrix) {
        for (const [tgt, score] of targets) {
          expect(getTrustScore(result2, src, tgt)).toBeCloseTo(score, 10);
        }
      }
    });
  });

  describe('disconnected agents', () => {
    test('disconnected agents have 0.0 trust score', () => {
      const graph: PaymentGraph = {
        nodes: [
          { id: 'agent-a', agentId: 'agent-a', role: '', label: 'A' },
          { id: 'agent-b', agentId: 'agent-b', role: '', label: 'B' },
          { id: 'agent-x', agentId: 'agent-x', role: '', label: 'X' },
        ],
        edges: [
          { id: 'e1', source: 'agent-a', target: 'agent-b', amount: '6.00', txHash: '0x1', outcome: 'success', timestamp: 1000 },
        ],
      };
      const result = computeTrustPropagation(graph);

      expect(getTrustScore(result, 'agent-a', 'agent-x')).toBe(0.0);
      expect(getTrustScore(result, 'agent-x', 'agent-a')).toBe(0.0);
    });
  });

  describe('query functions', () => {
    let result: TrustPropagationResult;

    beforeAll(() => {
      const graph = makeGraph([
        { source: 'agent-a', target: 'agent-b', amount: '6.00' },
        { source: 'agent-b', target: 'agent-c', amount: '3.00' },
      ]);
      result = computeTrustPropagation(graph);
    });

    test('getTrustScore returns correct pairwise value', () => {
      const score = getTrustScore(result, 'agent-a', 'agent-b');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    test('getTrustScore returns 0.0 for non-existent pair', () => {
      expect(getTrustScore(result, 'agent-a', 'agent-z')).toBe(0.0);
    });

    test('getAgentTrustScores returns all scores for an agent', () => {
      const scores = getAgentTrustScores(result, 'agent-a');
      expect(scores.size).toBeGreaterThan(0);
    });

    test('getGlobalTrustRanking returns agents sorted by average incoming trust', () => {
      const ranking = getGlobalTrustRanking(result);
      expect(ranking.length).toBeGreaterThan(0);

      // Should be sorted descending by avgTrust
      for (let i = 1; i < ranking.length; i++) {
        expect(ranking[i - 1].avgTrust).toBeGreaterThanOrEqual(ranking[i].avgTrust);
      }
    });
  });

  describe('performance', () => {
    test('computation completes in < 100ms for demo graph size', () => {
      const graph = makeGraph([
        { source: 'agent-a', target: 'agent-b', amount: '6.00' },
        { source: 'agent-a', target: 'agent-c', amount: '3.00' },
        { source: 'agent-b', target: 'agent-c', amount: '2.00' },
        { source: 'agent-a', target: 'agent-d', amount: '1.00', outcome: 'fail' },
        { source: 'agent-c', target: 'agent-b', amount: '1.50' },
      ]);
      const result = computeTrustPropagation(graph);

      expect(result.computeTimeMs).toBeLessThan(100);
    });
  });

  describe('custom config', () => {
    test('custom config overrides defaults correctly', () => {
      const graph = makeGraph([
        { source: 'agent-a', target: 'agent-b', amount: '6.00' },
        { source: 'agent-b', target: 'agent-c', amount: '3.00' },
      ]);

      const result = computeTrustPropagation(graph, {
        dampingFactor: 0.5,
        maxIterations: 2,
      });

      expect(result.iterations).toBeLessThanOrEqual(2);
    });
  });
});
