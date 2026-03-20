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
