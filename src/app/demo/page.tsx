'use client';

import { useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useDemo, useLiveTrigger } from '@/hooks/use-demo';
import { useEvents } from '@/stores/dashboard';
import { LiveTriggerCard } from '@/components/demo/live-trigger-card';
import { LiveEventStream } from '@/components/demo/live-event-stream';
import { TriggerSummary } from '@/components/demo/trigger-summary';

const LIFECYCLE_STEPS = [
  { name: 'Discovery', protocol: 'a2a', duration: '~2s' },
  { name: 'Negotiation', protocol: 'covenant-ai', duration: '~5s' },
  { name: 'Payment', protocol: 'x402', duration: '~3s' },
  { name: 'Delivery + Civic L2', protocol: 'civic', duration: '~4s' },
  { name: 'Feedback', protocol: 'erc8004', duration: '~3s' },
  { name: 'Reputation Update', protocol: 'covenant-ai', duration: '~5s' },
];

const SYBIL_STEPS = [
  { name: 'Flag Evidence', protocol: 'covenant-ai', duration: '~2s' },
  { name: 'Graph Analysis', protocol: 'covenant-ai', duration: '~5s' },
  { name: 'Sybil Detection', protocol: 'covenant-ai', duration: '~5s' },
  { name: 'Score Cascade', protocol: 'covenant-ai', duration: '~4s' },
  { name: 'Explanation', protocol: 'covenant-ai', duration: '~4s' },
  { name: 'On-Chain Write-Back', protocol: 'erc8004', duration: '~3s' },
];

export default function DemoPage() {
  const { reset, isResetting, resetError } = useDemo();
  const lifecycle = useLiveTrigger('lifecycle');
  const sybilCascade = useLiveTrigger('sybil-cascade');
  const allEvents = useEvents();
  const [resetArmed, setResetArmed] = useState(false);

  // Filter live trigger events from all events
  const liveEvents = allEvents.filter(
    (e) => e.type.startsWith('live:'),
  );

  const handleReset = useCallback(async () => {
    if (!resetArmed) {
      setResetArmed(true);
      setTimeout(() => setResetArmed(false), 3000);
      return;
    }
    setResetArmed(false);
    lifecycle.reset();
    sybilCascade.reset();
    await reset();
  }, [resetArmed, reset, lifecycle, sybilCascade]);

  const anyExecuting = lifecycle.isExecuting || sybilCascade.isExecuting;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-8 h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Live Demo Triggers</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Execute real-time interactions on the seeded platform. Each trigger runs real protocol calls.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            disabled={isResetting || anyExecuting}
            className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-all shrink-0 ${
              resetArmed
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : isResetting || anyExecuting
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-muted text-foreground hover:bg-border'
            }`}
          >
            {isResetting ? 'Resetting...' : resetArmed ? 'Confirm Reset' : 'Re-seed'}
          </button>
        </div>

        {resetError && (
          <p className="text-xs text-score-critical">{resetError}</p>
        )}

        {/* Seed Status Bar */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Agents', value: '28', sub: 'registered' },
            { label: 'Transactions', value: '210+', sub: 'completed' },
            { label: 'USDC Volume', value: '$1,247', sub: 'settled' },
            { label: 'Sybil Ring', value: 'X2-X3-X4', sub: 'detected' },
          ].map((stat) => (
            <div key={stat.label} className="bg-card rounded-xl border border-border px-4 py-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              <p className="text-lg font-semibold text-foreground mt-0.5">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Two Trigger Cards Side-by-Side */}
        <div className="grid grid-cols-2 gap-4">
          <LiveTriggerCard
            title="Live: Execute Transaction"
            description="Full lifecycle: discovery, negotiation, x402 payment, Civic L2 inspection, feedback, reputation update"
            estimatedDuration={25}
            steps={LIFECYCLE_STEPS}
            isExecuting={lifecycle.isExecuting}
            onTrigger={() => {
              if (!anyExecuting) lifecycle.execute();
            }}
            result={lifecycle.result}
          />

          <LiveTriggerCard
            title="Live: Detect Threat"
            description="Sybil cascade: flag evidence, graph analysis, pattern detection, score drops, on-chain write-back"
            estimatedDuration={25}
            steps={SYBIL_STEPS}
            isExecuting={sybilCascade.isExecuting}
            onTrigger={() => {
              if (!anyExecuting) sybilCascade.execute();
            }}
            result={sybilCascade.result}
          />
        </div>

        {/* Trigger Summaries */}
        {lifecycle.result && (
          <TriggerSummary type="lifecycle" result={lifecycle.result} />
        )}
        {sybilCascade.result && (
          <TriggerSummary type="sybil-cascade" result={sybilCascade.result} />
        )}

        {/* Live Event Stream */}
        <LiveEventStream
          events={liveEvents}
          onClear={() => {
            lifecycle.reset();
            sybilCascade.reset();
          }}
        />

        {/* Error displays */}
        {lifecycle.error && (
          <p className="text-xs text-score-critical">Lifecycle error: {lifecycle.error}</p>
        )}
        {sybilCascade.error && (
          <p className="text-xs text-score-critical">Sybil cascade error: {sybilCascade.error}</p>
        )}
      </div>
    </AppLayout>
  );
}
