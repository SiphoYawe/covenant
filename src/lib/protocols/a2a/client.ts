import type { AgentCard } from './types';
import type { DemoAgentRole } from '@/lib/agents/types';
import { DEMO_AGENT_ROLES } from '@/lib/agents/config';
import { getAgentCard } from './agent-card';

/** Default neutral reputation score for agents with no KV data */
const DEFAULT_REPUTATION_SCORE = 5.0;

/**
 * Discover available agents by querying their Agent Cards.
 * Optionally filter by capability (skill ID).
 * Enriches cards with reputation from KV (default 5.0 if missing).
 */
export async function discoverAgents(capability?: string): Promise<AgentCard[]> {
  const cards = await Promise.all(
    DEMO_AGENT_ROLES.map(async (role: DemoAgentRole) => {
      const card = await getAgentCard(role);
      // Default reputation to 5.0 if not enriched
      if (card.reputationScore === undefined) {
        card.reputationScore = DEFAULT_REPUTATION_SCORE;
      }
      return card;
    })
  );

  if (!capability) return cards;

  // Case-insensitive capability matching against skill IDs
  const cap = capability.toLowerCase();
  return cards.filter((card) => card.skills.some((skill) => skill.id.toLowerCase() === cap));
}
