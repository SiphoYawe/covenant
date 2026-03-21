// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// --- Mock Zustand store ---

const mockResetDemo = vi.fn();

vi.mock('@/stores/dashboard', () => ({
  useDashboardStore: (selector: (state: Record<string, unknown>) => unknown) => {
    const state = {
      resetDemo: mockResetDemo,
      events: [],
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
});

describe('useLiveTrigger hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns initial idle state', async () => {
    const { useLiveTrigger } = await import('@/hooks/use-demo');
    const { result } = renderHook(() => useLiveTrigger('lifecycle'));

    expect(result.current.isExecuting).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('sets isExecuting during trigger execution', async () => {
    let resolveRequest: (value: unknown) => void;
    mockFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const { useLiveTrigger } = await import('@/hooks/use-demo');
    const { result } = renderHook(() => useLiveTrigger('lifecycle'));

    let executePromise: Promise<void>;
    act(() => {
      executePromise = result.current.execute();
    });

    expect(result.current.isExecuting).toBe(true);

    await act(async () => {
      resolveRequest!({
        ok: true,
        json: async () => ({ success: true, steps: [] }),
      });
      await executePromise!;
    });

    expect(result.current.isExecuting).toBe(false);
  });

  it('stores result after successful execution', async () => {
    const mockResult = {
      success: true,
      requesterId: 'seed-R1',
      providerId: 'seed-S2',
      negotiatedPrice: 12,
      steps: [],
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResult,
    });

    const { useLiveTrigger } = await import('@/hooks/use-demo');
    const { result } = renderHook(() => useLiveTrigger('lifecycle'));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.result).toEqual(mockResult);
    expect(result.current.error).toBeNull();
  });

  it('stores error on failed execution', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Trigger failed' } }),
    });

    const { useLiveTrigger } = await import('@/hooks/use-demo');
    const { result } = renderHook(() => useLiveTrigger('lifecycle'));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.error).toBe('Trigger failed');
    expect(result.current.result).toBeNull();
  });

  it('calls correct API endpoint for lifecycle', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { useLiveTrigger } = await import('@/hooks/use-demo');
    const { result } = renderHook(() => useLiveTrigger('lifecycle'));

    await act(async () => {
      await result.current.execute();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/demo/live/lifecycle', { method: 'POST' });
  });

  it('calls correct API endpoint for sybil-cascade', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { useLiveTrigger } = await import('@/hooks/use-demo');
    const { result } = renderHook(() => useLiveTrigger('sybil-cascade'));

    await act(async () => {
      await result.current.execute();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/demo/live/sybil-cascade', { method: 'POST' });
  });

  it('reset clears result and error', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const { useLiveTrigger } = await import('@/hooks/use-demo');
    const { result } = renderHook(() => useLiveTrigger('lifecycle'));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.result).toBeTruthy();

    act(() => {
      result.current.reset();
    });

    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
