import type {
  PaymentGraph,
  TrustPropagationConfig,
  TrustPropagationResult,
  TrustMatrix,
} from './types';

const DEFAULT_CONFIG: TrustPropagationConfig = {
  dampingFactor: 0.85,
  maxIterations: 5,
  convergenceThreshold: 0.001,
  distrustPenalty: 0.5,
};

/**
 * Compute transitive trust scores using PageRank-style iteration on the payment graph.
 * Trust propagates through the network: if A trusts B and B trusts C, A has inferred trust in C.
 *
 * Pure function: deterministic, no side effects, no external calls.
 */
export function computeTrustPropagation(
  graph: PaymentGraph,
  config?: Partial<TrustPropagationConfig>
): TrustPropagationResult {
  const startTime = performance.now();
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Edge case: empty graph
  if (graph.nodes.length === 0) {
    return {
      trustMatrix: new Map(),
      iterations: 0,
      converged: true,
      computeTimeMs: performance.now() - startTime,
    };
  }

  // Sort agent IDs lexicographically for determinism
  const agentIds = graph.nodes.map((n) => n.agentId).sort();

  // Edge case: single node with no edges
  if (graph.edges.length === 0) {
    const matrix: TrustMatrix = new Map();
    for (const id of agentIds) {
      const inner = new Map<string, number>();
      inner.set(id, 1.0);
      matrix.set(id, inner);
    }
    return {
      trustMatrix: matrix,
      iterations: 0,
      converged: true,
      computeTimeMs: performance.now() - startTime,
    };
  }

  // Step 1: Initialize direct trust from edges
  // Aggregate edge weights per (source, target) pair
  const directWeights = new Map<string, Map<string, { totalAmount: number; hasFailure: boolean }>>();

  for (const edge of graph.edges) {
    if (!directWeights.has(edge.source)) {
      directWeights.set(edge.source, new Map());
    }
    const sourceMap = directWeights.get(edge.source)!;
    const existing = sourceMap.get(edge.target);
    const amount = parseFloat(edge.amount) || 0;

    if (existing) {
      existing.totalAmount += amount;
      if (edge.outcome === 'fail') existing.hasFailure = true;
    } else {
      sourceMap.set(edge.target, {
        totalAmount: amount,
        hasFailure: edge.outcome === 'fail',
      });
    }
  }

  // Step 2: Normalize outgoing weights per node to get direct trust scores
  const trustMatrix: TrustMatrix = new Map();
  for (const id of agentIds) {
    trustMatrix.set(id, new Map());
  }

  // Set self-trust
  for (const id of agentIds) {
    trustMatrix.get(id)!.set(id, 1.0);
  }

  // Set direct trust from normalized edge weights
  for (const source of agentIds) {
    const targets = directWeights.get(source);
    if (!targets) continue;

    const totalOutgoing = [...targets.values()].reduce((sum, v) => sum + v.totalAmount, 0);
    if (totalOutgoing === 0) continue;

    for (const [target, data] of targets) {
      const normalizedWeight = data.totalAmount / totalOutgoing;
      const penalty = data.hasFailure ? cfg.distrustPenalty : 1.0;
      const directTrust = Math.min(1.0, normalizedWeight * penalty);
      trustMatrix.get(source)!.set(target, directTrust);
    }
  }

  // Step 3: Iterative propagation
  let converged = false;
  let iterations = 0;

  for (let iter = 0; iter < cfg.maxIterations; iter++) {
    iterations = iter + 1;
    let maxDelta = 0;

    // For each pair (A, C) compute transitive trust through intermediaries B
    const newScores = new Map<string, Map<string, number>>();
    for (const a of agentIds) {
      newScores.set(a, new Map(trustMatrix.get(a)!));
    }

    for (const a of agentIds) {
      for (const c of agentIds) {
        if (a === c) continue;

        // Direct trust stays as base
        const directTrust = trustMatrix.get(a)!.get(c) ?? 0;

        // Transitive: max over intermediaries B of trust(A,B) * trust(B,C) * damping
        // Use max-path (not sum) to ensure multiplicative decay across hops
        let transitiveTrust = 0;
        for (const b of agentIds) {
          if (b === a || b === c) continue;
          const trustAB = trustMatrix.get(a)!.get(b) ?? 0;
          const trustBC = trustMatrix.get(b)!.get(c) ?? 0;
          if (trustAB > 0 && trustBC > 0) {
            const pathTrust = trustAB * trustBC * cfg.dampingFactor;
            if (pathTrust > transitiveTrust) transitiveTrust = pathTrust;
          }
        }

        // Combined: max of direct and transitive (don't diminish direct trust)
        const combined = Math.min(1.0, Math.max(directTrust, transitiveTrust));
        const oldScore = trustMatrix.get(a)!.get(c) ?? 0;
        const delta = Math.abs(combined - oldScore);
        if (delta > maxDelta) maxDelta = delta;

        if (combined > 0) {
          newScores.get(a)!.set(c, combined);
        }
      }
    }

    // Update trust matrix
    for (const a of agentIds) {
      trustMatrix.set(a, newScores.get(a)!);
    }

    // Check convergence
    if (maxDelta < cfg.convergenceThreshold) {
      converged = true;
      break;
    }
  }

  // If we completed all iterations without early break, check final convergence
  if (!converged) {
    converged = false;
  }

  return {
    trustMatrix,
    iterations,
    converged,
    computeTimeMs: performance.now() - startTime,
  };
}

/**
 * Get the pairwise trust score between two agents.
 */
export function getTrustScore(
  result: TrustPropagationResult,
  source: string,
  target: string
): number {
  return result.trustMatrix.get(source)?.get(target) ?? 0.0;
}

/**
 * Get all trust scores for a given agent (as truster).
 */
export function getAgentTrustScores(
  result: TrustPropagationResult,
  agentId: string
): Map<string, number> {
  return result.trustMatrix.get(agentId) ?? new Map();
}

/**
 * Get agents sorted by average incoming trust (descending).
 */
export function getGlobalTrustRanking(
  result: TrustPropagationResult
): Array<{ agentId: string; avgTrust: number }> {
  const agentIds = [...result.trustMatrix.keys()].sort();
  const rankings: Array<{ agentId: string; avgTrust: number }> = [];

  for (const target of agentIds) {
    let totalIncoming = 0;
    let count = 0;

    for (const source of agentIds) {
      if (source === target) continue;
      const score = result.trustMatrix.get(source)?.get(target) ?? 0;
      totalIncoming += score;
      count++;
    }

    rankings.push({
      agentId: target,
      avgTrust: count > 0 ? totalIncoming / count : 0,
    });
  }

  return rankings.sort((a, b) => b.avgTrust - a.avgTrust);
}
