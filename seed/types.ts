import { z } from 'zod';

// ──────────────────────────────────────────
// Constants
// ──────────────────────────────────────────

export const USDC_CONTRACT_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;
export const USDC_DECIMALS = 6;
export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const FAUCET_AMOUNT_USDC = 20;
export const MIN_PROVIDER_BALANCE_USDC = 5;

export const WALLET_NAMES = {
  requesters: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'] as const,
  providers: [
    'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9',
    'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17',
  ] as const,
  adversarial: ['X1', 'X2', 'X3', 'X4'] as const,
};

export const ALL_WALLET_NAMES = [
  ...WALLET_NAMES.requesters,
  ...WALLET_NAMES.providers,
  ...WALLET_NAMES.adversarial,
] as const;

export const REQUESTER_BUDGETS: Record<string, number> = {
  R1: 100,
  R2: 80,
  R3: 60,
  R4: 50,
  R5: 30,
  R6: 25,
  R7: 40,
};

export const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// ──────────────────────────────────────────
// Core Types (Story 9.1)
// ──────────────────────────────────────────

export type AgentRole = 'requester' | 'provider' | 'adversarial';

export const agentRoleSchema = z.enum(['requester', 'provider', 'adversarial']);

export interface WalletConfig {
  name: string;
  role: AgentRole;
  envKeyName: string;
  address: string;
  privateKey: string;
}

export const walletConfigSchema = z.object({
  name: z.string().min(1),
  role: agentRoleSchema,
  envKeyName: z.string().min(1),
  address: z.string().startsWith('0x'),
  privateKey: z.string().startsWith('0x'),
});

export interface FundingStatus {
  walletName: string;
  ethFunded: boolean;
  usdcFunded: boolean;
  usdcBalance: string;
  ethBalance: string;
  lastAttempt: number;
  error?: string;
}

export const fundingStatusSchema = z.object({
  walletName: z.string().min(1),
  ethFunded: z.boolean(),
  usdcFunded: z.boolean(),
  usdcBalance: z.string(),
  ethBalance: z.string(),
  lastAttempt: z.number(),
  error: z.string().optional(),
});

export interface SeedState {
  wallets: WalletConfig[];
  fundingStatuses: FundingStatus[];
  consolidationComplete: boolean;
  lastRun: number;
}

export const seedStateSchema = z.object({
  wallets: z.array(walletConfigSchema),
  fundingStatuses: z.array(fundingStatusSchema),
  consolidationComplete: z.boolean(),
  lastRun: z.number(),
});

// ──────────────────────────────────────────
// Story 9.2 Types (Agent Profile Configs)
// ──────────────────────────────────────────

export type PricingTier = 'budget' | 'mid' | 'premium';

export const pricingTierSchema = z.enum(['budget', 'mid', 'premium']);

export interface PricingStrategy {
  tier: PricingTier;
  minUsdc: number;
  maxUsdc: number;
}

export const pricingStrategySchema = z.object({
  tier: pricingTierSchema,
  minUsdc: z.number().min(0),
  maxUsdc: z.number().min(0),
});

export interface SeedAgentProfile {
  name: string;
  walletName: string;
  role: AgentRole;
  domain: string;
  description: string;
  capabilities: string[];
  pricing: PricingStrategy;
  systemPrompt: string;
  hiringPreferences?: string[];
  attackType?: string;
  attackStrategy?: string;
  budgetPattern?: string;
}

export const seedAgentProfileSchema = z.object({
  name: z.string().min(1),
  walletName: z.string().min(1),
  role: agentRoleSchema,
  domain: z.string().min(1),
  description: z.string().min(1),
  capabilities: z.array(z.string()).min(1),
  pricing: pricingStrategySchema,
  systemPrompt: z.string().min(10),
  hiringPreferences: z.array(z.string()).optional(),
  attackType: z.string().optional(),
  attackStrategy: z.string().optional(),
  budgetPattern: z.string().optional(),
});

export interface AgentRoster {
  requesters: SeedAgentProfile[];
  providers: SeedAgentProfile[];
  adversarial: SeedAgentProfile[];
  all: SeedAgentProfile[];
}

// ──────────────────────────────────────────
// Story 9.3 Types (Interaction Graph)
// ──────────────────────────────────────────

export type InteractionOutcome = 'positive' | 'negative' | 'mixed' | 'rejected';

export type SeedPhase = 'A' | 'B' | 'C' | 'D' | 'E';

export const interactionOutcomeSchema = z.enum(['positive', 'negative', 'mixed', 'rejected']);

export const seedPhaseSchema = z.enum(['A', 'B', 'C', 'D', 'E']);

export interface SeedInteraction {
  id: string;
  phase: SeedPhase;
  sequenceNumber: number;
  requester: string;
  provider: string;
  usdcAmount: number;
  outcome: InteractionOutcome;
  capabilityRequired: string;
  description: string;
  isMalicious?: boolean;
  notes?: string;
  civicFlags?: string[];
  isSybilRing?: boolean;
}

export const seedInteractionSchema = z.object({
  id: z.string().min(1),
  phase: seedPhaseSchema,
  sequenceNumber: z.number().int().min(1),
  requester: z.string().min(1),
  provider: z.string().min(1),
  usdcAmount: z.number().min(0),
  outcome: interactionOutcomeSchema,
  capabilityRequired: z.string().min(1),
  description: z.string().min(10),
  isMalicious: z.boolean().optional(),
  notes: z.string().optional(),
  civicFlags: z.array(z.string()).optional(),
  isSybilRing: z.boolean().optional(),
});

export interface InteractionValidationResult {
  valid: boolean;
  errors: string[];
  budgetSummary: Record<string, number>;
}

export interface PhaseConfig {
  phase: SeedPhase;
  name: string;
  interactionCount: number;
  description: string;
  prerequisitePhase: SeedPhase | null;
  triggerReputationCompute: boolean;
  civicCheckEnabled: boolean;
  interactions: SeedInteraction[];
}

export const phaseConfigSchema = z.object({
  phase: seedPhaseSchema,
  name: z.string().min(1),
  interactionCount: z.number().min(0),
  description: z.string().min(1),
  prerequisitePhase: seedPhaseSchema.nullable(),
  triggerReputationCompute: z.boolean(),
  civicCheckEnabled: z.boolean(),
  interactions: z.array(seedInteractionSchema),
});

export interface SeedScenario {
  phases: PhaseConfig[];
  totalInteractions: number;
  totalUsdcVolume: number;
}

// ──────────────────────────────────────────
// Story 9.4 Types (Engine State)
// ──────────────────────────────────────────

export interface EngineRegisteredAgent {
  agentId: string;
  tokenId: string;
  txHash: string;
}

export interface EngineState {
  registeredAgents: Record<string, EngineRegisteredAgent>;
  completedInteractions: string[];
  phasesCompleted: string[];
  reputationComputed: string[];
  lastUpdated: string;
}

export const engineStateSchema = z.object({
  registeredAgents: z.record(z.string(), z.object({
    agentId: z.string(),
    tokenId: z.string(),
    txHash: z.string(),
  })),
  completedInteractions: z.array(z.string()),
  phasesCompleted: z.array(z.string()),
  reputationComputed: z.array(z.string()),
  lastUpdated: z.string(),
});

// ──────────────────────────────────────────
// Consolidation Types
// ──────────────────────────────────────────

export interface ConsolidationTransfer {
  from: string;
  to: string;
  amount: number;
}

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────

export function envKeyForWallet(name: string): string {
  return `SEED_WALLET_${name}_KEY`;
}

export function roleForWalletName(name: string): AgentRole {
  if (name.startsWith('R')) return 'requester';
  if (name.startsWith('S')) return 'provider';
  if (name.startsWith('X')) return 'adversarial';
  throw new Error(`Invalid wallet name: ${name}`);
}

export function usdcToSmallestUnit(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
}

export function smallestUnitToUsdc(amount: bigint): number {
  return Number(amount) / 10 ** USDC_DECIMALS;
}
