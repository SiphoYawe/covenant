import type {
  ScoreSynthesisInput,
  ScoreSynthesisResult,
  SynthesisWeights,
  AgentClassification,
} from './types';

const DEFAULT_WEIGHTS: SynthesisWeights = {
  stakeWeight: 0.4,
  trustPropagationWeight: 0.3,
  sybilPenaltyWeight: 0.15,
  civicPenaltyWeight: 0.15,
};

/**
 * Classify an agent based on score and context.
 * Special rule: Civic flag + negative feedback forces "adversarial".
 */
export function classifyAgent(
  result: ScoreSynthesisResult,
  input: ScoreSynthesisInput
): AgentClassification {
  // Hard rule: Civic flag + negative feedback = adversarial
  if (input.civicPenalty < 0 && input.hasNegativeFeedback) {
    return 'adversarial';
  }

  const score = result.finalScore;
  if (score >= 8.0) return 'trusted';
  if (score >= 5.0) return 'neutral';
  if (score > 2.0) return 'suspicious';
  return 'adversarial';
}

/**
 * Synthesize all signals into a single reputation score.
 * Pure function: deterministic, no side effects.
 */
export function synthesizeScore(
  input: ScoreSynthesisInput,
  weights?: SynthesisWeights
): ScoreSynthesisResult {
  const w = weights ?? DEFAULT_WEIGHTS;

  // Base score: weighted average of positive signals, normalized to 0-10 range
  const positiveWeightSum = w.stakeWeight + w.trustPropagationWeight;
  const baseScore = positiveWeightSum > 0
    ? (input.stakeWeightedScore * w.stakeWeight +
       input.trustPropagationScore * w.trustPropagationWeight) / positiveWeightSum
    : 0;

  // Sybil penalty: sum of confidence-weighted alerts
  const sybilPenalty =
    input.sybilAlerts.length > 0
      ? input.sybilAlerts.reduce((sum, a) => sum + a.confidence * 10, 0) /
        input.sybilAlerts.length
      : 0;

  // Civic penalty (already negative from getCivicPenalty, take absolute)
  const civicPenaltyValue = Math.abs(input.civicPenalty);

  // Apply penalties
  const rawScore =
    baseScore - sybilPenalty * w.sybilPenaltyWeight - civicPenaltyValue * w.civicPenaltyWeight;

  // Clamp to [0.0, 10.0]
  const finalScore = Math.min(10.0, Math.max(0.0, rawScore));

  const result: ScoreSynthesisResult = {
    agentId: input.agentId,
    finalScore,
    components: {
      stakeWeightedScore: input.stakeWeightedScore,
      trustPropagationScore: input.trustPropagationScore,
      sybilPenalty,
      civicPenalty: civicPenaltyValue,
    },
    classification: 'neutral', // placeholder
  };

  // Set classification
  result.classification = classifyAgent(result, input);

  return result;
}

/**
 * Batch synthesize scores for all agents.
 * This is a placeholder that will be wired into the engine orchestrator.
 */
export async function synthesizeAllScores(
  inputs: ScoreSynthesisInput[]
): Promise<Map<string, ScoreSynthesisResult>> {
  const results = new Map<string, ScoreSynthesisResult>();
  for (const input of inputs) {
    results.set(input.agentId, synthesizeScore(input));
  }
  return results;
}
