'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useDemo } from '@/hooks/use-demo';
import { useDemoState } from '@/stores/dashboard';
import {
  DEMO_ACTS,
  DEFAULT_AUTO_PLAY_DELAY,
  MIN_AUTO_PLAY_DELAY,
  MAX_AUTO_PLAY_DELAY,
} from './types';
import type { ActStatus, AutoPlayConfig } from './types';

function getActStatus(actNumber: number, currentAct: number, demoStatus: string): ActStatus {
  if (currentAct === actNumber && demoStatus === 'running') return 'running';
  if (currentAct >= actNumber) return 'complete';
  return 'pending';
}

function StatusBadge({ status }: { status: ActStatus }) {
  const styles: Record<ActStatus, string> = {
    pending: 'bg-secondary text-muted-foreground',
    running: 'bg-primary/20 text-primary animate-pulse',
    complete: 'bg-score-excellent/20 text-score-excellent',
    error: 'bg-score-critical/20 text-score-critical',
  };
  const labels: Record<ActStatus, string> = {
    pending: 'Pending',
    running: 'Running...',
    complete: 'Complete',
    error: 'Error',
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export function DemoController() {
  const { triggerAct } = useDemo();
  const demoState = useDemoState();
  const [runningAct, setRunningAct] = useState<number | null>(null);
  const [actErrors, setActErrors] = useState<Record<number, string>>({});
  const [autoPlay, setAutoPlay] = useState<AutoPlayConfig>({
    enabled: false,
    delayMs: DEFAULT_AUTO_PLAY_DELAY,
  });
  const autoPlayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTriggerAct = useCallback(async (actNumber: number) => {
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
  }, [triggerAct]);

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

  useEffect(() => {
    return () => {
      if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Auto-play controls */}
      <div className="flex items-center gap-4 p-4 rounded-3xl bg-card border border-border">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoPlay.enabled}
            onChange={(e) => {
              setAutoPlay((prev) => ({ ...prev, enabled: e.target.checked }));
              if (!e.target.checked && autoPlayRef.current) {
                clearTimeout(autoPlayRef.current);
              }
            }}
            className="w-4 h-4 rounded bg-secondary border-border text-primary focus:ring-primary"
          />
          <span className="text-sm font-medium text-foreground">Auto-Play</span>
        </label>

        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-muted-foreground">{(autoPlay.delayMs / 1000).toFixed(1)}s</span>
          <input
            type="range"
            min={MIN_AUTO_PLAY_DELAY}
            max={MAX_AUTO_PLAY_DELAY}
            step={500}
            value={autoPlay.delayMs}
            onChange={(e) => setAutoPlay((prev) => ({ ...prev, delayMs: Number(e.target.value) }))}
            className="flex-1 h-1 bg-border rounded-full appearance-none cursor-pointer accent-primary"
          />
          <span className="text-xs text-muted-foreground">{(MAX_AUTO_PLAY_DELAY / 1000).toFixed(0)}s</span>
        </div>

        {autoPlay.enabled && runningAct === null && demoState.currentAct < 5 && (
          <span className="text-xs text-primary animate-pulse">
            Auto-playing...
          </span>
        )}
      </div>

      {/* Act buttons */}
      <div className="grid gap-3">
        {DEMO_ACTS.map((act) => {
          const status = actErrors[act.number]
            ? 'error' as ActStatus
            : runningAct === act.number
              ? 'running' as ActStatus
              : getActStatus(act.number, demoState.currentAct, demoState.status);
          const isDisabled = runningAct !== null || status === 'running';
          const isNextAct = act.number === demoState.currentAct + 1;

          return (
            <button
              key={act.number}
              onClick={() => handleTriggerAct(act.number)}
              disabled={isDisabled}
              className={`
                relative p-4 rounded-3xl border text-left transition-all duration-200
                ${status === 'complete'
                  ? 'bg-score-excellent/5 border-score-excellent/30 hover:border-score-excellent/50'
                  : status === 'running'
                    ? 'bg-primary/5 border-primary/50'
                    : status === 'error'
                      ? 'bg-score-critical/5 border-score-critical/30 hover:border-score-critical/50'
                      : isNextAct
                        ? 'bg-card border-border hover:border-primary/50 cursor-pointer'
                        : 'bg-card/50 border-border/50 opacity-60'}
                ${isDisabled ? 'cursor-not-allowed' : ''}
              `}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{act.label}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">~{act.estimatedDuration}s</p>
                </div>
                <StatusBadge status={status} />
              </div>

              {actErrors[act.number] && (
                <p className="text-xs text-score-critical mt-2">{actErrors[act.number]}</p>
              )}

              {status === 'running' && (
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-primary/30 rounded-b-3xl overflow-hidden">
                  <div className="h-full w-1/3 bg-primary animate-[slide_1.5s_ease-in-out_infinite]" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
