import { CivicSeverity } from './types';
import type { CivicFlag } from './types';
import { getFlags } from './threat-handler';

/** Penalty weights per severity level */
const SEVERITY_PENALTIES: Record<CivicSeverity, number> = {
  [CivicSeverity.Critical]: -3.0,
  [CivicSeverity.High]: -2.0,
  [CivicSeverity.Medium]: -1.0,
  [CivicSeverity.Low]: -0.5,
};

/**
 * Get the aggregated Civic penalty for an agent based on their flags.
 * Called by the Reputation Engine (Epic 5, Story 5.6) as a high-weight negative input.
 * Multiple flags stack.
 */
export async function getCivicPenalty(agentId: string): Promise<number> {
  const flags = await getFlags(agentId);
  return computePenalty(flags);
}

/** Compute penalty from a list of flags (pure function for testing) */
export function computePenalty(flags: CivicFlag[]): number {
  if (flags.length === 0) return 0;
  return flags.reduce((total, flag) => total + (SEVERITY_PENALTIES[flag.severity] ?? 0), 0);
}
