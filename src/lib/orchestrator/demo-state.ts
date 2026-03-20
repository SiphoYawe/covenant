import { kvGet, kvSet, kvDel, kvScan } from '@/lib/storage';
import { DemoAct, DemoStatus } from './types';
import type { DemoState, DemoAgentEntry, DemoResetResult } from './types';
import { DEMO_KV_KEYS, KV_PREFIXES_TO_CLEAR } from './constants';

const INITIAL_STATE: DemoState = {
  act: DemoAct.Idle,
  status: DemoStatus.Idle,
  startedAt: null,
  completedAt: null,
};

/** Read current demo state from KV, returning idle state if not found */
export async function getDemoState(): Promise<DemoState> {
  const state = await kvGet<DemoState>(DEMO_KV_KEYS.STATE);
  return state ?? { ...INITIAL_STATE };
}

/** Write demo state to KV */
export async function setDemoState(state: DemoState): Promise<void> {
  await kvSet(DEMO_KV_KEYS.STATE, state);
}

/** Update the current act and status, merging with existing state */
export async function updateDemoAct(act: DemoAct, status: DemoStatus): Promise<DemoState> {
  const current = await getDemoState();
  const updated: DemoState = {
    ...current,
    act,
    status,
    startedAt: status === DemoStatus.Running && current.startedAt === null
      ? Date.now()
      : current.startedAt,
    completedAt: status === DemoStatus.Completed
      ? Date.now()
      : current.completedAt,
  };
  await setDemoState(updated);
  return updated;
}

/** Read registered demo agents from KV */
export async function getDemoAgents(): Promise<DemoAgentEntry[]> {
  const agents = await kvGet<DemoAgentEntry[]>(DEMO_KV_KEYS.AGENTS);
  return agents ?? [];
}

/** Append a new agent to the demo agents list */
export async function addDemoAgent(agent: DemoAgentEntry): Promise<void> {
  const agents = await getDemoAgents();
  agents.push(agent);
  await kvSet(DEMO_KV_KEYS.AGENTS, agents);
}

/** Clear the demo agents list */
export async function clearDemoAgents(): Promise<void> {
  await kvDel(DEMO_KV_KEYS.AGENTS);
}

/** Reset all demo-related KV state. Scans for prefix-matched keys and deletes them. */
export async function resetAllDemoState(): Promise<DemoResetResult> {
  let keysCleared = 0;

  try {
    // Scan and delete all keys matching each prefix
    for (const prefix of KV_PREFIXES_TO_CLEAR) {
      try {
        const keys = await kvScan(`${prefix}*`);
        for (const key of keys) {
          try {
            await kvDel(key);
            keysCleared++;
          } catch (err) {
            console.error(`Failed to delete key ${key}:`, err);
          }
        }
      } catch (err) {
        console.error(`Failed to scan prefix ${prefix}:`, err);
      }
    }

    // Delete standalone demo keys explicitly
    for (const key of [DEMO_KV_KEYS.STATE, DEMO_KV_KEYS.AGENTS]) {
      try {
        await kvDel(key);
        keysCleared++;
      } catch (err) {
        console.error(`Failed to delete key ${key}:`, err);
      }
    }

    // Set initial idle state
    await setDemoState({ ...INITIAL_STATE });

    return {
      success: true,
      keysCleared,
      resetAt: Date.now(),
    };
  } catch (err) {
    return {
      success: false,
      keysCleared,
      resetAt: Date.now(),
      error: err instanceof Error ? err.message : 'Unknown error during reset',
    };
  }
}
