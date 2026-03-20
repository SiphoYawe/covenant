// Types
export type {
  ReputationScore,
  TrustEdge,
  GraphNode,
  PaymentGraph,
  SybilAlert,
  SybilPatternType,
  ReputationFeedbackEvent,
  FeedbackRecord,
  WeightedFeedback,
  StakeWeightedResult,
  TrustMatrix,
  TrustPropagationConfig,
  TrustPropagationResult,
  ReputationComputeRequest,
  ReputationComputeResult,
  TransactionRecord,
  ExtractedPatterns,
  AgentContext,
  SybilDetectionInput,
  SybilDetectionResult,
  ScoreSynthesisInput,
  ScoreSynthesisResult,
  SynthesisWeights,
  AgentClassification,
  ExplanationInput,
  ExplanationResult,
  AgentReputationCache,
} from './types';

export {
  ReputationScoreSchema,
  TrustEdgeSchema,
  GraphNodeSchema,
  PaymentGraphSchema,
  SybilAlertSchema,
  SybilPatternTypes,
  FeedbackEventSchema,
  FeedbackRecordSchema,
  WeightedFeedbackSchema,
  StakeWeightedResultSchema,
  TrustPropagationConfigSchema,
  ReputationComputeRequestSchema,
  ReputationComputeResultSchema,
} from './types';

// Engine
export { triggerReputationPipeline, parseFeedbackEvent } from './engine';

// Stake weighting (Story 5.2)
export { computeStakeWeights, ZERO_STAKE_WEIGHT } from './stake-weighting';

// Graph (Story 5.3)
export { buildGraph, getGraph, saveGraph, addTransaction, getNodeEdges, getEdgesBetween, getAgentNode } from './graph';

// Trust propagation (Story 5.4)
export { computeTrustPropagation, getTrustScore, getAgentTrustScores, getGlobalTrustRanking } from './trust-propagation';

// Sybil detection (Story 5.5)
export {
  detectSybilPatterns,
  storeSybilAlerts,
  getSybilAlerts,
  getSybilAlertsForAgent,
  extractCircularPayments,
  extractUniformFeedback,
  extractTransactionPadding,
  extractRapidRepeats,
  analyzePatternsWithAI,
} from './sybil-detection';

// Score synthesis (Story 5.6)
export { synthesizeScore, classifyAgent, synthesizeAllScores } from './score-synthesis';

// Explanation (Story 5.7)
export { generateExplanation, storeExplanation, cacheReputationWithExplanation, generateAndStoreExplanation, retryDeferredPinning } from './explanation';
