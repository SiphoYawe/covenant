import { kvGet, kvSet } from '@/lib/storage/kv';
import type { PaymentProof } from '@/lib/protocols/x402/types';
import type { PaymentGraph, GraphNode, TrustEdge } from './types';

const KV_GRAPH_NODES = 'graph:nodes';
const KV_GRAPH_EDGES = 'graph:edges';

/**
 * Build a full payment graph from a list of transaction records.
 * Each transaction becomes a directed edge from payer to payee.
 */
export function buildGraph(
  transactions: Array<{
    payer: string;
    payee: string;
    proof: PaymentProof;
    outcome: 'success' | 'fail';
  }>
): PaymentGraph {
  const nodeMap = new Map<string, GraphNode>();
  const edges: TrustEdge[] = [];

  for (const tx of transactions) {
    // Ensure payer node exists
    if (!nodeMap.has(tx.payer)) {
      nodeMap.set(tx.payer, {
        id: tx.payer,
        agentId: tx.payer,
        role: '',
        label: tx.payer,
      });
    }

    // Ensure payee node exists
    if (!nodeMap.has(tx.payee)) {
      nodeMap.set(tx.payee, {
        id: tx.payee,
        agentId: tx.payee,
        role: '',
        label: tx.payee,
      });
    }

    edges.push({
      id: `edge-${tx.proof.txHash}`,
      source: tx.payer,
      target: tx.payee,
      amount: tx.proof.amount,
      txHash: tx.proof.txHash,
      outcome: tx.outcome,
      timestamp: tx.proof.timestamp,
    });
  }

  // Sort nodes for determinism
  const nodes = [...nodeMap.values()].sort((a, b) => a.id.localeCompare(b.id));

  return { nodes, edges };
}

/**
 * Read the current payment graph from Vercel KV.
 */
export async function getGraph(): Promise<PaymentGraph> {
  const [nodes, edges] = await Promise.all([
    kvGet<GraphNode[]>(KV_GRAPH_NODES),
    kvGet<TrustEdge[]>(KV_GRAPH_EDGES),
  ]);

  return {
    nodes: nodes ?? [],
    edges: edges ?? [],
  };
}

/**
 * Write the payment graph to Vercel KV.
 */
export async function saveGraph(graph: PaymentGraph): Promise<void> {
  await Promise.all([
    kvSet(KV_GRAPH_NODES, graph.nodes),
    kvSet(KV_GRAPH_EDGES, graph.edges),
  ]);
}

/**
 * Add a single transaction as a new edge to the graph without rebuilding.
 * Auto-creates nodes for unknown agents.
 */
export async function addTransaction(
  payerAgentId: string,
  payeeAgentId: string,
  proof: PaymentProof,
  outcome: 'success' | 'fail'
): Promise<PaymentGraph> {
  const graph = await getGraph();

  // Auto-create payer node if not exists
  if (!graph.nodes.find((n) => n.agentId === payerAgentId)) {
    graph.nodes.push({
      id: payerAgentId,
      agentId: payerAgentId,
      role: '',
      label: payerAgentId,
    });
  }

  // Auto-create payee node if not exists
  if (!graph.nodes.find((n) => n.agentId === payeeAgentId)) {
    graph.nodes.push({
      id: payeeAgentId,
      agentId: payeeAgentId,
      role: '',
      label: payeeAgentId,
    });
  }

  // Add the new edge (multiple edges per pair are preserved)
  graph.edges.push({
    id: `edge-${proof.txHash}`,
    source: payerAgentId,
    target: payeeAgentId,
    amount: proof.amount,
    txHash: proof.txHash,
    outcome,
    timestamp: proof.timestamp,
  });

  await saveGraph(graph);
  return graph;
}

/**
 * Get all edges involving an agent (both incoming and outgoing).
 */
export function getNodeEdges(graph: PaymentGraph, agentId: string): TrustEdge[] {
  return graph.edges.filter((e) => e.source === agentId || e.target === agentId);
}

/**
 * Get all edges between two specific agents (in either direction).
 */
export function getEdgesBetween(
  graph: PaymentGraph,
  sourceAgentId: string,
  targetAgentId: string
): TrustEdge[] {
  return graph.edges.filter(
    (e) =>
      (e.source === sourceAgentId && e.target === targetAgentId) ||
      (e.source === targetAgentId && e.target === sourceAgentId)
  );
}

/**
 * Get a single node by agent ID.
 */
export function getAgentNode(graph: PaymentGraph, agentId: string): GraphNode | null {
  return graph.nodes.find((n) => n.agentId === agentId) ?? null;
}
