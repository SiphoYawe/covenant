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
    pending: 'bg-zinc-700 text-zinc-400',
    running: 'bg-amber-500/20 text-amber-400 animate-pulse',
    complete: 'bg-emerald-500/20 text-emerald-400',
    error: 'bg-red-500/20 text-red-400',
  };
  const labels: Record<ActStatus, string> = {
    pending: 'Pending',
    running: 'Running...',
    complete: 'Complete',
    error: 'Error',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
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
      // Disable auto-play on error
      setAutoPlay((prev) => ({ ...prev, enabled: false }));
    } finally {
      setRunningAct(null);
    }
  }, [triggerAct]);

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

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Auto-play controls */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
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
            className="w-4 h-4 rounded bg-zinc-700 border-zinc-600 text-amber-500 focus:ring-amber-500"
          />
          <span className="text-sm font-medium text-zinc-300">Auto-Play</span>
        </label>

        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-zinc-500">{(autoPlay.delayMs / 1000).toFixed(1)}s</span>
          <input
            type="range"
            min={MIN_AUTO_PLAY_DELAY}
            max={MAX_AUTO_PLAY_DELAY}
            step={500}
            value={autoPlay.delayMs}
            onChange={(e) => setAutoPlay((prev) => ({ ...prev, delayMs: Number(e.target.value) }))}
            className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <span className="text-xs text-zinc-500">{(MAX_AUTO_PLAY_DELAY / 1000).toFixed(0)}s</span>
        </div>

        {autoPlay.enabled && runningAct === null && demoState.currentAct < 5 && (
          <span className="text-xs text-amber-400 animate-pulse">
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
                relative p-4 rounded-lg border text-left transition-all duration-200
                ${status === 'complete'
                  ? 'bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/50'
                  : status === 'running'
                    ? 'bg-amber-500/5 border-amber-500/50'
                    : status === 'error'
                      ? 'bg-red-500/5 border-red-500/30 hover:border-red-500/50'
                      : isNextAct
                        ? 'bg-zinc-800 border-zinc-600 hover:border-zinc-500 hover:bg-zinc-700/50 cursor-pointer'
                        : 'bg-zinc-800/50 border-zinc-700/50 opacity-60'}
                ${isDisabled ? 'cursor-not-allowed' : ''}
              `}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">{act.label}</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">~{act.estimatedDuration}s</p>
                </div>
                <StatusBadge status={status} />
              </div>

              {actErrors[act.number] && (
                <p className="text-xs text-red-400 mt-2">{actErrors[act.number]}</p>
              )}

              {status === 'running' && (
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-amber-500/30 rounded-b-lg overflow-hidden">
                  <div className="h-full w-1/3 bg-amber-500 animate-[slide_1.5s_ease-in-out_infinite]" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
