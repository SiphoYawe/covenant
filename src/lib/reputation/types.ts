import { z } from 'zod';

// --- Graph types (used by Stories 5.3, 5.4, 7.2) ---

export const GraphNodeSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  role: z.string(),
  label: z.string(),
});
export type GraphNode = z.infer<typeof GraphNodeSchema>;

export const TrustEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  amount: z.string(),
  txHash: z.string(),
  outcome: z.enum(['success', 'fail']),
  timestamp: z.number(),
});
export type TrustEdge = z.infer<typeof TrustEdgeSchema>;

export const PaymentGraphSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(TrustEdgeSchema),
});
export type PaymentGraph = z.infer<typeof PaymentGraphSchema>;

// --- Reputation score ---

export const ReputationScoreSchema = z.object({
  agentId: z.string(),
  score: z.number().min(0).max(10),
  confidence: z.number().min(0).max(1),
  signalCount: z.number().int().min(0),
  lastUpdated: z.number(),
  explanationCid: z.string().optional(),
  contributingSignals: z.record(z.string(), z.number()).optional(),
});
export type ReputationScore = z.infer<typeof ReputationScoreSchema>;

// --- Sybil alerts ---

export const SybilAlertSchema = z.object({
  id: z.string(),
  patternType: z.enum([
    'circular_payments',
    'uniform_feedback',
    'reputation_farming',
    'rapid_transactions',
  ]),
  involvedAgents: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  evidence: z.string(),
  timestamp: z.number(),
});
export type SybilAlert = z.infer<typeof SybilAlertSchema>;

// --- Feedback event (reputation engine internal) ---

export const FeedbackEventSchema = z.object({
  targetAgentId: z.string(),
  feedbackValue: z.number(),
  feedbackUri: z.string(),
  proofOfPayment: z.string(),
  sourceAgentId: z.string(),
  timestamp: z.number(),
});
export type ReputationFeedbackEvent = z.infer<typeof FeedbackEventSchema>;

// --- Stake weighting types (Story 5.2) ---

export const FeedbackRecordSchema = z.object({
  agentId: z.string(),
  feedbackValue: z.number(),
  paymentAmount: z.number(),
  transactionHash: z.string(),
  timestamp: z.number(),
});
export type FeedbackRecord = z.infer<typeof FeedbackRecordSchema>;

export const WeightedFeedbackSchema = z.object({
  agentId: z.string(),
  rawFeedback: z.number(),
  stakeWeight: z.number(),
  weightedScore: z.number(),
});
export type WeightedFeedback = z.infer<typeof WeightedFeedbackSchema>;

export const StakeWeightedResultSchema = z.object({
  agentId: z.string(),
  weightedAverage: z.number(),
  totalStake: z.number(),
  feedbackCount: z.number(),
  weightedFeedbacks: z.array(WeightedFeedbackSchema),
});
export type StakeWeightedResult = z.infer<typeof StakeWeightedResultSchema>;

// --- Trust propagation types (Story 5.4) ---

export type TrustMatrix = Map<string, Map<string, number>>;

export const TrustPropagationConfigSchema = z.object({
  dampingFactor: z.number().min(0).max(1).default(0.85),
  maxIterations: z.number().int().min(1).default(5),
  convergenceThreshold: z.number().min(0).default(0.001),
  distrustPenalty: z.number().min(0).max(1).default(0.5),
});
export type TrustPropagationConfig = z.infer<typeof TrustPropagationConfigSchema>;

export type TrustPropagationResult = {
  trustMatrix: TrustMatrix;
  iterations: number;
  converged: boolean;
  computeTimeMs: number;
};

// --- API types ---

export const ReputationComputeRequestSchema = z.object({
  agentId: z.string().optional(),
});
export type ReputationComputeRequest = z.infer<typeof ReputationComputeRequestSchema>;

export const ReputationComputeResultSchema = z.object({
  agentId: z.string().optional(),
  status: z.enum(['computing', 'complete', 'error']),
  pipelineStages: z.array(z.string()),
  startedAt: z.number(),
});
export type ReputationComputeResult = z.infer<typeof ReputationComputeResultSchema>;
