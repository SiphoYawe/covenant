'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
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
      <motion.span
        key={value}
        initial={{ scale: 1.05 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3 }}
        className={`text-[28px] font-bold ${color ?? 'text-foreground'}`}
      >
        {value}
      </motion.span>
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
  const excludedCount = useMemo(
    () => Object.values(agents).filter((a) => a.civicFlagged).length,
    [agents],
  );

  const domains = useMemo(() => {
    const set = new Set(Object.values(agents).map((a) => a.domain).filter(Boolean));
    return set.size;
  }, [agents]);

  const healthScore = useMemo(
    () => computeHealthScore(metrics, agents, sybilAlerts),
    [metrics, agents, sybilAlerts],
  );

  return (
    <div className="flex flex-row gap-4 flex-wrap">
      <MetricItem
        label="Total Agents"
        value={String(Object.keys(agents).length)}
      />
      <MetricItem
        label="USDC Transacted"
        value={formatUSDCCompact(metrics.totalPayments)}
      />
      <MetricItem
        label="Transactions"
        value={String(metrics.totalTransactions)}
      />
      <MetricItem
        label="Sybil Alerts"
        value={String(sybilAlerts)}
        color={sybilAlerts > 0 ? 'text-score-critical' : undefined}
      />
      <MetricItem
        label="Excluded"
        value={String(excludedCount)}
        color={excludedCount > 0 ? 'text-score-critical' : undefined}
      />
      <MetricItem
        label="Domains"
        value={String(domains)}
      />
      <MetricItem
        label="Network Health"
        value={String(healthScore)}
        color={getHealthColor(healthScore)}
      />
    </div>
  );
}
