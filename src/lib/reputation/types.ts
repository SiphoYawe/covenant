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

export const SybilPatternTypes = [
  'circular_payments',
  'uniform_feedback',
  'reputation_farming',
  'rapid_transactions',
  'adversarial_behavior',
] as const;
export type SybilPatternType = (typeof SybilPatternTypes)[number];

export const SybilAlertSchema = z.object({
  id: z.string(),
  patternType: z.enum(SybilPatternTypes),
  involvedAgents: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  evidence: z.string(),
  timestamp: z.number(),
});
export type SybilAlert = z.infer<typeof SybilAlertSchema>;

// --- Sybil detection types (Story 5.5) ---

export type TransactionRecord = {
  from: string;
  to: string;
  amount: number;
  timestamp: number;
  txHash: string;
  feedbackValue: number;
};

export type ExtractedPatterns = {
  circularPayments: Array<{ cycle: string[]; edgeCount: number }>;
  uniformFeedback: Array<{ agentId: string; feedbackValues: number[]; variance: number }>;
  transactionPadding: Array<{ agentId: string; tinyTxCount: number; totalTxCount: number }>;
  rapidRepeats: Array<{ pair: [string, string]; count: number; windowMs: number }>;
};

export type AgentContext = {
  agentId: string;
  civicFlags: Array<{ severity: string; attackType: string; evidence: string }>;
  feedbackHistory: Array<{ value: number; outcome: string }>;
};

export type SybilDetectionInput = {
  graph: PaymentGraph;
  transactionHistory: TransactionRecord[];
  agentIds: string[];
};

export type SybilDetectionResult = {
  alerts: SybilAlert[];
  analysisTimestamp: number;
  reasoning: string;
};

// --- Score synthesis types (Story 5.6) ---

export type ScoreSynthesisInput = {
  agentId: string;
  stakeWeightedScore: number;
  trustPropagationScore: number;
  sybilAlerts: SybilAlert[];
  civicPenalty: number;
  hasNegativeFeedback: boolean;
};

export type AgentClassification = 'trusted' | 'neutral' | 'suspicious' | 'adversarial';

export type SynthesisWeights = {
  stakeWeight: number;
  trustPropagationWeight: number;
  sybilPenaltyWeight: number;
  civicPenaltyWeight: number;
};

export type ScoreSynthesisResult = {
  agentId: string;
  finalScore: number;
  components: {
    stakeWeightedScore: number;
    trustPropagationScore: number;
    sybilPenalty: number;
    civicPenalty: number;
  };
  classification: AgentClassification;
};

// --- Explanation types (Story 5.7) ---

export type ExplanationInput = {
  agentId: string;
  agentName: string;
  agentRole: string;
  score: number;
  classification: AgentClassification;
  jobCount: number;
  successRate: number;
  failureRate: number;
  paymentVolume: number;
  civicFlags: Array<{ severity: string; attackType: string; evidence: string }>;
  trustGraphPosition: {
    inboundTrust: number;
    outboundTrust: number;
  };
  sybilAlerts: SybilAlert[];
  stakeWeightedAverage: number;
};

export type ExplanationResult = {
  agentId: string;
  explanation: string;
  cid: string | null;
  storedInKV: boolean;
  retryPinning: boolean;
  generatedAt: number;
};

export type AgentReputationCache = {
  score: number;
  explanationCID: string | null;
  explanationText: string | null;
  retryPinning: boolean;
  updatedAt: number;
};

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
