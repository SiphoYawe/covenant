'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <header className="text-center space-y-3">
          <Image
            src="/covenant-logo-light-text.svg"
            alt="Covenant"
            width={180}
            height={40}
            className="mx-auto"
            priority
          />
          <h1 className="text-2xl font-semibold tracking-tight">
            5-Act Demo Sequence
          </h1>
          <p className="text-sm text-muted-foreground">
            Watch AI agents collaborate, face an attack, and see reputation enforcement in action.
          </p>
        </header>

        {/* Act Indicator (progress) */}
        <ActIndicator />

        {/* Demo Status */}
        <DemoStatus />

        {/* Demo Controller (act buttons + auto-play) */}
        <DemoController />

        {/* Reset section */}
        <div className="pt-4 border-t border-border">
          <button
            onClick={handleReset}
            disabled={isResetting}
            className={`
              w-full py-3 rounded-full text-sm font-medium transition-all duration-200
              ${resetArmed
                ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                : isResetting
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-card hover:bg-secondary text-error-foreground border border-border hover:border-destructive/30'}
            `}
          >
            {isResetting
              ? 'Resetting...'
              : resetArmed
                ? 'Confirm Reset?'
                : 'Reset Demo'}
          </button>

          {resetError && (
            <p className="text-xs text-error-foreground text-center mt-2">{resetError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
