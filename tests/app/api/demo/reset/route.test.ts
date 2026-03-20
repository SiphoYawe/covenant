import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockResetAllDemoState = vi.fn();
const mockEmit = vi.fn().mockResolvedValue({ id: 'evt-1', timestamp: Date.now() });

vi.mock('@/lib/orchestrator', () => ({
  resetAllDemoState: (...args: unknown[]) => mockResetAllDemoState(...args),
}));

vi.mock('@/lib/events/bus', () => ({
  createEventBus: () => ({
    emit: mockEmit,
    since: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('@/lib/events/constants', () => ({
  EVENT_TYPES: { DEMO_RESET: 'demo:reset' },
}));

vi.mock('@/lib/events/types', () => ({
  Protocol: { CovenantAi: 'covenant-ai' },
}));

describe('POST /api/demo/reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with DemoResetResult on successful reset', async () => {
    mockResetAllDemoState.mockResolvedValue({
      success: true,
      keysCleared: 10,
      resetAt: 1000,
    });

    const { POST } = await import('@/app/api/demo/reset/route');
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.keysCleared).toBe(10);
    expect(body.resetAt).toBe(1000);
  });

  it('emits demo:reset event to event bus with correct shape', async () => {
    mockResetAllDemoState.mockResolvedValue({
      success: true,
      keysCleared: 5,
      resetAt: 2000,
    });

    const { POST } = await import('@/app/api/demo/reset/route');
    await POST();

    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'demo:reset',
        protocol: 'covenant-ai',
        agentId: 'system',
        data: { keysCleared: 5, resetAt: 2000 },
      }),
    );
  });

  it('returns 500 with ApiError shape on reset failure', async () => {
    mockResetAllDemoState.mockResolvedValue({
      success: false,
      keysCleared: 0,
      resetAt: 3000,
      error: 'KV unavailable',
    });

    const { POST } = await import('@/app/api/demo/reset/route');
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe('RESET_FAILED');
    expect(body.error.message).toBe('KV unavailable');
  });

  it('returns 500 on thrown exception', async () => {
    mockResetAllDemoState.mockRejectedValue(new Error('Unexpected crash'));

    const { POST } = await import('@/app/api/demo/reset/route');
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe('RESET_ERROR');
    expect(body.error.message).toBe('Unexpected crash');
  });

  it('calls resetAllDemoState exactly once', async () => {
    mockResetAllDemoState.mockResolvedValue({
      success: true,
      keysCleared: 0,
      resetAt: 4000,
    });

    const { POST } = await import('@/app/api/demo/reset/route');
    await POST();

    expect(mockResetAllDemoState).toHaveBeenCalledTimes(1);
  });
});
