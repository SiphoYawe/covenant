'use client';

import { useMemo } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useEvents as useDashboardEvents } from '@/stores/dashboard';
import { formatTimestamp } from '@/components/dashboard/feed-utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { User02Icon, Alert02Icon, CancelCircleIcon, SecurityCheckIcon } from '@hugeicons/core-free-icons';

export default function CivicGuardsPage() {
  const events = useDashboardEvents();

  const civicEvents = useMemo(() => {
    return events.filter(
      (e) =>
        e.type === 'civic.flagged' ||
        e.type === 'civic.verified' ||
        e.type === 'civic.identity_check' ||
        e.protocol === ('civic' as typeof e.protocol),
    );
  }, [events]);

  const allGuardEvents = useMemo(() => {
    return events.filter(
      (e) =>
        e.type.startsWith('civic.') ||
        e.protocol === ('civic' as typeof e.protocol) ||
        e.type === 'task.rejected' ||
        e.type === 'sybil.detected',
    ).slice(0, 30);
  }, [events]);

  function getEventIcon(type: string) {
    if (type === 'civic.flagged' || type === 'sybil.detected' || type === 'task.rejected') {
      return { icon: 'shield-x', color: 'text-score-critical' };
    }
    if (type.includes('warning') || type.includes('suspicious')) {
      return { icon: 'shield-alert', color: 'text-score-moderate' };
    }
    return { icon: 'shield-check', color: 'text-score-excellent' };
  }

  function getEventText(event: typeof events[0]): string {
    const data = event.data;
    switch (event.type) {
      case 'civic.flagged':
        return `BLOCKED: ${data.reason || 'Civic guardrail violation detected'}`;
      case 'civic.verified':
        return `Identity verified for ${data.name || event.agentId || 'agent'}`;
      case 'task.rejected':
        return `Task rejected: ${data.reason || 'Failed Civic validation'}`;
      case 'sybil.detected':
        return `Sybil detection triggered for ${data.name || event.agentId || 'agent'}`;
      default:
        return (data.description as string) || (data.reason as string) || event.type;
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-8 h-full">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-foreground">Civic Guardrails</h1>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-score-excellent" />
            <span className="text-sm text-score-excellent font-medium">MCP Connected</span>
          </div>
        </div>

        {/* Guard type cards */}
        <div className="flex gap-4">
          <div className="flex-1 bg-card rounded-3xl border border-border p-5">
            <div className="flex items-center gap-2 mb-2">
              <HugeiconsIcon icon={User02Icon} size={20} className="text-primary" />
              <span className="text-[15px] font-semibold text-foreground">Identity Verification</span>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Verifies agent wallet ownership and identity claims via Civic Auth before allowing ERC-8004 registration.
            </p>
          </div>

          <div className="flex-1 bg-card rounded-3xl border border-border p-5">
            <div className="flex items-center gap-2 mb-2">
              <HugeiconsIcon icon={Alert02Icon} size={20} className="text-score-moderate" />
              <span className="text-[15px] font-semibold text-foreground">Behavioral Analysis</span>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Monitors agent interactions for malicious patterns, prompt injection, and anomalous behavior via MCP guardrails.
            </p>
          </div>
        </div>

        {/* Guard event log */}
        <div className="flex-1 bg-card rounded-3xl border border-border overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Guardrail Events</h2>
            <span className="text-xs text-muted-foreground">{allGuardEvents.length} events</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {allGuardEvents.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                No guardrail events yet. Run the demo to trigger Civic checks.
              </div>
            ) : (
              allGuardEvents.map((event, i) => {
                const { color } = getEventIcon(event.type);
                const text = getEventText(event);
                const isBad = event.type === 'civic.flagged' || event.type === 'sybil.detected' || event.type === 'task.rejected';

                return (
                  <div
                    key={`${event.type}-${event.timestamp}-${i}`}
                    className="flex items-center gap-3 px-5 py-3 border-b border-border"
                  >
                    <HugeiconsIcon
                      icon={isBad ? CancelCircleIcon : SecurityCheckIcon}
                      size={16}
                      className={`shrink-0 ${color}`}
                    />
                    <span className={`flex-1 text-[13px] ${isBad ? color : 'text-foreground'}`}>
                      {text}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatTimestamp(event.timestamp)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
