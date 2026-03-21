/**
 * End-to-end demo flow integration tests.
 *
 * These tests verify the complete demo system works as a cohesive unit:
 * - API routes correctly dispatch to execution modules
 * - Lock mechanism prevents concurrent triggers
 * - Results flow through the correct shape for UI consumption
 * - Reset clears state and allows re-execution
 * - Error paths propagate correctly through all layers
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Shared mock state ----

let lifecycleLock = false;
let sybilLock = false;

const mockResetAllDemoState = vi.fn();
const mockExecuteLiveLifecycle = vi.fn();
const mockExecuteSybilCascade = vi.fn();
const mockEmit = vi.fn().mockResolvedValue({ id: 'e-1', timestamp: Date.now() });

// ---- Module mocks ----

vi.mock('@/lib/orchestrator', () => ({
  resetAllDemoState: (...args: unknown[]) => mockResetAllDemoState(...args),
}));

vi.mock('@/lib/events/bus', () => ({
  createEventBus: () => ({ emit: mockEmit, since: vi.fn().mockResolvedValue([]) }),
}));

vi.mock('@/lib/events/constants', () => ({
  EVENT_TYPES: { DEMO_RESET: 'demo:reset' },
}));

vi.mock('@/lib/events/types', () => ({
  Protocol: { CovenantAi: 'covenant-ai' },
}));

vi.mock('@/lib/demo/live-lifecycle', () => ({
  executeLiveLifecycle: (...args: unknown[]) => mockExecuteLiveLifecycle(...args),
}));

vi.mock('@/lib/demo/live-sybil-cascade', () => ({
  executeSybilCascade: (...args: unknown[]) => mockExecuteSybilCascade(...args),
}));

vi.mock('@/lib/demo/lock', () => ({
  acquireLock: (type: string) => {
    if (type === 'lifecycle') {
      if (lifecycleLock) return false;
      lifecycleLock = true;
      return true;
    }
    if (type === 'sybil-cascade') {
      if (sybilLock) return false;
      sybilLock = true;
      return true;
    }
    return false;
  },
  releaseLock: (type: string) => {
    if (type === 'lifecycle') lifecycleLock = false;
    if (type === 'sybil-cascade') sybilLock = false;
  },
}));

// ---- Standard result fixtures ----

const LIFECYCLE_RESULT = {
  success: true,
  requesterId: 'seed-R1',
  providerId: 'seed-S2',
  negotiatedPrice: 12,
  paymentTxHash: '0xpay123abc',
  feedbackTxHash: '0xfeedback456',
  reputationUpdated: true,
  deliverable: 'Audit complete: no critical vulnerabilities found.',
  steps: [
    { name: 'Discovery', status: 'completed', protocol: 'a2a', durationMs: 1800 },
    { name: 'Negotiation', status: 'completed', protocol: 'covenant-ai', durationMs: 5200 },
    { name: 'Payment', status: 'completed', protocol: 'x402', durationMs: 3100 },
    { name: 'Delivery', status: 'completed', protocol: 'a2a', durationMs: 4000 },
    { name: 'Civic Inspection', status: 'completed', protocol: 'civic', durationMs: 3500 },
    { name: 'Evaluation', status: 'completed', protocol: 'covenant-ai', durationMs: 2000 },
    { name: 'Feedback', status: 'completed', protocol: 'erc8004', durationMs: 2800 },
    { name: 'Reputation Update', status: 'completed', protocol: 'covenant-ai', durationMs: 4600 },
  ],
  durationMs: 23400,
};

const SYBIL_RESULT = {
  success: true,
  ringMembers: ['seed-X2', 'seed-X3', 'seed-X4'],
  scoreDrops: {
    'seed-X2': { before: 7.5, after: 2.1 },
    'seed-X3': { before: 7.2, after: 2.3 },
    'seed-X4': { before: 6.8, after: 1.9 },
  },
  explanation: 'Agents form a manipulation ring with circular payment patterns.',
  txHashes: {
    'seed-X2': '0xwriteback1',
    'seed-X3': '0xwriteback2',
    'seed-X4': '0xwriteback3',
  },
  steps: [
    { name: 'Evidence Flagged', status: 'completed', durationMs: 500 },
    { name: 'Graph Analysis', status: 'completed', durationMs: 5400 },
    { name: 'Sybil Detection', status: 'completed', durationMs: 4800 },
    { name: 'Score Cascade', status: 'completed', durationMs: 3200 },
    { name: 'Explanation Generation', status: 'completed', durationMs: 4100 },
    { name: 'On-Chain Write-Back', status: 'completed', durationMs: 3000 },
    { name: 'Routing Exclusion', status: 'completed', durationMs: 200 },
  ],
  durationMs: 24100,
};

// ---- Tests ----

describe('E2E Demo Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lifecycleLock = false;
    sybilLock = false;
  });

  describe('Complete lifecycle trigger flow', () => {
    it('POST /api/demo/live/lifecycle returns full result with all protocol data', async () => {
      mockExecuteLiveLifecycle.mockResolvedValue(LIFECYCLE_RESULT);

      const { POST } = await import('@/app/api/demo/live/lifecycle/route');
      const response = await POST();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);

      // Verify all fields the UI needs are present
      expect(body.requesterId).toBe('seed-R1');
      expect(body.providerId).toBe('seed-S2');
      expect(body.negotiatedPrice).toBe(12);
      expect(body.paymentTxHash).toMatch(/^0x/);
      expect(body.feedbackTxHash).toMatch(/^0x/);
      expect(body.reputationUpdated).toBe(true);
      expect(body.steps).toHaveLength(8);
      expect(body.durationMs).toBeGreaterThan(0);
    });

    it('lifecycle result steps cover all 5 protocols', async () => {
      mockExecuteLiveLifecycle.mockResolvedValue(LIFECYCLE_RESULT);

      const { POST } = await import('@/app/api/demo/live/lifecycle/route');
      const response = await POST();
      const body = await response.json();

      const protocols = new Set(body.steps.map((s: { protocol: string }) => s.protocol));
      expect(protocols.has('a2a')).toBe(true);
      expect(protocols.has('covenant-ai')).toBe(true);
      expect(protocols.has('x402')).toBe(true);
      expect(protocols.has('civic')).toBe(true);
      expect(protocols.has('erc8004')).toBe(true);
    });
  });

  describe('Complete sybil cascade trigger flow', () => {
    it('POST /api/demo/live/sybil-cascade returns full result with ring data', async () => {
      mockExecuteSybilCascade.mockResolvedValue(SYBIL_RESULT);

      const { POST } = await import('@/app/api/demo/live/sybil-cascade/route');
      const response = await POST();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);

      // Ring members
      expect(body.ringMembers).toHaveLength(3);
      expect(body.ringMembers).toContain('seed-X2');

      // Score drops with before/after
      expect(body.scoreDrops['seed-X2'].before).toBeGreaterThan(body.scoreDrops['seed-X2'].after);

      // All ring members got score drops
      for (const member of body.ringMembers) {
        expect(body.scoreDrops[member]).toBeDefined();
        expect(body.scoreDrops[member].before).toBeGreaterThan(body.scoreDrops[member].after);
      }

      // On-chain write-back tx hashes
      expect(Object.keys(body.txHashes)).toHaveLength(3);
      for (const member of body.ringMembers) {
        expect(body.txHashes[member]).toMatch(/^0x/);
      }

      // AI explanation
      expect(body.explanation.length).toBeGreaterThan(0);
    });
  });

  describe('Concurrent execution prevention', () => {
    it('rejects concurrent lifecycle triggers with 409', async () => {
      mockExecuteLiveLifecycle.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(LIFECYCLE_RESULT), 100)),
      );

      const { POST } = await import('@/app/api/demo/live/lifecycle/route');

      // First call acquires lock
      const first = POST();

      // Second call should be rejected
      const second = await POST();
      expect(second.status).toBe(409);

      // First call should succeed
      const firstResponse = await first;
      expect(firstResponse.status).toBe(200);
    });

    it('rejects concurrent sybil cascade triggers with 409', async () => {
      mockExecuteSybilCascade.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(SYBIL_RESULT), 100)),
      );

      const { POST } = await import('@/app/api/demo/live/sybil-cascade/route');

      const first = POST();
      const second = await POST();

      expect(second.status).toBe(409);
      const firstResponse = await first;
      expect(firstResponse.status).toBe(200);
    });

    it('lifecycle and sybil cascade can run concurrently (independent locks)', async () => {
      mockExecuteLiveLifecycle.mockResolvedValue(LIFECYCLE_RESULT);
      mockExecuteSybilCascade.mockResolvedValue(SYBIL_RESULT);

      const lifecycleRoute = await import('@/app/api/demo/live/lifecycle/route');
      const sybilRoute = await import('@/app/api/demo/live/sybil-cascade/route');

      const [lifecycleRes, sybilRes] = await Promise.all([
        lifecycleRoute.POST(),
        sybilRoute.POST(),
      ]);

      expect(lifecycleRes.status).toBe(200);
      expect(sybilRes.status).toBe(200);
    });
  });

  describe('Reset flow', () => {
    it('POST /api/demo/reset clears state and emits event', async () => {
      mockResetAllDemoState.mockResolvedValue({
        success: true,
        keysCleared: 42,
        resetAt: Date.now(),
      });

      const { POST } = await import('@/app/api/demo/reset/route');
      const response = await POST();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.keysCleared).toBe(42);

      // Event bus should emit demo:reset
      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'demo:reset',
          agentId: 'system',
        }),
      );
    });

    it('reset enables re-execution of triggers', async () => {
      mockResetAllDemoState.mockResolvedValue({ success: true, keysCleared: 10, resetAt: Date.now() });
      mockExecuteLiveLifecycle.mockResolvedValue(LIFECYCLE_RESULT);

      const resetRoute = await import('@/app/api/demo/reset/route');
      const lifecycleRoute = await import('@/app/api/demo/live/lifecycle/route');

      // First lifecycle
      const r1 = await lifecycleRoute.POST();
      expect(r1.status).toBe(200);

      // Reset
      const resetRes = await resetRoute.POST();
      expect(resetRes.status).toBe(200);

      // Second lifecycle should work (lock was released after first completed)
      const r2 = await lifecycleRoute.POST();
      expect(r2.status).toBe(200);
    });
  });

  describe('Error propagation', () => {
    it('lifecycle execution error returns structured error response', async () => {
      mockExecuteLiveLifecycle.mockRejectedValue(new Error('A2A discovery timeout'));

      const { POST } = await import('@/app/api/demo/live/lifecycle/route');
      const response = await POST();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('LIFECYCLE_ERROR');
      expect(body.error.message).toBe('A2A discovery timeout');
    });

    it('sybil cascade execution error returns structured error response', async () => {
      mockExecuteSybilCascade.mockRejectedValue(new Error('Graph DB unavailable'));

      const { POST } = await import('@/app/api/demo/live/sybil-cascade/route');
      const response = await POST();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('SYBIL_CASCADE_ERROR');
      expect(body.error.message).toBe('Graph DB unavailable');
    });

    it('reset failure returns structured error response', async () => {
      mockResetAllDemoState.mockResolvedValue({
        success: false,
        keysCleared: 0,
        resetAt: 0,
        error: 'KV store unreachable',
      });

      const { POST } = await import('@/app/api/demo/reset/route');
      const response = await POST();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error.code).toBe('RESET_FAILED');
    });
  });

  describe('Result shape validation for UI consumption', () => {
    it('lifecycle result contains all fields needed by TriggerSummary component', async () => {
      mockExecuteLiveLifecycle.mockResolvedValue(LIFECYCLE_RESULT);

      const { POST } = await import('@/app/api/demo/live/lifecycle/route');
      const body = await (await POST()).json();

      // TriggerSummary reads these fields
      expect(typeof body.success).toBe('boolean');
      expect(typeof body.requesterId).toBe('string');
      expect(typeof body.providerId).toBe('string');
      expect(typeof body.negotiatedPrice).toBe('number');
      expect(typeof body.durationMs).toBe('number');
      // Optional but used when present
      if (body.paymentTxHash) expect(typeof body.paymentTxHash).toBe('string');
      if (body.feedbackTxHash) expect(typeof body.feedbackTxHash).toBe('string');
    });

    it('sybil result contains all fields needed by TriggerSummary component', async () => {
      mockExecuteSybilCascade.mockResolvedValue(SYBIL_RESULT);

      const { POST } = await import('@/app/api/demo/live/sybil-cascade/route');
      const body = await (await POST()).json();

      // TriggerSummary reads these fields
      expect(typeof body.success).toBe('boolean');
      expect(Array.isArray(body.ringMembers)).toBe(true);
      expect(typeof body.scoreDrops).toBe('object');
      expect(typeof body.explanation).toBe('string');
      expect(typeof body.txHashes).toBe('object');
      expect(typeof body.durationMs).toBe('number');

      // Verify scoreDrops shape
      for (const [_agentId, drop] of Object.entries(body.scoreDrops)) {
        const d = drop as { before: number; after: number };
        expect(typeof d.before).toBe('number');
        expect(typeof d.after).toBe('number');
      }
    });

    it('lifecycle steps each have name, status, protocol, and durationMs', async () => {
      mockExecuteLiveLifecycle.mockResolvedValue(LIFECYCLE_RESULT);

      const { POST } = await import('@/app/api/demo/live/lifecycle/route');
      const body = await (await POST()).json();

      for (const step of body.steps) {
        expect(typeof step.name).toBe('string');
        expect(typeof step.status).toBe('string');
        expect(typeof step.protocol).toBe('string');
        expect(typeof step.durationMs).toBe('number');
      }
    });
  });

  describe('Demo narrative validation', () => {
    it('lifecycle uses correct seed agents (R1 requester, S2 provider)', async () => {
      mockExecuteLiveLifecycle.mockResolvedValue(LIFECYCLE_RESULT);

      const { POST } = await import('@/app/api/demo/live/lifecycle/route');
      await POST();

      expect(mockExecuteLiveLifecycle).toHaveBeenCalledWith(
        expect.objectContaining({
          requesterId: 'seed-R1',
          providerId: 'seed-S2',
        }),
      );
    });

    it('sybil cascade targets the correct adversarial ring agents', async () => {
      mockExecuteSybilCascade.mockResolvedValue(SYBIL_RESULT);

      const { POST } = await import('@/app/api/demo/live/sybil-cascade/route');
      await POST();

      expect(mockExecuteSybilCascade).toHaveBeenCalledWith({
        ringAgentIds: ['seed-X2', 'seed-X3', 'seed-X4'],
      });
    });

    it('lifecycle task is an audit_contract task with 15 USDC budget', async () => {
      mockExecuteLiveLifecycle.mockResolvedValue(LIFECYCLE_RESULT);

      const { POST } = await import('@/app/api/demo/live/lifecycle/route');
      await POST();

      expect(mockExecuteLiveLifecycle).toHaveBeenCalledWith(
        expect.objectContaining({
          capability: 'audit_contract',
          maxBudget: 15,
        }),
      );
    });
  });
});
