'use client';

import { useState, useCallback } from 'react';
import { DemoController, ActIndicator, DemoStatus } from '@/components/demo';
import { useDemo } from '@/hooks/use-demo';

export default function DemoPage() {
  const { reset, isResetting, resetError } = useDemo();
  const [resetArmed, setResetArmed] = useState(false);

  const handleReset = useCallback(async () => {
    if (!resetArmed) {
      setResetArmed(true);
      // Auto-disarm after 3 seconds
      setTimeout(() => setResetArmed(false), 3000);
      return;
    }
    setResetArmed(false);
    await reset();
  }, [resetArmed, reset]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <header className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Covenant Demo Operator
          </h1>
          <p className="text-sm text-zinc-500">
            Control the 5-act demo narrative
          </p>
        </header>

        {/* Act Indicator (progress) */}
        <ActIndicator />

        {/* Demo Status */}
        <DemoStatus />

        {/* Demo Controller (act buttons + auto-play) */}
        <DemoController />

        {/* Reset section */}
        <div className="pt-4 border-t border-zinc-800">
          <button
            onClick={handleReset}
            disabled={isResetting}
            className={`
              w-full py-3 rounded-lg text-sm font-medium transition-all duration-200
              ${resetArmed
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : isResetting
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-red-400 border border-zinc-700 hover:border-red-500/30'}
            `}
          >
            {isResetting
              ? 'Resetting...'
              : resetArmed
                ? 'Confirm Reset?'
                : 'Reset Demo'}
          </button>

          {resetError && (
            <p className="text-xs text-red-400 text-center mt-2">{resetError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
