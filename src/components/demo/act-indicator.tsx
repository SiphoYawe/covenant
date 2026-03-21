'use client';

import { useDemoState } from '@/stores/dashboard';
import { DEMO_ACTS } from './types';

export function ActIndicator() {
  const demoState = useDemoState();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {DEMO_ACTS.map((act, index) => {
          const isComplete = demoState.currentAct >= act.number;
          const isCurrent = demoState.currentAct === act.number ||
            (demoState.currentAct === act.number - 1 && demoState.status === 'running');
          const isRunning = isCurrent && demoState.status === 'running';

          return (
            <div key={act.number} className="flex items-center flex-1">
              <div className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`
                    w-full h-2 rounded-full transition-all duration-500
                    ${isComplete
                      ? 'bg-score-excellent'
                      : isRunning
                        ? 'bg-primary animate-pulse'
                        : 'bg-border'}
                  `}
                />
                <span className={`
                  text-[10px] font-medium transition-colors
                  ${isComplete ? 'text-score-excellent' : isCurrent ? 'text-primary' : 'text-muted-foreground'}
                `}>
                  {act.number}
                </span>
              </div>

              {index < DEMO_ACTS.length - 1 && (
                <div className={`
                  w-2 h-0.5 mx-0.5
                  ${demoState.currentAct > act.number ? 'bg-score-excellent/50' : 'bg-border'}
                `} />
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center">
        {demoState.status === 'running' && demoState.currentAct > 0 && (
          <p className="text-sm text-primary">
            {DEMO_ACTS[demoState.currentAct - 1]?.label ?? `Act ${demoState.currentAct}`}
            <span className="text-muted-foreground ml-2">
              ~{DEMO_ACTS[demoState.currentAct - 1]?.estimatedDuration ?? 30}s
            </span>
          </p>
        )}
        {demoState.status === 'idle' && demoState.currentAct === 0 && (
          <p className="text-sm text-muted-foreground">Ready to begin</p>
        )}
        {demoState.status === 'complete' && (
          <p className="text-sm text-score-excellent">All 5 acts complete</p>
        )}
      </div>
    </div>
  );
}
