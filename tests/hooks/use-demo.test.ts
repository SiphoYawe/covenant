// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { DemoAct } from '@/lib/orchestrator/types';

// --- Mock Zustand store ---

const mockResetDemo = vi.fn();
let mockDemoState = { currentAct: 0, status: 'idle' as const };

vi.mock('@/stores/dashboard', () => ({
  useDashboardStore: (selector: (state: Record<string, unknown>) => unknown) => {
    const state = {
      demoState: mockDemoState,
      resetDemo: mockResetDemo,
    };
    return selector(state);
  },
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: (fn: (state: unknown) => unknown) => fn,
}));

// --- Mock fetch ---

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useDemo hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDemoState = { currentAct: 0, status: 'idle' };
  });

  it('returns current demo state from Zustand store', async () => {
    const { useDemo } = await import('@/hooks/use-demo');
    const { result } = renderHook(() => useDemo());

    expect(result.current.demoState).toEqual({ currentAct: 0, status: 'idle' });
  });

  it('convenience accessor currentAct derives correctly from state', async () => {
    mockDemoState = { currentAct: 3, status: 'running' };
    const { useDemo } = await import('@/hooks/use-demo');
    const { result } = renderHook(() => useDemo());

    expect(result.current.currentAct).toBe(DemoAct.VillainAttacks);
  });

  it('isRunning returns true only when status is running', async () => {
    mockDemoState = { currentAct: 2, status: 'running' };
    const { useDemo } = await import('@/hooks/use-demo');
    const { result } = renderHook(() => useDemo());

    expect(result.current.isRunning).toBe(true);
    expect(result.current.isIdle).toBe(false);
  });

  it('isIdle returns true when status is idle', async () => {
    const { useDemo } = await import('@/hooks/use-demo');
    const { result } = renderHook(() => useDemo());

    expect(result.current.isIdle).toBe(true);
    expect(result.current.isRunning).toBe(false);
  });

  it('reset() calls POST /api/demo/reset and then Zustand resetDemo()', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, keysCleared: 5, resetAt: 1000 }),
    });

    const { useDemo } = await import('@/hooks/use-demo');
    const { result } = renderHook(() => useDemo());

    await act(async () => {
      await result.current.reset();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/demo/reset', { method: 'POST' });
    expect(mockResetDemo).toHaveBeenCalled();
  });

  it('reset() sets isResetting during API call', async () => {
    let resolvePromise: (value: unknown) => void;
    mockFetch.mockReturnValue(
      new Promise((resolve) => { resolvePromise = resolve; }),
    );

    const { useDemo } = await import('@/hooks/use-demo');
    const { result } = renderHook(() => useDemo());

    // Start reset (don't await)
    let resetPromise: Promise<void>;
    act(() => {
      resetPromise = result.current.reset();
    });

    // isResetting should be true while API call is in flight
    expect(result.current.isResetting).toBe(true);

    // Resolve the fetch
    await act(async () => {
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ success: true, keysCleared: 0, resetAt: 1000 }),
      });
      await resetPromise!;
    });

    expect(result.current.isResetting).toBe(false);
  });

  it('reset() sets resetError on API failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Server error' } }),
    });

    const { useDemo } = await import('@/hooks/use-demo');
    const { result } = renderHook(() => useDemo());

    await act(async () => {
      await result.current.reset();
    });

    expect(result.current.resetError).toBe('Server error');
    expect(mockResetDemo).not.toHaveBeenCalled();
  });

  it('reset() clears previous resetError on new attempt', async () => {
    // First call fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'First error' } }),
    });

    const { useDemo } = await import('@/hooks/use-demo');
    const { result } = renderHook(() => useDemo());

    await act(async () => {
      await result.current.reset();
    });
    expect(result.current.resetError).toBe('First error');

    // Second call succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, keysCleared: 0, resetAt: 2000 }),
    });

    await act(async () => {
      await result.current.reset();
    });
    expect(result.current.resetError).toBeNull();
  });

  it('triggerAct calls POST /api/demo/:actNumber', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ act: 1, status: 'completed' }),
    });

    const { useDemo } = await import('@/hooks/use-demo');
    const { result } = renderHook(() => useDemo());

    await act(async () => {
      await result.current.triggerAct(1);
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/demo/1', { method: 'POST' });
  });
});
