import { kvGet, kvLrange } from '@/lib/storage/kv';
import { AGENT_CONFIGS } from '@/lib/agents/config';
import type { DemoAgentRole } from '@/lib/agents/types';
import type { AgentProfile } from '@/lib/protocols/erc8004/types';
import { createEventBus } from '@/lib/events/bus';
import { EVENT_TYPES } from '@/lib/events/constants';
import { Protocol } from '@/lib/events/types';
import { DEFAULT_REPUTATION_THRESHOLD, DEFAULT_NEUTRAL_REPUTATION } from '@/lib/config/constants';
import type { RoutingConfig, RoutingDecision, CandidateAgent, ExcludedAgent } from './types';

/**
 * Route a task to the highest-reputation agent that matches the requested capability.
 * Reads reputation scores from Vercel KV cache (never on-chain).
 * Excludes agents below the reputation threshold.
 * Deterministic: same inputs produce same output.
 */
export async function routeTask(config: RoutingConfig): Promise<RoutingDecision> {
  const bus = createEventBus();
  const threshold = config.reputationThreshold ?? DEFAULT_REPUTATION_THRESHOLD;

  // 1. Fetch all registered agent IDs from KV
  const agentIds = await kvLrange('demo:agents', 0, -1);

  // 2. Load profiles and reputation for each agent
  const candidates: CandidateAgent[] = [];
  const excluded: ExcludedAgent[] = [];

  for (const agentId of agentIds) {
    const profile = await kvGet<AgentProfile>(`agent:${agentId}:profile`);
    if (!profile) continue;

    // Check capability match against agent config
    const role = profile.role as DemoAgentRole;
    const agentConfig = AGENT_CONFIGS[role];
    if (!agentConfig) continue;

    const hasCapability = agentConfig.capabilities.includes(config.capability);
    if (!hasCapability) continue;

    // Read reputation from KV cache
    const reputation = await kvGet<{ score: number }>(`agent:${agentId}:reputation`);
    const reputationScore = reputation?.score ?? DEFAULT_NEUTRAL_REPUTATION;

    // Check threshold
    if (reputationScore < threshold) {
      excluded.push({
        agentId,
        role,
        reputationScore,
        exclusionReason: `Reputation score ${reputationScore} below threshold ${threshold}`,
      });
      continue;
    }

    candidates.push({
      agentId,
      role,
      reputationScore,
    });
  }

  // 3. Sort candidates by reputation score descending (deterministic)
  candidates.sort((a, b) => b.reputationScore - a.reputationScore);

  // 4. Handle no qualified agents
  if (candidates.length === 0) {
    await bus.emit({
      type: EVENT_TYPES.ORCHESTRATOR_ROUTING_FAILED,
      protocol: Protocol.CovenantAi,
      data: {
        capability: config.capability,
        threshold,
        excludedCount: excluded.length,
      },
    });

    throw new Error(
      `NO_QUALIFIED_AGENTS: No agents with reputation >= ${threshold} available for capability: ${config.capability}`
    );
  }

  // 5. Select highest-scoring agent
  const selected = candidates[0];

  const decision: RoutingDecision = {
    selectedAgentId: selected.agentId,
    capability: config.capability,
    candidates,
    excluded,
    reason: `Selected ${selected.agentId} (score: ${selected.reputationScore}) as highest-reputation agent for capability: ${config.capability}`,
  };

  // 6. Emit routing event
  await bus.emit({
    type: EVENT_TYPES.ORCHESTRATOR_ROUTED,
    protocol: Protocol.CovenantAi,
    agentId: selected.agentId,
    data: {
      capability: config.capability,
      candidates,
      excluded,
      reason: decision.reason,
    },
  });

  return decision;
}
