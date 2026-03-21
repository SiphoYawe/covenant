import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoStatus } from '@/lib/orchestrator/types';
import type { DemoState, DemoAgentEntry } from '@/lib/orchestrator/types';

// --- In-memory KV mock ---

const store = new Map<string, unknown>();

const mockKvGet = vi.fn(async (key: string) => store.get(key) ?? null);
const mockKvSet = vi.fn(async (key: string, value: unknown) => { store.set(key, value); });
const mockKvDel = vi.fn(async (key: string) => { store.delete(key); });
const mockKvScan = vi.fn(async (pattern: string) => {
  const prefix = pattern.replace('*', '');
  return Array.from(store.keys()).filter((k) => k.startsWith(prefix));
});

vi.mock('@/lib/storage', () => ({
  kvGet: (...args: unknown[]) => mockKvGet(...args),
  kvSet: (...args: unknown[]) => mockKvSet(...args),
  kvDel: (...args: unknown[]) => mockKvDel(...args),
  kvScan: (...args: unknown[]) => mockKvScan(...args),
}));

describe('Demo State Manager', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  describe('getDemoState', () => {
    it('returns default idle state when KV key does not exist', async () => {
      const { getDemoState } = await import('@/lib/orchestrator/demo-state');
      const state = await getDemoState();
      expect(state).toEqual({
        status: DemoStatus.Idle,
        seededAt: null,
        startedAt: null,
        completedAt: null,
      });
    });

    it('returns stored state when KV key exists', async () => {
      const saved: DemoState = {
        status: DemoStatus.Running,
        seededAt: 500,
        startedAt: 1000,
        completedAt: null,
      };
      store.set('demo:state', saved);

      const { getDemoState } = await import('@/lib/orchestrator/demo-state');
      const state = await getDemoState();
      expect(state).toEqual(saved);
    });
  });

  describe('setDemoState', () => {
    it('writes state to KV under demo:state key', async () => {
      const { setDemoState } = await import('@/lib/orchestrator/demo-state');
      const state: DemoState = {
        status: DemoStatus.Running,
        seededAt: 500,
        startedAt: 2000,
        completedAt: null,
      };
      await setDemoState(state);
      expect(mockKvSet).toHaveBeenCalledWith('demo:state', state);
    });
  });

  describe('updateDemoStatus', () => {
    it('reads current state, updates status, writes back', async () => {
      const initial: DemoState = {
        status: DemoStatus.Idle,
        seededAt: null,
        startedAt: null,
        completedAt: null,
      };
      store.set('demo:state', initial);

      const { updateDemoStatus } = await import('@/lib/orchestrator/demo-state');
      const updated = await updateDemoStatus(DemoStatus.Running);

      expect(updated.status).toBe(DemoStatus.Running);
    });

    it('sets startedAt timestamp when transitioning to Running', async () => {
      const { updateDemoStatus } = await import('@/lib/orchestrator/demo-state');
      const updated = await updateDemoStatus(DemoStatus.Running);
      expect(updated.startedAt).toBeTypeOf('number');
      expect(updated.startedAt).toBeGreaterThan(0);
    });

    it('sets completedAt when status becomes Completed', async () => {
      store.set('demo:state', {
        status: DemoStatus.Running,
        seededAt: 500,
        startedAt: 1000,
        completedAt: null,
      });

      const { updateDemoStatus } = await import('@/lib/orchestrator/demo-state');
      const updated = await updateDemoStatus(DemoStatus.Completed);
      expect(updated.completedAt).toBeTypeOf('number');
      expect(updated.completedAt).toBeGreaterThan(0);
    });
  });

  describe('getDemoAgents', () => {
    it('returns empty array when no agents registered', async () => {
      const { getDemoAgents } = await import('@/lib/orchestrator/demo-state');
      const agents = await getDemoAgents();
      expect(agents).toEqual([]);
    });

    it('returns stored agent entries when key exists', async () => {
      const entries: DemoAgentEntry[] = [
        { agentId: 'a1', tokenId: 't1', walletAddress: '0x1', registeredAt: 1000 },
      ];
      store.set('demo:agents', entries);

      const { getDemoAgents } = await import('@/lib/orchestrator/demo-state');
      const agents = await getDemoAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0].agentId).toBe('a1');
    });
  });

  describe('addDemoAgent', () => {
    it('appends to existing agent list without overwriting', async () => {
      const existing: DemoAgentEntry[] = [
        { agentId: 'a1', tokenId: 't1', walletAddress: '0x1', registeredAt: 1000 },
      ];
      store.set('demo:agents', existing);

      const { addDemoAgent } = await import('@/lib/orchestrator/demo-state');
      await addDemoAgent({ agentId: 'a2', tokenId: 't2', walletAddress: '0x2', registeredAt: 2000 });

      const saved = store.get('demo:agents') as DemoAgentEntry[];
      expect(saved).toHaveLength(2);
      expect(saved[0].agentId).toBe('a1');
      expect(saved[1].agentId).toBe('a2');
    });
  });

  describe('clearDemoAgents', () => {
    it('removes the demo:agents key', async () => {
      store.set('demo:agents', [{ agentId: 'a1', tokenId: 't1', walletAddress: '0x1', registeredAt: 1000 }]);

      const { clearDemoAgents } = await import('@/lib/orchestrator/demo-state');
      await clearDemoAgents();

      expect(mockKvDel).toHaveBeenCalledWith('demo:agents');
      expect(store.has('demo:agents')).toBe(false);
    });
  });
});

describe('KV Reset Logic', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it('scans for keys matching each prefix and deletes them', async () => {
    store.set('agent:a1:profile', { id: 'a1' });
    store.set('agent:a2:profile', { id: 'a2' });
    store.set('reputation:a1', { score: 5 });
    store.set('events:log', 'data');
    store.set('graph:edges', []);

    const { resetAllDemoState } = await import('@/lib/orchestrator/demo-state');
    const result = await resetAllDemoState();

    expect(result.success).toBe(true);
    // 5 prefix-matched keys + 2 standalone keys
    expect(result.keysCleared).toBe(7);
  });

  it('deletes standalone keys demo:state and demo:agents', async () => {
    store.set('demo:state', { status: 'Running' });
    store.set('demo:agents', ['a1']);

    const { resetAllDemoState } = await import('@/lib/orchestrator/demo-state');
    await resetAllDemoState();

    // demo:state gets re-written with idle state, so it exists but is reset
    const state = store.get('demo:state') as DemoState;
    expect(state.status).toBe(DemoStatus.Idle);
  });

  it('sets demo:state to initial idle state after clearing', async () => {
    store.set('demo:state', {
      status: DemoStatus.Completed,
      seededAt: 500,
      startedAt: 1000,
      completedAt: 2000,
    });

    const { resetAllDemoState } = await import('@/lib/orchestrator/demo-state');
    await resetAllDemoState();

    const state = store.get('demo:state') as DemoState;
    expect(state.status).toBe(DemoStatus.Idle);
    expect(state.startedAt).toBeNull();
    expect(state.completedAt).toBeNull();
  });

  it('is idempotent: calling on already-empty state returns keysCleared including standalone deletes', async () => {
    const { resetAllDemoState } = await import('@/lib/orchestrator/demo-state');
    const result = await resetAllDemoState();

    expect(result.success).toBe(true);
    // Even on empty state, the 2 standalone key deletes are attempted
    expect(result.keysCleared).toBe(2);
  });

  it('handles partial failure: some deletes fail, others succeed', async () => {
    store.set('agent:a1:profile', { id: 'a1' });
    store.set('reputation:a1', { score: 5 });

    let callCount = 0;
    mockKvDel.mockImplementation(async (key: string) => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Simulated delete failure');
      }
      store.delete(key);
    });

    const { resetAllDemoState } = await import('@/lib/orchestrator/demo-state');
    const result = await resetAllDemoState();

    // Partial success: first delete fails, rest succeed
    expect(result.success).toBe(true);
    expect(result.keysCleared).toBeGreaterThan(0);
  });

  it('handles complete scan failure gracefully', async () => {
    mockKvScan.mockRejectedValue(new Error('KV unavailable'));

    const { resetAllDemoState } = await import('@/lib/orchestrator/demo-state');
    const result = await resetAllDemoState();

    // Still returns success because standalone deletes may succeed
    expect(result.success).toBe(true);
  });
});
