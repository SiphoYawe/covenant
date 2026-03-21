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
    <div className="flex items-center justify-between p-4 rounded-3xl bg-card border border-border">
      <div className="flex items-center gap-3">
        {demoState.status === 'idle' && demoState.currentAct === 0 && (
          <>
            <div className="w-3 h-3 rounded-full bg-muted-foreground" />
            <span className="text-sm text-muted-foreground">Ready to Demo</span>
          </>
        )}
        {demoState.status === 'running' && (
          <>
            <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-primary">
              Act {demoState.currentAct} Running...
            </span>
          </>
        )}
        {(demoState.status === 'idle' && demoState.currentAct > 0 && demoState.currentAct < 5) && (
          <>
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-sm text-primary">
              {completedCount}/5 acts complete
            </span>
          </>
        )}
        {(demoState.status === 'complete' || demoState.currentAct >= 5) && (
          <>
            <div className="w-3 h-3 rounded-full bg-score-excellent" />
            <span className="text-sm text-score-excellent">Demo Complete!</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{completedCount}/5 acts</span>
        {elapsed > 0 && <span>{formatTime(elapsed)}</span>}
      </div>
    </div>
  );
}
