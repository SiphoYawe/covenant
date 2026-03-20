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

import {
  buildGraph,
  getGraph,
  saveGraph,
  addTransaction,
  getNodeEdges,
  getEdgesBetween,
  getAgentNode,
} from '@/lib/reputation/graph';
import type { PaymentGraph } from '@/lib/reputation/types';
import type { PaymentProof } from '@/lib/protocols/x402/types';

function makeProof(
  counterpartyAgentId: string,
  amount: string,
  txHash: string,
  direction: 'outgoing' | 'incoming' = 'outgoing'
): PaymentProof {
  return {
    txHash,
    counterpartyAgentId,
    amount,
    timestamp: Date.now(),
    direction,
  };
}

describe('Payment Graph Construction', () => {
  beforeEach(() => {
    kvStore.clear();
    vi.clearAllMocks();
  });

  describe('buildGraph', () => {
    test('constructs directed graph from transaction data with correct nodes and edges', () => {
      const transactions: Array<{ payer: string; payee: string; proof: PaymentProof; outcome: 'success' | 'fail' }> = [
        { payer: 'agent-a', payee: 'agent-b', proof: makeProof('agent-b', '6.00', '0x1'), outcome: 'success' },
        { payer: 'agent-a', payee: 'agent-c', proof: makeProof('agent-c', '3.00', '0x2'), outcome: 'success' },
      ];

      const graph = buildGraph(transactions);

      expect(graph.nodes).toHaveLength(3); // agent-a, agent-b, agent-c
      expect(graph.edges).toHaveLength(2);
    });

    test('edges are directed from payer to payee with amount as weight', () => {
      const transactions = [
        { payer: 'agent-a', payee: 'agent-b', proof: makeProof('agent-b', '6.00', '0x1'), outcome: 'success' as const },
      ];

      const graph = buildGraph(transactions);
      const edge = graph.edges[0];

      expect(edge.source).toBe('agent-a');
      expect(edge.target).toBe('agent-b');
      expect(edge.amount).toBe('6.00');
    });

    test('each edge contains source, target, amount, txHash, and outcome', () => {
      const transactions = [
        { payer: 'agent-a', payee: 'agent-b', proof: makeProof('agent-b', '6.00', '0xabc'), outcome: 'success' as const },
      ];

      const graph = buildGraph(transactions);
      const edge = graph.edges[0];

      expect(edge.source).toBe('agent-a');
      expect(edge.target).toBe('agent-b');
      expect(edge.amount).toBe('6.00');
      expect(edge.txHash).toBe('0xabc');
      expect(edge.outcome).toBe('success');
      expect(edge.timestamp).toBeGreaterThan(0);
      expect(edge.id).toBeDefined();
    });

    test('empty transactions produce empty graph', () => {
      const graph = buildGraph([]);
      expect(graph.nodes).toEqual([]);
      expect(graph.edges).toEqual([]);
    });
  });

  describe('saveGraph + getGraph', () => {
    test('round-trip stores and retrieves graph from KV', async () => {
      const graph: PaymentGraph = {
        nodes: [
          { id: 'agent-a', agentId: 'agent-a', role: 'researcher', label: 'Agent A' },
          { id: 'agent-b', agentId: 'agent-b', role: 'reviewer', label: 'Agent B' },
        ],
        edges: [
          { id: 'e1', source: 'agent-a', target: 'agent-b', amount: '6.00', txHash: '0x1', outcome: 'success', timestamp: 1000 },
        ],
      };

      await saveGraph(graph);
      const retrieved = await getGraph();

      expect(retrieved.nodes).toEqual(graph.nodes);
      expect(retrieved.edges).toEqual(graph.edges);
    });

    test('getGraph returns empty graph when no data stored', async () => {
      const graph = await getGraph();
      expect(graph.nodes).toEqual([]);
      expect(graph.edges).toEqual([]);
    });
  });

  describe('addTransaction', () => {
    test('adds a new edge incrementally without losing existing edges', async () => {
      const initial: PaymentGraph = {
        nodes: [
          { id: 'agent-a', agentId: 'agent-a', role: 'researcher', label: 'agent-a' },
          { id: 'agent-b', agentId: 'agent-b', role: 'reviewer', label: 'agent-b' },
        ],
        edges: [
          { id: 'e1', source: 'agent-a', target: 'agent-b', amount: '6.00', txHash: '0x1', outcome: 'success', timestamp: 1000 },
        ],
      };
      await saveGraph(initial);

      const updated = await addTransaction(
        'agent-a',
        'agent-c',
        makeProof('agent-c', '3.00', '0x2'),
        'success'
      );

      expect(updated.edges).toHaveLength(2);
      expect(updated.nodes).toHaveLength(3);
    });

    test('auto-creates new nodes for unknown agents', async () => {
      await saveGraph({ nodes: [], edges: [] });

      const updated = await addTransaction(
        'agent-x',
        'agent-y',
        makeProof('agent-y', '1.00', '0x99'),
        'success'
      );

      expect(updated.nodes).toHaveLength(2);
      expect(updated.nodes.find((n) => n.agentId === 'agent-x')).toBeDefined();
      expect(updated.nodes.find((n) => n.agentId === 'agent-y')).toBeDefined();
    });

    test('duplicate edges between same pair are preserved as separate entries', async () => {
      await saveGraph({ nodes: [], edges: [] });

      await addTransaction('agent-a', 'agent-b', makeProof('agent-b', '6.00', '0x1'), 'success');
      const updated = await addTransaction('agent-a', 'agent-b', makeProof('agent-b', '3.00', '0x2'), 'success');

      const edgesAB = updated.edges.filter((e) => e.source === 'agent-a' && e.target === 'agent-b');
      expect(edgesAB).toHaveLength(2);
      expect(updated.nodes).toHaveLength(2); // no duplicate nodes
    });
  });

  describe('graph structure compatibility', () => {
    test('graph is compatible with react-force-graph (nodes have id, edges have source + target)', () => {
      const transactions = [
        { payer: 'agent-a', payee: 'agent-b', proof: makeProof('agent-b', '6.00', '0x1'), outcome: 'success' as const },
      ];

      const graph = buildGraph(transactions);

      // react-force-graph expects nodes with `id` and links with `source` + `target`
      for (const node of graph.nodes) {
        expect(node.id).toBeDefined();
        expect(typeof node.id).toBe('string');
      }
      for (const edge of graph.edges) {
        expect(edge.source).toBeDefined();
        expect(edge.target).toBeDefined();
      }
    });
  });

  describe('query helpers', () => {
    const testGraph: PaymentGraph = {
      nodes: [
        { id: 'agent-a', agentId: 'agent-a', role: 'researcher', label: 'Agent A' },
        { id: 'agent-b', agentId: 'agent-b', role: 'reviewer', label: 'Agent B' },
        { id: 'agent-c', agentId: 'agent-c', role: 'summarizer', label: 'Agent C' },
      ],
      edges: [
        { id: 'e1', source: 'agent-a', target: 'agent-b', amount: '6.00', txHash: '0x1', outcome: 'success', timestamp: 1000 },
        { id: 'e2', source: 'agent-b', target: 'agent-c', amount: '3.00', txHash: '0x2', outcome: 'success', timestamp: 2000 },
        { id: 'e3', source: 'agent-a', target: 'agent-c', amount: '1.00', txHash: '0x3', outcome: 'fail', timestamp: 3000 },
      ],
    };

    test('getNodeEdges returns both incoming and outgoing edges for an agent', () => {
      const edges = getNodeEdges(testGraph, 'agent-b');
      // agent-b has 1 incoming (from a) and 1 outgoing (to c)
      expect(edges).toHaveLength(2);
    });

    test('getEdgesBetween returns only edges between two specific agents', () => {
      const edges = getEdgesBetween(testGraph, 'agent-a', 'agent-b');
      expect(edges).toHaveLength(1);
      expect(edges[0].txHash).toBe('0x1');
    });

    test('getAgentNode returns node by agent ID', () => {
      const node = getAgentNode(testGraph, 'agent-c');
      expect(node).toBeDefined();
      expect(node!.agentId).toBe('agent-c');
    });

    test('getAgentNode returns null for unknown agent', () => {
      const node = getAgentNode(testGraph, 'agent-unknown');
      expect(node).toBeNull();
    });
  });
});
