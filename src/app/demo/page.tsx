'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useDemo } from '@/hooks/use-demo';
import { useDemoState } from '@/stores/dashboard';
import {
  DEMO_ACTS,
  DEFAULT_AUTO_PLAY_DELAY,
  MIN_AUTO_PLAY_DELAY,
  MAX_AUTO_PLAY_DELAY,
} from '@/components/demo/types';
import type { ActStatus, AutoPlayConfig } from '@/components/demo/types';

function getActStatus(actNumber: number, currentAct: number, demoStatus: string): ActStatus {
  if (currentAct === actNumber && demoStatus === 'running') return 'running';
  if (currentAct >= actNumber) return 'complete';
  return 'pending';
}

export default function DemoPage() {
  const { reset, isResetting, resetError, triggerAct } = useDemo();
  const demoState = useDemoState();
  const [resetArmed, setResetArmed] = useState(false);
  const [runningAct, setRunningAct] = useState<number | null>(null);
  const [actErrors, setActErrors] = useState<Record<number, string>>({});
  const [autoPlay, setAutoPlay] = useState<AutoPlayConfig>({
    enabled: false,
    delayMs: DEFAULT_AUTO_PLAY_DELAY,
  });
  const autoPlayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleReset = useCallback(async () => {
    if (!resetArmed) {
      setResetArmed(true);
      setTimeout(() => setResetArmed(false), 3000);
      return;
    }
    setResetArmed(false);
    await reset();
  }, [resetArmed, reset]);

  const handleTriggerAct = useCallback(
    async (actNumber: number) => {
      setRunningAct(actNumber);
      setActErrors((prev) => ({ ...prev, [actNumber]: '' }));
      try {
        await triggerAct(actNumber);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed';
        setActErrors((prev) => ({ ...prev, [actNumber]: message }));
        setAutoPlay((prev) => ({ ...prev, enabled: false }));
      } finally {
        setRunningAct(null);
      }
    },
    [triggerAct],
  );

  // Auto-play logic
  useEffect(() => {
    if (!autoPlay.enabled || runningAct !== null) return;

    const nextAct = demoState.currentAct + 1;
    if (nextAct > 5) {
      setAutoPlay((prev) => ({ ...prev, enabled: false }));
      return;
    }

    autoPlayRef.current = setTimeout(() => {
      handleTriggerAct(nextAct);
    }, autoPlay.delayMs);

    return () => {
      if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    };
  }, [autoPlay.enabled, autoPlay.delayMs, demoState.currentAct, runningAct, handleTriggerAct]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    };
  }, []);

  const canStart = demoState.currentAct === 0 && demoState.status === 'idle';

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-8 h-full">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">5-Act Demo Sequence</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Watch AI agents collaborate, face an attack, and see reputation enforcement in action.
          </p>
        </div>

        {/* Act progress indicator */}
        <div className="flex items-center px-4">
          {DEMO_ACTS.map((act, index) => {
            const status = getActStatus(act.number, demoState.currentAct, demoState.status);
            const isActive = status === 'running' || status === 'complete';

            return (
              <div key={act.number} className="flex items-center flex-1 last:flex-none">
                {/* Circle */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-border text-muted-foreground'
                  }`}
                >
                  {act.number}
                </div>
                {/* Line between */}
                {index < DEMO_ACTS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 transition-colors ${
                      demoState.currentAct > act.number ? 'bg-primary' : 'bg-border'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Act cards */}
        <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
          {DEMO_ACTS.map((act) => {
            const status = actErrors[act.number]
              ? ('error' as ActStatus)
              : runningAct === act.number
                ? ('running' as ActStatus)
                : getActStatus(act.number, demoState.currentAct, demoState.status);
            const isDisabled = runningAct !== null || status === 'running';
            const isNextAct = act.number === demoState.currentAct + 1;

            return (
              <button
                key={act.number}
                type="button"
                onClick={() => handleTriggerAct(act.number)}
                disabled={isDisabled}
                className={`bg-card rounded-3xl border border-border px-5 py-4 flex items-center gap-4 text-left transition-all ${
                  isDisabled ? 'cursor-not-allowed opacity-70' : isNextAct ? 'cursor-pointer hover:border-primary/50' : ''
                }`}
              >
                {/* Status dot */}
                <div
                  className={`w-3 h-3 rounded-full shrink-0 transition-colors ${
                    status === 'complete'
                      ? 'bg-score-excellent'
                      : status === 'running'
                        ? 'bg-primary animate-pulse'
                        : status === 'error'
                          ? 'bg-score-critical'
                          : 'bg-border'
                  }`}
                />

                {/* Act name */}
                <span
                  className={`flex-1 text-sm font-medium ${
                    status === 'pending' ? 'text-muted-foreground' : 'text-foreground'
                  }`}
                >
                  {act.label}
                  <span className="text-muted-foreground ml-2 text-xs">~{act.estimatedDuration}s</span>
                </span>

                {/* Status badge */}
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    status === 'complete'
                      ? 'bg-score-excellent/20 text-score-excellent'
                      : status === 'running'
                        ? 'bg-primary/20 text-primary animate-pulse'
                        : status === 'error'
                          ? 'bg-score-critical/20 text-score-critical'
                          : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {status === 'complete'
                    ? 'Complete'
                    : status === 'running'
                      ? 'Running'
                      : status === 'error'
                        ? 'Error'
                        : 'Pending'}
                </span>

                {/* Error message */}
                {actErrors[act.number] && (
                  <span className="text-xs text-score-critical ml-2">{actErrors[act.number]}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Controls row */}
        <div className="flex justify-between items-center pt-2 border-t border-border">
          {/* Start Demo button */}
          <button
            type="button"
            onClick={() => {
              if (canStart) handleTriggerAct(1);
            }}
            disabled={!canStart || runningAct !== null}
            className={`rounded-full px-6 py-3 text-sm font-medium transition-colors ${
              canStart
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-secondary text-muted-foreground cursor-not-allowed'
            }`}
          >
            {demoState.status === 'complete' ? 'Demo Complete' : canStart ? 'Start Demo' : `Act ${demoState.currentAct}/5`}
          </button>

          {/* Auto-play toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => {
                setAutoPlay((prev) => {
                  const next = !prev.enabled;
                  if (!next && autoPlayRef.current) {
                    clearTimeout(autoPlayRef.current);
                  }
                  return { ...prev, enabled: next };
                });
              }}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                autoPlay.enabled ? 'bg-primary' : 'bg-border'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-foreground transition-transform ${
                  autoPlay.enabled ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </div>
            <span className="text-sm text-muted-foreground">
              Auto-play
              {autoPlay.enabled && (
                <span className="text-primary ml-1">({(autoPlay.delayMs / 1000).toFixed(0)}s)</span>
              )}
            </span>
          </label>

          {/* Reset button */}
          <button
            type="button"
            onClick={handleReset}
            disabled={isResetting}
            className={`rounded-full px-6 py-3 text-sm font-medium transition-all ${
              resetArmed
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : isResetting
                  ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                  : 'bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground border border-destructive/30'
            }`}
          >
            {isResetting ? 'Resetting...' : resetArmed ? 'Confirm Reset?' : 'Reset Demo'}
          </button>
        </div>

        {resetError && (
          <p className="text-xs text-score-critical text-center">{resetError}</p>
        )}
      </div>
    </AppLayout>
  );
}
