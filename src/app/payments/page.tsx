'use client';

import { useMemo } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAgents, useEdges, useMetrics } from '@/stores/dashboard';
import { useEvents as useDashboardEvents } from '@/stores/dashboard';
import { formatUSDCCompact } from '@/components/dashboard/metrics-utils';
import { formatTimestamp } from '@/components/dashboard/feed-utils';

type MetricCardProps = {
  label: string;
  value: string;
  valueColor?: string;
};

function MetricCard({ label, value, valueColor }: MetricCardProps) {
  return (
    <div className="flex-1 bg-card rounded-3xl border border-border p-5">
      <span className="text-muted-foreground text-[13px] font-medium">{label}</span>
      <div className="mt-1">
        <span className={`text-[24px] font-bold leading-tight ${valueColor ?? 'text-foreground'}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  const metrics = useMetrics();
  const agents = useAgents();
  const edges = useEdges();
  const events = useDashboardEvents();

  const successRate = useMemo(() => {
    if (metrics.totalTransactions === 0) return 100;
    const failed = Object.values(agents).filter((a) => a.civicFlagged).length;
    return Math.max(0, ((metrics.totalTransactions - failed) / metrics.totalTransactions) * 100);
  }, [metrics.totalTransactions, agents]);

  const paymentEvents = useMemo(() => {
    return events
      .filter((e) => e.type === 'payment.settled' || e.type === 'task.negotiated')
      .slice(0, 20);
  }, [events]);

  const getAgentName = (id: string) => agents[id]?.name || id.slice(0, 10);

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-8 h-full">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-foreground">Payment History (x402)</h1>
        </div>

        {/* Metrics */}
        <div className="flex gap-4">
          <MetricCard
            label="Total Volume"
            value={`${formatUSDCCompact(metrics.totalPayments)} USDC`}
          />
          <MetricCard
            label="Avg Transaction"
            value={`${formatUSDCCompact(metrics.averagePayment || (metrics.totalTransactions > 0 ? metrics.totalPayments / metrics.totalTransactions : 0))} USDC`}
          />
          <MetricCard
            label="Success Rate"
            value={`${successRate.toFixed(1)}%`}
            valueColor="text-score-excellent"
          />
        </div>

        {/* Transaction table */}
        <div className="flex-1 bg-card rounded-3xl border border-border overflow-hidden flex flex-col min-h-0">
          {/* Header */}
          <div className="flex items-center px-5 py-3 border-b border-border">
            <span className="text-xs font-semibold text-muted-foreground w-[180px] shrink-0">From</span>
            <span className="text-xs font-semibold text-muted-foreground w-[180px] shrink-0">To</span>
            <span className="text-xs font-semibold text-muted-foreground w-[140px] shrink-0">Amount</span>
            <span className="text-xs font-semibold text-muted-foreground w-[120px] shrink-0">Protocol</span>
            <span className="text-xs font-semibold text-muted-foreground w-[100px] shrink-0">Status</span>
            <span className="text-xs font-semibold text-muted-foreground flex-1">Time</span>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto">
            {edges.length === 0 && paymentEvents.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                No payment transactions yet. Run the demo to generate.
              </div>
            ) : (
              edges.map((edge, i) => {
                const fromAgent = agents[edge.source];
                const isMalicious = fromAgent?.civicFlagged;

                return (
                  <div
                    key={`${edge.source}-${edge.target}-${i}`}
                    className="flex items-center px-5 py-3.5 border-b border-border"
                  >
                    <span className={`text-sm w-[180px] shrink-0 ${isMalicious ? 'text-score-critical' : 'text-foreground'}`}>
                      {getAgentName(edge.source)}
                    </span>
                    <span className="text-sm text-foreground w-[180px] shrink-0">
                      {getAgentName(edge.target)}
                    </span>
                    <span className={`text-sm font-medium w-[140px] shrink-0 ${isMalicious ? 'text-muted-foreground' : 'text-primary'}`}>
                      ${edge.weight.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground w-[120px] shrink-0">
                      {edge.protocol || 'x402'}
                    </span>
                    <span className="w-[100px] shrink-0">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                        isMalicious
                          ? 'bg-error text-error-foreground'
                          : 'bg-success text-success-foreground'
                      }`}>
                        {isMalicious ? 'Rejected' : 'Settled'}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground flex-1">
                      {formatTimestamp(Date.now() - (i * 120000))}
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
