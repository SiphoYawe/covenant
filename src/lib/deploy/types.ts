import { z } from 'zod';

// --- Deploy Modes ---

export const DeployModes = ['provisioned', 'byow', 'human'] as const;
export type DeployMode = (typeof DeployModes)[number];

// --- Shared field schemas ---

const NameSchema = z.string().min(3).max(50);
const DescriptionSchema = z.string().min(10).max(500);
const CapabilitiesSchema = z.array(z.string()).min(1).max(10);
const HexAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

// --- Deploy Request Schemas (discriminated union on mode) ---

export const ProvisionedDeployRequestSchema = z.object({
  mode: z.literal('provisioned'),
  name: NameSchema,
  description: DescriptionSchema,
  capabilities: CapabilitiesSchema,
  systemPrompt: z.string().max(2000).optional(),
});

export const BYOWDeployRequestSchema = z.object({
  mode: z.literal('byow'),
  address: HexAddressSchema,
  name: NameSchema,
  description: DescriptionSchema,
  capabilities: CapabilitiesSchema,
});

export const HumanDeployRequestSchema = z.object({
  mode: z.literal('human'),
  name: NameSchema,
  description: DescriptionSchema,
  capabilities: CapabilitiesSchema,
  linkReputation: z.boolean(),
  useOwnWallet: z.boolean().optional(),
});

export const DeployRequestSchema = z.discriminatedUnion('mode', [
  ProvisionedDeployRequestSchema,
  BYOWDeployRequestSchema,
  HumanDeployRequestSchema,
]);

// --- BYOW Verify Schema (step 2) ---

export const BYOWVerifyRequestSchema = z.object({
  address: HexAddressSchema,
  nonce: z.string().regex(/^[0-9a-f]{64}$/),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

export type BYOWVerifyRequest = z.infer<typeof BYOWVerifyRequestSchema>;

// --- Inferred types ---

export type ProvisionedDeployRequest = z.infer<typeof ProvisionedDeployRequestSchema>;
export type BYOWDeployRequest = z.infer<typeof BYOWDeployRequestSchema>;
export type HumanDeployRequest = z.infer<typeof HumanDeployRequestSchema>;
export type DeployRequest = z.infer<typeof DeployRequestSchema>;

// --- Provisioned Wallet ---

export const ProvisionedWalletSchema = z.object({
  address: HexAddressSchema,
  privateKey: z.string().regex(/^0x[0-9a-f]{64}$/),
  fundedAmount: z.number().int().min(0),
  provisionedAt: z.string().datetime(),
});

export type ProvisionedWallet = z.infer<typeof ProvisionedWalletSchema>;

// --- Nonce Challenge (BYOW flow) ---

export const NonceChallengeSchema = z.object({
  nonce: z.string().regex(/^[0-9a-f]{64}$/),
  address: HexAddressSchema,
  expiresAt: z.string().datetime(),
});

export type NonceChallenge = z.infer<typeof NonceChallengeSchema>;

// --- Human-Agent Link ---

export const HumanAgentLinkSchema = z.object({
  humanAddress: HexAddressSchema,
  agentId: z.string().startsWith('0x'),
  linkedAt: z.string().datetime(),
  reputationLinked: z.boolean(),
});

export type HumanAgentLink = z.infer<typeof HumanAgentLinkSchema>;

// --- Deployer Profile ---

export const DeployerProfileSchema = z.object({
  address: HexAddressSchema,
  linkedAgents: z.array(z.string()),
  deployerScore: z.number().min(0).max(10),
  totalAgentsDeployed: z.number().int().min(0),
  flaggedAgents: z.number().int().min(0),
});

export type DeployerProfile = z.infer<typeof DeployerProfileSchema>;

// --- Deploy Response Types ---

export type ProvisionedDeployResponse = {
  agentId: string;
  address: string;
  agentCard: Record<string, unknown>;
};

export type BYOWDeployResponse = {
  nonce: string;
  expiresAt: string;
};

export type HumanDeployResponse = {
  agentId: string;
  address: string;
  humanAddress?: string;
  linkedReputation: boolean;
  agentCard: Record<string, unknown>;
};

export type DeployResponse =
  | ProvisionedDeployResponse
  | BYOWDeployResponse
  | HumanDeployResponse;
