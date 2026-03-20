import type { FeedbackRecord, StakeWeightedResult, WeightedFeedback } from './types';

export const ZERO_STAKE_WEIGHT = 0.01;

/**
 * Compute stake-weighted reputation scores from feedback records.
 * Linear proportional weighting: a 6 USDC job carries 6x the weight of a 1 USDC job.
 *
 * Pure function: no side effects, no external calls.
 * Deterministic: same inputs always produce identical outputs.
 */
export function computeStakeWeights(feedbacks: FeedbackRecord[]): StakeWeightedResult[] {
  if (feedbacks.length === 0) return [];

  // Sort deterministically by agentId, then timestamp for consistent grouping
  const sorted = [...feedbacks].sort((a, b) => {
    const agentCmp = a.agentId.localeCompare(b.agentId);
    if (agentCmp !== 0) return agentCmp;
    return a.timestamp - b.timestamp;
  });

  // Group by agent
  const groups = new Map<string, FeedbackRecord[]>();
  for (const fb of sorted) {
    const existing = groups.get(fb.agentId);
    if (existing) {
      existing.push(fb);
    } else {
      groups.set(fb.agentId, [fb]);
    }
  }

  // Compute per-agent weighted results (iterate sorted keys for determinism)
  const agentIds = [...groups.keys()].sort();
  const results: StakeWeightedResult[] = [];

  for (const agentId of agentIds) {
    const records = groups.get(agentId)!;
    const weightedFeedbacks: WeightedFeedback[] = [];
    let totalWeightedScore = 0;
    let totalStake = 0;

    for (const record of records) {
      const stakeWeight = record.paymentAmount > 0 ? record.paymentAmount : ZERO_STAKE_WEIGHT;
      const weightedScore = record.feedbackValue * stakeWeight;

      weightedFeedbacks.push({
        agentId: record.agentId,
        rawFeedback: record.feedbackValue,
        stakeWeight,
        weightedScore,
      });

      totalWeightedScore += weightedScore;
      totalStake += stakeWeight;
    }

    const weightedAverage = totalStake > 0 ? totalWeightedScore / totalStake : 0;

    results.push({
      agentId,
      weightedAverage,
      totalStake,
      feedbackCount: records.length,
      weightedFeedbacks,
    });
  }

  return results;
}
