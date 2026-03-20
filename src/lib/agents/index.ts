export { AGENT_CONFIGS, DEMO_AGENT_ROLES, generateMetadata, getAgentConfig } from './config';
export type { AgentConfig, DemoAgentRole, EvaluationResult, EvaluationScores, FeedbackPreparation } from './types';
export { executeResearcherTask } from './researcher';
export { executeReviewerTask } from './reviewer';
export { executeSummarizerTask } from './summarizer';
export { executeMaliciousTask } from './malicious';
export { evaluateDeliverable, prepareFeedback } from './evaluator';
