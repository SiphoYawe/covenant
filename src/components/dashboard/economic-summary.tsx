'use client';

import { useMemo } from 'react';
import { useAgents, useMetrics } from '@/stores/dashboard';
import { Card } from '@/components/ui/card';
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
};

function MetricItem({ label, value, color }: MetricItemProps) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-2xl font-bold ${color ?? 'text-foreground'}`}>
        {value}
      </span>
      <span className="text-xs text-zinc-500">{label}</span>
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
    <Card className="flex items-center justify-between gap-6">
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
        color={sybilAlerts > 0 ? 'text-red-400' : undefined}
      />
      <MetricItem
        label="Network Health"
        value={String(healthScore)}
        color={getHealthColor(healthScore)}
      />
    </Card>
  );
}
