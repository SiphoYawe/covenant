import { kvGet } from '@/lib/storage/kv';
import { getDeployerForAgent, getOrCreateDeployerProfile, updateDeployerProfile } from '@/lib/deploy/deployer';
import { createEventBus, EVENT_TYPES, Protocol } from '@/lib/events';
import type { CachedReputation } from '@/lib/protocols/erc8004/types';

const DEPLOYER_BOOST_MULTIPLIER = 0.05;
const DEPLOYER_BOOST_CAP = 0.5;
const AGENT_SCORE_WEIGHT = 0.3;
const OWN_SCORE_WEIGHT = 0.7;
const CIVIC_FLAG_PENALTY = -1.0;

/**
 * Get the starting reputation boost for an agent deployed by this deployer.
 * Capped at 0.5 to prevent gaming.
 */
export async function getStartingBoost(deployerAddress: string): Promise<number> {
  const profile = await kvGet<{ deployerScore: number }>(`deployer:${deployerAddress}:profile`);
  if (!profile) return 0;

  return Math.min(DEPLOYER_BOOST_CAP, profile.deployerScore * DEPLOYER_BOOST_MULTIPLIER);
}

/**
 * Recalculate a deployer's score based on their linked agents' reputation.
 * Formula: avg(linkedAgentScores) * 0.3 + ownScore * 0.7
 * Non-blocking. Returns updated score.
 */
export async function recalculateDeployerScore(deployerAddress: string): Promise<number> {
  const profile = await getOrCreateDeployerProfile(deployerAddress);
  const ownScore = profile.deployerScore;

  // Fetch reputation scores for all linked agents
  const agentScores: number[] = [];
  for (const agentId of profile.linkedAgents) {
    const rep = await kvGet<CachedReputation>(`agent:${agentId}:reputation`);
    if (rep) {
      agentScores.push(rep.score);
    }
  }

  // If no agent scores available, keep own score
  if (agentScores.length === 0) return ownScore;

  const avgAgentScore = agentScores.reduce((sum, s) => sum + s, 0) / agentScores.length;
  const newScore = Math.min(10.0, Math.max(0, avgAgentScore * AGENT_SCORE_WEIGHT + ownScore * OWN_SCORE_WEIGHT));

  await updateDeployerProfile(deployerAddress, { deployerScore: newScore });

  return newScore;
}

/**
 * Apply a Civic flag penalty to the deployer of a flagged agent.
 * -1.0 per flag, stacking. Clamps at 0.
 */
export async function applyAgentCivicFlag(agentId: string): Promise<void> {
  const deployerAddress = await getDeployerForAgent(agentId);
  if (!deployerAddress) return;

  const profile = await getOrCreateDeployerProfile(deployerAddress);

  const newScore = Math.max(0, profile.deployerScore + CIVIC_FLAG_PENALTY);
  const newFlagged = profile.flaggedAgents + 1;

  await updateDeployerProfile(deployerAddress, {
    deployerScore: newScore,
    flaggedAgents: newFlagged,
  });

  // Emit score updated event
  const bus = createEventBus();
  await bus.emit({
    type: EVENT_TYPES.DEPLOYER_SCORE_UPDATED,
    protocol: Protocol.Civic,
    agentId,
    data: {
      deployerAddress,
      previousScore: profile.deployerScore,
      newScore,
      reason: 'civic-flag',
      flaggedAgents: newFlagged,
    },
  });
}
