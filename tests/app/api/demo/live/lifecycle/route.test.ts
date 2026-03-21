import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockExecuteLiveLifecycle = vi.fn();
let lockState = false;

vi.mock('@/lib/demo/live-lifecycle', () => ({
  executeLiveLifecycle: (...args: unknown[]) => mockExecuteLiveLifecycle(...args),
}));

vi.mock('@/lib/demo/lock', () => ({
  acquireLock: (type: string) => {
    if (type === 'lifecycle' && !lockState) {
      lockState = true;
      return true;
    }
    return false;
  },
  releaseLock: (type: string) => {
    if (type === 'lifecycle') lockState = false;
  },
}));

describe('POST /api/demo/live/lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lockState = false;
  });

  it('returns 200 with lifecycle result on success', async () => {
    const mockResult = {
      success: true,
      requesterId: 'seed-R1',
      providerId: 'seed-S2',
      negotiatedPrice: 12,
      paymentTxHash: '0xpay123',
      feedbackTxHash: '0xfeedback123',
      reputationUpdated: true,
      steps: [],
      durationMs: 22000,
    };
    mockExecuteLiveLifecycle.mockResolvedValue(mockResult);

    const { POST } = await import('@/app/api/demo/live/lifecycle/route');
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.requesterId).toBe('seed-R1');
    expect(body.providerId).toBe('seed-S2');
    expect(body.negotiatedPrice).toBe(12);
    expect(body.paymentTxHash).toBe('0xpay123');
  });

  it('calls executeLiveLifecycle with correct seed agents', async () => {
    mockExecuteLiveLifecycle.mockResolvedValue({ success: true, steps: [], durationMs: 100 });

    const { POST } = await import('@/app/api/demo/live/lifecycle/route');
    await POST();

    expect(mockExecuteLiveLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterId: 'seed-R1',
        providerId: 'seed-S2',
        capability: 'audit_contract',
        maxBudget: 15,
      }),
    );
  });

  it('returns 409 when trigger is already executing', async () => {
    // Acquire lock first to simulate concurrent execution
    lockState = true;

    const { POST } = await import('@/app/api/demo/live/lifecycle/route');
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe('TRIGGER_IN_PROGRESS');
  });

  it('returns 500 on execution error', async () => {
    mockExecuteLiveLifecycle.mockRejectedValue(new Error('Payment module unavailable'));

    const { POST } = await import('@/app/api/demo/live/lifecycle/route');
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe('LIFECYCLE_ERROR');
    expect(body.error.message).toBe('Payment module unavailable');
  });

  it('releases lock after successful execution', async () => {
    mockExecuteLiveLifecycle.mockResolvedValue({ success: true, steps: [], durationMs: 100 });

    const { POST } = await import('@/app/api/demo/live/lifecycle/route');
    await POST();

    // Lock should be released, allowing second execution
    expect(lockState).toBe(false);
  });

  it('releases lock after failed execution', async () => {
    mockExecuteLiveLifecycle.mockRejectedValue(new Error('Crash'));

    const { POST } = await import('@/app/api/demo/live/lifecycle/route');
    await POST();

    expect(lockState).toBe(false);
  });
});
