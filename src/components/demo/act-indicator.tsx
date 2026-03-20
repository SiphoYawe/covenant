'use client';

import { useDemoState } from '@/stores/dashboard';
import { DEMO_ACTS } from './types';

export function ActIndicator() {
  const demoState = useDemoState();

  return (
    <div className="space-y-3">
      {/* Progress segments */}
      <div className="flex items-center gap-1">
        {DEMO_ACTS.map((act, index) => {
          const isComplete = demoState.currentAct >= act.number;
          const isCurrent = demoState.currentAct === act.number ||
            (demoState.currentAct === act.number - 1 && demoState.status === 'running');
          const isRunning = isCurrent && demoState.status === 'running';

          return (
            <div key={act.number} className="flex items-center flex-1">
              {/* Segment */}
              <div className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`
                    w-full h-2 rounded-full transition-all duration-500
                    ${isComplete
                      ? 'bg-emerald-500'
                      : isRunning
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-zinc-700'}
                  `}
                />
                <span className={`
                  text-[10px] font-medium transition-colors
                  ${isComplete ? 'text-emerald-400' : isCurrent ? 'text-amber-400' : 'text-zinc-600'}
                `}>
                  {act.number}
                </span>
              </div>

              {/* Connector */}
              {index < DEMO_ACTS.length - 1 && (
                <div className={`
                  w-2 h-0.5 mx-0.5
                  ${demoState.currentAct > act.number ? 'bg-emerald-500/50' : 'bg-zinc-700'}
                `} />
              )}
            </div>
          );
        })}
      </div>

      {/* Current act info */}
      <div className="text-center">
        {demoState.status === 'running' && demoState.currentAct > 0 && (
          <p className="text-sm text-amber-400">
            {DEMO_ACTS[demoState.currentAct - 1]?.label ?? `Act ${demoState.currentAct}`}
            <span className="text-zinc-500 ml-2">
              ~{DEMO_ACTS[demoState.currentAct - 1]?.estimatedDuration ?? 30}s
            </span>
          </p>
        )}
        {demoState.status === 'idle' && demoState.currentAct === 0 && (
          <p className="text-sm text-zinc-500">Ready to begin</p>
        )}
        {demoState.status === 'complete' && (
          <p className="text-sm text-emerald-400">All 5 acts complete</p>
        )}
      </div>
    </div>
  );
}
