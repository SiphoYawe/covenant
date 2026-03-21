/** In-memory concurrency lock for live demo triggers. */

type TriggerType = 'lifecycle' | 'sybil-cascade';

const activeTriggers = new Set<TriggerType>();

export function acquireLock(type: TriggerType): boolean {
  if (activeTriggers.has(type)) return false;
  activeTriggers.add(type);
  return true;
}

export function releaseLock(type: TriggerType): void {
  activeTriggers.delete(type);
}

export function isLocked(type: TriggerType): boolean {
  return activeTriggers.has(type);
}
