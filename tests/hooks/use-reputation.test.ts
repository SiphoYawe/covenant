// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useDashboardStore } from '@/stores/dashboard';

describe('useReputation hook', () => {
  beforeEach(() => {
    useDashboardStore.setState(useDashboardStore.getInitialState());
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('fetches scores from /api/reputation/scores on mount', async () => {
    const mockResponse = {
      agents: [
        {
          agentId: '0xaaa',
          name: 'Researcher',
          role: 'researcher',
          score: 9.1,
        },
      ],
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }),
    );

    const { useReputation } = await import('@/hooks/use-reputation');
    const { result } = renderHook(() => useReputation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetch).toHaveBeenCalledWith('/api/reputation/scores');

    const agent = useDashboardStore.getState().agents['0xaaa'];
    expect(agent).toBeDefined();
    expect(agent.name).toBe('Researcher');
    expect(agent.reputationScore).toBe(9.1);
  });

  it('returns loading state while fetching', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => new Promise(() => {})),
    );

    const { useReputation } = await import('@/hooks/use-reputation');
    const { result } = renderHook(() => useReputation());

    expect(result.current.isLoading).toBe(true);
  });

  it('handles 404 gracefully (API not yet implemented)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }),
    );

    const { useReputation } = await import('@/hooks/use-reputation');
    const { result } = renderHook(() => useReputation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
  });

  it('returns error state on fetch failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    const { useReputation } = await import('@/hooks/use-reputation');
    const { result } = renderHook(() => useReputation());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toContain('500');
  });
});
