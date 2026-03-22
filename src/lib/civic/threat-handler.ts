import { CivicSeverity } from './types';
import type { CivicFlag, InspectionResult } from './types';
import { kvLpush } from '@/lib/storage/kv';
import { createEventBus, Protocol, EVENT_TYPES } from '@/lib/events';
import type { EventBus } from '@/lib/events';

let _eventBus: EventBus | null = null;
function getEventBus(): EventBus {
  if (!_eventBus) _eventBus = createEventBus();
  return _eventBus;
}

export type ThreatContext = {
  agentId: string;
  targetAgentId?: string;
  transactionId?: string;
  data?: Record<string, unknown>;
};

export type ThreatAction = 'blocked' | 'flagged' | 'allowed';

export type ThreatHandlingResult = {
  action: ThreatAction;
  flag: CivicFlag | null;
};

/**
 * Handle a threat based on inspection result severity.
 * Stores flag, determines action, emits civic:resolved event.
 */
export async function handleThreat(
  inspectionResult: InspectionResult,
  context: ThreatContext,
): Promise<ThreatHandlingResult> {
  // If inspection passed, no threat to handle
  if (inspectionResult.passed || inspectionResult.flags.length === 0) {
    return { action: 'allowed', flag: null };
  }

  const flag = inspectionResult.flags[0];

  // Attach transactionId if available
  if (context.transactionId) {
    flag.transactionId = context.transactionId;
  }

  // Store flag in KV (append-only audit trail)
  await storeFlag(flag);

  // Determine action based on severity
  const action = severityToAction(flag.severity);

  // Emit civic:resolved event
  await getEventBus().emit({
    type: EVENT_TYPES.CIVIC_RESOLVED,
    protocol: Protocol.Civic,
    agentId: context.agentId,
    targetAgentId: context.targetAgentId,
    data: {
      action,
      severity: flag.severity,
      attackType: flag.attackType,
      transactionId: context.transactionId,
    },
  });

  return { action, flag };
}

/** Store a flag in KV under agent:{agentId}:civic-flags */
export async function storeFlag(flag: CivicFlag): Promise<void> {
  await kvLpush(`agent:${flag.agentId}:civic-flags`, JSON.stringify(flag));
}

/** Get all flags for an agent */
export async function getFlags(agentId: string): Promise<CivicFlag[]> {
  const { kvLrange: lrange } = await import('@/lib/storage/kv');
  const raw = await lrange(`agent:${agentId}:civic-flags`, 0, -1);
  return raw.map((item) => {
    if (typeof item === 'string') {
      try { return JSON.parse(item) as CivicFlag; } catch { return item as unknown as CivicFlag; }
    }
    return item as unknown as CivicFlag;
  });
}

/** Get flags since a given timestamp */
export async function getFlagsSince(agentId: string, since: number): Promise<CivicFlag[]> {
  const all = await getFlags(agentId);
  return all.filter((flag) => flag.timestamp > since);
}

function severityToAction(severity: CivicSeverity): ThreatAction {
  switch (severity) {
    case CivicSeverity.Critical:
    case CivicSeverity.High:
      return 'blocked';
    case CivicSeverity.Medium:
      return 'flagged';
    case CivicSeverity.Low:
      return 'allowed';
  }
}
