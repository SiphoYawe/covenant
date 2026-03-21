import { kvGet, kvSet } from '@/lib/storage/kv';
import type { DeployerProfile } from './types';

const DEFAULT_DEPLOYER_SCORE = 5.0;

/**
 * Get or create a deployer profile. New profiles start with score 5.0 (neutral).
 */
export async function getOrCreateDeployerProfile(address: string): Promise<DeployerProfile> {
  const existing = await kvGet<DeployerProfile>(`deployer:${address}:profile`);
  if (existing) return existing;

  const profile: DeployerProfile = {
    address,
    linkedAgents: [],
    deployerScore: DEFAULT_DEPLOYER_SCORE,
    totalAgentsDeployed: 0,
    flaggedAgents: 0,
  };

  await kvSet(`deployer:${address}:profile`, profile);
  return profile;
}

/**
 * Link an agent to a deployer. Creates profile if needed.
 * Stores reverse lookup for agent-to-deployer resolution.
 */
export async function addLinkedAgent(deployerAddress: string, agentId: string): Promise<void> {
  const profile = await getOrCreateDeployerProfile(deployerAddress);

  profile.linkedAgents.push(agentId);
  profile.totalAgentsDeployed = profile.linkedAgents.length;

  await kvSet(`deployer:${deployerAddress}:profile`, profile);
  await kvSet(`agent:${agentId}:deployer`, deployerAddress);
}

/**
 * Get a deployer profile by address. Returns null if not found.
 */
export async function getDeployerProfile(address: string): Promise<DeployerProfile | null> {
  return kvGet<DeployerProfile>(`deployer:${address}:profile`);
}

/**
 * Reverse lookup: get the deployer address for a given agent.
 */
export async function getDeployerForAgent(agentId: string): Promise<string | null> {
  return kvGet<string>(`agent:${agentId}:deployer`);
}

/**
 * Update a deployer profile's score and flagged count in KV.
 */
export async function updateDeployerProfile(
  address: string,
  updates: Partial<Pick<DeployerProfile, 'deployerScore' | 'flaggedAgents'>>,
): Promise<void> {
  const profile = await getOrCreateDeployerProfile(address);
  if (updates.deployerScore !== undefined) profile.deployerScore = updates.deployerScore;
  if (updates.flaggedAgents !== undefined) profile.flaggedAgents = updates.flaggedAgents;
  await kvSet(`deployer:${address}:profile`, profile);
}
