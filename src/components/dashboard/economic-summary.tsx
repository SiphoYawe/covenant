'use client';

import { useMemo } from 'react';
import { useAgents, useMetrics } from '@/stores/dashboard';
import {
  computeHealthScore,
  formatUSDCCompact,
  getHealthColor,
  countSybilAlerts,
} from '@/components/dashboard/metrics-utils';

type MetricItemProps = {
  label: string;
  value: string;
  color?: string;
  trend?: string;
};

function MetricItem({ label, value, color, trend }: MetricItemProps) {
  return (
    <div className="flex-1 bg-card rounded-3xl border border-border p-5 flex flex-col">
      <span className="text-muted-foreground text-[13px] font-medium">{label}</span>
      <span className={`text-[28px] font-bold ${color ?? 'text-foreground'}`}>
        {value}
      </span>
      {trend && (
        <span className="text-score-excellent text-[13px]">{trend}</span>
      )}
    </div>
  );
}

export function EconomicSummary() {
  const metrics = useMetrics();
  const agents = useAgents();

  const sybilAlerts = useMemo(() => countSybilAlerts(agents), [agents]);

  const healthScore = useMemo(
    () => computeHealthScore(metrics, agents, sybilAlerts),
    [metrics, agents, sybilAlerts],
  );

  return (
    <div className="flex flex-row gap-4">
      <MetricItem
        label="Total USDC"
        value={formatUSDCCompact(metrics.totalPayments)}
      />
      <MetricItem
        label="Transactions"
        value={String(metrics.totalTransactions)}
      />
      <MetricItem
        label="Avg Payment"
        value={formatUSDCCompact(metrics.averagePayment)}
      />
      <MetricItem
        label="Sybil Alerts"
        value={String(sybilAlerts)}
        color={sybilAlerts > 0 ? 'text-score-critical' : undefined}
      />
      <MetricItem
        label="Network Health"
        value={String(healthScore)}
        color={getHealthColor(healthScore)}
      />
    </div>
  );
}
