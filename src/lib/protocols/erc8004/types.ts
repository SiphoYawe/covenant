import type { HexString } from '@/types';
import type { Address } from 'viem';

/** ERC-8004 compliant agent metadata for registration */
export type AgentMetadata = {
  name: string;
  description: string;
  capabilities: string[];
  walletAddress: Address;
  metadataURI?: string;
  registrationTimestamp?: number;
};

/** Parameters for on-chain agent registration */
export type AgentRegistrationData = {
  agentURI: string;
  walletAddress: Address;
};

/** Cached agent profile in Vercel KV */
export type AgentProfile = {
  agentId: string;
  role: string;
  address: Address;
  metadataURI: string;
  registrationTxHash?: HexString;
  registeredAt?: number;
};

/** Feedback data type (defined now for later epics) */
export type FeedbackData = {
  agentId: string;
  clientAddress: Address;
  value: number;
  tag1?: string;
  tag2?: string;
  endpoint?: string;
  feedbackURI?: string;
};

/** Feedback submission data for giveFeedback on ReputationRegistry (Story 3.4) */
export type FeedbackSubmission = {
  targetAgentId: string;
  isPositive: boolean;
  feedbackURI: string;
  proofOfPayment: string;
  feedbackerAgentId: string;
};

/** Result of a successful feedback submission (Story 3.4) */
export type FeedbackResult = {
  txHash: string;
  feedbackerAgentId: string;
  targetAgentId: string;
  isPositive: boolean;
  timestamp: number;
};

/** On-chain FeedbackGiven event (Story 3.4) */
export type FeedbackEvent = {
  targetAgentId: string;
  feedbackerAddress: string;
  isPositive: boolean;
  feedbackURI: string;
  blockNumber: number;
  txHash: string;
};

// --- Write-back types (Story 5.8) ---

/** Signal summary for on-chain transparency */
export type SignalSummary = {
  stakeWeight: number;
  trustPropagation: number;
  sybilPenalty: number;
  civicFlag: number;
  paymentVolume: number;
};

/** Data to write back on-chain via appendResponse */
export type AppendResponseData = {
  agentId: string;
  score: number;
  explanationCid: string;
  timestamp: number;
  signalSummary: SignalSummary;
};

/** Cached reputation in KV for dashboard reads */
export type CachedReputation = {
  score: number;
  explanationCid: string;
  txHash: string;
  updatedAt: number;
};

/** API response shape for reputation scores */
export type ReputationScoreResponse = {
  agentId: string;
  score: number;
  explanationCid: string;
  txHash: string;
  updatedAt: number;
};
