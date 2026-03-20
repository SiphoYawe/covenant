'use client';

import { useEffect, useRef, useState } from 'react';
import { useDemoState } from '@/stores/dashboard';

export function DemoStatus() {
  const demoState = useDemoState();
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (demoState.status === 'running') {
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 1000);
    } else if (demoState.status === 'idle' && demoState.currentAct === 0) {
      // Reset elapsed on full reset
      startTimeRef.current = null;
      setElapsed(0);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [demoState.status, demoState.currentAct]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const completedCount = demoState.currentAct;

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
      {/* Status badge and text */}
      <div className="flex items-center gap-3">
        {demoState.status === 'idle' && demoState.currentAct === 0 && (
          <>
            <div className="w-3 h-3 rounded-full bg-zinc-500" />
            <span className="text-sm text-zinc-400">Ready to Demo</span>
          </>
        )}
        {demoState.status === 'running' && (
          <>
            <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm text-amber-400">
              Act {demoState.currentAct} Running...
            </span>
          </>
        )}
        {(demoState.status === 'idle' && demoState.currentAct > 0 && demoState.currentAct < 5) && (
          <>
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-sm text-blue-400">
              {completedCount}/5 acts complete
            </span>
          </>
        )}
        {(demoState.status === 'complete' || demoState.currentAct >= 5) && (
          <>
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-sm text-emerald-400">Demo Complete!</span>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span>{completedCount}/5 acts</span>
        {elapsed > 0 && <span>{formatTime(elapsed)}</span>}
      </div>
    </div>
  );
}
