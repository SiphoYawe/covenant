'use client';

import { useState, useCallback } from 'react';
import { useDashboardStore } from '@/stores/dashboard';
import { useShallow } from 'zustand/react/shallow';
import { DemoAct, DemoStatus } from '@/lib/orchestrator';
import type { DemoResetResult } from '@/lib/orchestrator';

export function useDemo() {
  const demoState = useDashboardStore(useShallow((s) => s.demoState));
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

  const triggerAct = useCallback(async (actNumber: number) => {
    const res = await fetch(`/api/demo/${actNumber}`, { method: 'POST' });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error?.message ?? `Act ${actNumber} failed`);
    }
    return res.json();
  }, []);

  // Map numeric dashboard state to DemoAct enum for convenience
  const actMap: Record<number, DemoAct> = {
    0: DemoAct.Idle,
    1: DemoAct.Registration,
    2: DemoAct.EconomyWorks,
    3: DemoAct.VillainAttacks,
    4: DemoAct.Consequences,
    5: DemoAct.Payoff,
  };

  const currentAct = actMap[demoState.currentAct] ?? DemoAct.Idle;
  const isRunning = demoState.status === 'running';
  const isIdle = demoState.status === 'idle';

  return {
    demoState,
    currentAct,
    isRunning,
    isIdle,
    isResetting,
    resetError,
    reset,
    triggerAct,
  };
}
