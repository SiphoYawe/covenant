'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/app-layout';
import { TrustGraph } from '@/components/dashboard/trust-graph';
import { AgentDetail } from '@/components/dashboard/agent-detail';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { useEvents } from '@/hooks/use-events';
import { useAgents, useMetrics, useEdges, useDashboardStore } from '@/stores/dashboard';
import {
  computeHealthScore,
  formatUSDCCompact,
  countSybilAlerts,
} from '@/components/dashboard/metrics-utils';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  DashboardSquare01Icon,
  Alert02Icon,
  CancelCircleIcon,
  ChartRelationshipIcon,
  SecurityCheckIcon,
} from '@hugeicons/core-free-icons';

type MetricCardProps = {
  label: string;
  value: string | number;
  icon: typeof DashboardSquare01Icon;
  iconColor?: string;
  trend?: string;
  trendColor?: string;
};

function MetricCard({ label, value, icon, iconColor, trend, trendColor }: MetricCardProps) {
  return (
    <div className="flex-1 bg-card rounded-3xl border border-border p-4 min-w-[140px]">
      <div className="flex items-center gap-2 mb-1">
        <HugeiconsIcon icon={icon} size={16} className={iconColor ?? 'text-primary'} />
        <span className="text-muted-foreground text-[12px] font-medium">{label}</span>
      </div>
      <motion.div
        key={String(value)}
        initial={{ scale: 1.05 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-baseline gap-2"
      >
        <span className="text-foreground text-[24px] font-bold leading-tight">{value}</span>
        {trend && (
          <span className={`text-[12px] ${trendColor ?? 'text-score-excellent'}`}>{trend}</span>
        )}
      </motion.div>
    </div>
  );
}

export default function Home() {
  const { status } = useEvents();
  const metrics = useMetrics();
  const agents = useAgents();
  const edges = useEdges();
  const [showFeed, setShowFeed] = useState(false);

  const agentValues = useMemo(() => Object.values(agents), [agents]);
  const sybilAlerts = useMemo(() => countSybilAlerts(agents), [agents]);
  const excludedCount = useMemo(
    () => agentValues.filter((a) => a.civicFlagged).length,
    [agentValues],
  );

  const domains = useMemo(() => {
    const set = new Set(agentValues.map((a) => a.domain).filter(Boolean));
    return set.size;
  }, [agentValues]);

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
      <div className="flex flex-col gap-5 p-6 h-full">
        {/* Header row */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-foreground">AI Reputation Dashboard</h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowFeed(!showFeed)}
              className="text-muted-foreground hover:text-foreground text-sm px-3 py-1.5 rounded-full border border-border transition-colors"
            >
              {showFeed ? 'Hide Feed' : 'Activity Feed'}
            </button>
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
        </div>

        {/* Metrics row - 6 metrics */}
        <div className="flex gap-3 flex-wrap">
          <MetricCard
            label="Total Agents"
            value={agentValues.length}
            icon={DashboardSquare01Icon}
            iconColor="text-primary"
          />
          <MetricCard
            label="USDC Transacted"
            value={formatUSDCCompact(metrics.totalPayments)}
            icon={ChartRelationshipIcon}
            iconColor="text-score-excellent"
            trend={metrics.totalTransactions > 0 ? `${metrics.totalTransactions} txs` : undefined}
          />
          <MetricCard
            label="Avg Reputation"
            value={avgReputation.toFixed(1)}
            icon={SecurityCheckIcon}
            iconColor="text-primary"
            trend={`${healthScore}% health`}
            trendColor={healthScore >= 80 ? 'text-score-excellent' : healthScore >= 50 ? 'text-score-moderate' : 'text-score-critical'}
          />
          <MetricCard
            label="Sybil Alerts"
            value={sybilAlerts}
            icon={Alert02Icon}
            iconColor={sybilAlerts > 0 ? 'text-score-critical' : 'text-score-excellent'}
          />
          <MetricCard
            label="Excluded"
            value={excludedCount}
            icon={CancelCircleIcon}
            iconColor={excludedCount > 0 ? 'text-score-critical' : 'text-muted-foreground'}
          />
          <MetricCard
            label="Domains"
            value={domains}
            icon={DashboardSquare01Icon}
            iconColor="text-score-moderate"
          />
        </div>

        {/* Content area */}
        <div className="flex gap-5 flex-1 min-h-0">
          {/* Trust Graph panel */}
          <div className="flex-[3] bg-card rounded-3xl border border-border flex flex-col overflow-hidden min-w-0">
            <div className="p-4 flex justify-between items-center border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Trust Graph</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#00BBFF' }} />
                  <span className="text-[11px] text-muted-foreground">Requester</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#00FF88' }} />
                  <span className="text-[11px] text-muted-foreground">Provider</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#FF4444' }} />
                  <span className="text-[11px] text-muted-foreground">Adversarial</span>
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <TrustGraph />
            </div>
          </div>

          {/* Right column: Agent Detail + optional Activity Feed */}
          <div className="flex flex-col gap-5 w-[340px] shrink-0 min-h-0">
            <div className="flex-1 min-h-0">
              <AgentDetail />
            </div>
            {showFeed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 300, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-card rounded-3xl border border-border overflow-hidden"
              >
                <div className="p-3 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">Activity Feed</h3>
                </div>
                <div className="h-[260px]">
                  <ActivityFeed />
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
