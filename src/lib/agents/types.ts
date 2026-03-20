import type { WalletRole } from '@/lib/wallets/types';

/** Non-system agent roles for the 4 demo agents */
export type DemoAgentRole = 'researcher' | 'reviewer' | 'summarizer' | 'malicious';

/** Configuration for a demo agent */
export type AgentConfig = {
  role: DemoAgentRole;
  name: string;
  description: string;
  capabilities: string[];
  systemPrompt: string;
  walletRole: WalletRole;
};

/** Dimension scores for deliverable evaluation (Story 3.3) */
export type EvaluationScores = {
  completeness: number;
  accuracy: number;
  relevance: number;
  quality: number;
};

/** Result of AI-powered deliverable evaluation (Story 3.3) */
export type EvaluationResult = {
  decision: 'accept' | 'reject';
  reasoning: string;
  scores: EvaluationScores;
  evaluatorAgentId: string;
  targetAgentId: string;
  taskId: string;
};

/** Prepared feedback data for on-chain submission (Story 3.3 → 3.4) */
export type FeedbackPreparation = {
  targetAgentId: string;
  isPositive: boolean;
  reasoning: string;
  proofOfPayment: string;
  paymentAmount: string;
};
