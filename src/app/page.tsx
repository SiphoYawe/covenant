'use client';

import { useMemo } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { TrustGraph } from '@/components/dashboard/trust-graph';
import { AgentDetail } from '@/components/dashboard/agent-detail';
import { useEvents } from '@/hooks/use-events';
import { useAgents, useMetrics } from '@/stores/dashboard';
import {
  computeHealthScore,
  formatUSDCCompact,
  countSybilAlerts,
} from '@/components/dashboard/metrics-utils';

type MetricCardProps = {
  label: string;
  value: string;
  trend?: string;
  trendColor?: string;
};

function MetricCard({ label, value, trend, trendColor }: MetricCardProps) {
  return (
    <div className="flex-1 bg-card rounded-3xl border border-border p-5">
      <span className="text-muted-foreground text-[13px] font-medium">{label}</span>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-foreground text-[28px] font-bold leading-tight">{value}</span>
        {trend && (
          <span className={`text-[13px] ${trendColor ?? 'text-score-excellent'}`}>{trend}</span>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const { status } = useEvents();
  const metrics = useMetrics();
  const agents = useAgents();

  const agentValues = useMemo(() => Object.values(agents), [agents]);
  const sybilAlerts = useMemo(() => countSybilAlerts(agents), [agents]);

  const avgReputation = useMemo(() => {
    if (agentValues.length === 0) return 5;
    return agentValues.reduce((sum, a) => sum + (a.reputationScore ?? 5), 0) / agentValues.length;
  }, [agentValues]);

  const healthScore = useMemo(
    () => computeHealthScore(metrics, agents, sybilAlerts),
    [metrics, agents, sybilAlerts],
  );

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-8 h-full">
        {/* Header row */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-foreground">AI Reputation Dashboard</h1>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                status === 'connected'
                  ? 'bg-score-excellent'
                  : status === 'connecting'
                    ? 'bg-score-moderate animate-pulse'
                    : 'bg-score-critical'
              }`}
            />
            <span className="text-muted-foreground text-sm">
              {status === 'connected'
                ? 'Connected'
                : status === 'connecting'
                  ? 'Connecting'
                  : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Metrics row */}
        <div className="flex gap-4">
          <MetricCard
            label="Total Payments"
            value={formatUSDCCompact(metrics.totalPayments)}
            trend={metrics.totalPayments > 0 ? '+' + formatUSDCCompact(metrics.totalPayments) : undefined}
            trendColor="text-score-excellent"
          />
          <MetricCard
            label="Transactions"
            value={String(metrics.totalTransactions)}
            trend={metrics.totalTransactions > 0 ? `+${metrics.totalTransactions}` : undefined}
            trendColor="text-score-excellent"
          />
          <MetricCard
            label="Avg Reputation"
            value={avgReputation.toFixed(1)}
            trend={`${healthScore}% health`}
            trendColor={healthScore >= 80 ? 'text-score-excellent' : healthScore >= 50 ? 'text-score-moderate' : 'text-score-critical'}
          />
          <MetricCard
            label="Active Agents"
            value={String(agentValues.length)}
            trend={sybilAlerts > 0 ? `${sybilAlerts} flagged` : undefined}
            trendColor={sybilAlerts > 0 ? 'text-score-critical' : 'text-score-excellent'}
          />
        </div>

        {/* Content area */}
        <div className="flex gap-6 flex-1 min-h-0">
          {/* Trust Graph panel */}
          <div className="flex-1 bg-card rounded-3xl border border-border flex flex-col overflow-hidden">
            <div className="p-4 flex justify-between items-center border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Trust Graph</h2>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground text-sm px-3 py-1 rounded-full transition-colors"
              >
                Filter
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <TrustGraph />
            </div>
          </div>

          {/* Agent Detail panel */}
          <div className="w-80 shrink-0">
            <AgentDetail />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
