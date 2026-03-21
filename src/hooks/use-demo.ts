'use client';

import { useState, useCallback } from 'react';
import { useDashboardStore } from '@/stores/dashboard';

type DemoResetResult = {
  success: boolean;
  keysCleared: number;
  resetAt: number;
  error?: string;
};

export function useDemo() {
  const resetStore = useDashboardStore((s) => s.resetDemo);

  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const reset = useCallback(async () => {
    setIsResetting(true);
    setResetError(null);
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error?.message ?? 'Reset failed');
      }
      const result: DemoResetResult = await res.json();
      if (!result.success) {
        throw new Error(result.error ?? 'Reset failed');
      }
      resetStore();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reset failed';
      setResetError(message);
    } finally {
      setIsResetting(false);
    }
  }, [resetStore]);

  return {
    isResetting,
    resetError,
    reset,
  };
}

// --- Live Trigger Hook ---

type LiveTriggerType = 'lifecycle' | 'sybil-cascade';

const TRIGGER_ENDPOINTS: Record<LiveTriggerType, string> = {
  lifecycle: '/api/demo/live/lifecycle',
  'sybil-cascade': '/api/demo/live/sybil-cascade',
};

export function useLiveTrigger(type: LiveTriggerType) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const events = useDashboardStore((s) =>
    s.events.filter(
      (e) =>
        e.type.startsWith('live:') &&
        (e.data as Record<string, unknown>).triggerType === type,
    ),
  );

  const execute = useCallback(async () => {
    setIsExecuting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(TRIGGER_ENDPOINTS[type], { method: 'POST' });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error?.message ?? `${type} trigger failed`);
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Trigger failed';
      setError(message);
    } finally {
      setIsExecuting(false);
    }
  }, [type]);

  const resetTrigger = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { execute, isExecuting, result, error, events, reset: resetTrigger };
}
