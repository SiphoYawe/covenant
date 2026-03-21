import type { SeedAgentProfile } from './types';

/**
 * ERC-8004 compatible metadata derived from a seed agent profile.
 * Uses the same shape as AgentMetadata from @/lib/protocols/erc8004/types
 * but without requiring a wallet address (that comes at registration time).
 */
export interface SeedAgentMetadata {
  name: string;
  description: string;
  capabilities: string[];
}

/**
 * Convert a SeedAgentProfile to ERC-8004 compatible metadata.
 *
 * For adversarial agents, the metadata looks legitimate (no attack keywords).
 * The malicious behavior is embedded only in the system prompt, not the metadata.
 */
export function profileToMetadata(profile: SeedAgentProfile): SeedAgentMetadata {
  return {
    name: profile.name,
    description: profile.description,
    capabilities: [...profile.capabilities],
  };
}
