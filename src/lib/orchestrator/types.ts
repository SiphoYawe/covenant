import type { CivicFlag } from '@/lib/civic/types';
import type { ApiError } from '@/types';

// --- Negotiation types (Story 2.5) ---

/** Status of a price negotiation */
export type NegotiationStatus = 'negotiating' | 'agreed' | 'rejected' | 'expired';

/** A single negotiation message from one party */
export type NegotiationMessage = {
  agentId: string;
  action: 'offer' | 'counter' | 'accept' | 'reject';
  amount: number;
  reasoning: string;
};

/** State of an ongoing negotiation */
export type NegotiationState = {
  taskId: string;
  requesterId: string;
  providerId: string;
  currentOffer: number;
  counterOffer?: number;
  round: number;
  maxRounds: number;
  status: NegotiationStatus;
  agreedPrice?: number;
};

/** Result of a completed negotiation */
export type NegotiationResult = {
  status: NegotiationStatus;
  agreedPrice?: number;
  rounds: number;
  messages: NegotiationMessage[];
};

/** Parameters to start a negotiation */
export type NegotiationParams = {
  requesterId: string;
  providerId: string;
  taskDescription: string;
  initialOffer: number;
  maxRounds?: number;
};

// --- Routing types (Story 6.1) ---

/** An agent considered for routing */
export type CandidateAgent = {
  agentId: string;
  role: string;
  reputationScore: number;
};

/** An agent excluded from routing */
export type ExcludedAgent = {
  agentId: string;
  role: string;
  reputationScore: number;
  exclusionReason: string;
};

/** Configuration for a routing decision */
export type RoutingConfig = {
  reputationThreshold: number;
  capability: string;
};

/** Result of a routing decision */
export type RoutingDecision = {
  selectedAgentId: string;
  capability: string;
  candidates: CandidateAgent[];
  excluded: ExcludedAgent[];
  reason: string;
};

// --- Lifecycle types (Story 6.2) ---

/** Lifecycle steps in execution order */
export enum LifecycleStep {
  Discovery = 'Discovery',
  Routing = 'Routing',
  Negotiation = 'Negotiation',
  CivicInputInspection = 'CivicInputInspection',
  Payment = 'Payment',
  Execution = 'Execution',
  CivicOutputInspection = 'CivicOutputInspection',
  Evaluation = 'Evaluation',
  Feedback = 'Feedback',
  ReputationUpdate = 'ReputationUpdate',
}

/** Request to start a lifecycle */
export type LifecycleRequest = {
  requesterId: string;
  taskDescription: string;
  capability: string;
  maxBudget?: number;
};

/** Result of a completed lifecycle */
export type LifecycleResult = {
  success: boolean;
  selectedAgentId: string;
  negotiatedPrice: number;
  paymentTxHash?: string;
  deliverable?: string;
  feedbackTxHash?: string;
  reputationUpdated: boolean;
  civicFlags: CivicFlag[];
  error?: ApiError;
};

/** State accumulated across lifecycle steps */
export type LifecycleState = {
  currentStep: LifecycleStep;
  requesterId: string;
  selectedAgentId?: string;
  negotiatedPrice?: number;
  paymentTxHash?: string;
  deliverable?: string;
  civicFlags: CivicFlag[];
  startedAt: number;
};

// --- Demo state types (Story 8.1) ---

/** Demo narrative acts */
export enum DemoAct {
  Idle = 'Idle',
  Registration = 'Registration',
  EconomyWorks = 'EconomyWorks',
  VillainAttacks = 'VillainAttacks',
  Consequences = 'Consequences',
  Payoff = 'Payoff',
}

/** Demo execution status */
export enum DemoStatus {
  Idle = 'Idle',
  Running = 'Running',
  Completed = 'Completed',
  Failed = 'Failed',
  Resetting = 'Resetting',
}

/** Persisted demo state in KV */
export type DemoState = {
  act: DemoAct;
  status: DemoStatus;
  startedAt: number | null;
  completedAt: number | null;
  error?: string;
};

/** Registered agent entry for current demo run */
export type DemoAgentEntry = {
  agentId: string;
  tokenId: string;
  walletAddress: string;
  registeredAt: number;
};

/** Result of a demo reset operation */
export type DemoResetResult = {
  success: boolean;
  keysCleared: number;
  resetAt: number;
  error?: string;
};
