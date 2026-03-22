'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/app-layout';
import { TrustGraph } from '@/components/dashboard/trust-graph';
import { AgentDetail } from '@/components/dashboard/agent-detail';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { useEvents } from '@/hooks/use-events';
import { useAgents, useMetrics, useDashboardStore, useLoading } from '@/stores/dashboard';
import {
  computeHealthScore,
  formatUSDCCompact,
  countSybilAlerts,
} from '@/components/dashboard/metrics-utils';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  DashboardSquare01Icon,
  ChartRelationshipIcon,
  SecurityCheckIcon,
  Shield01Icon,
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
    <div className="bg-card card-elevated rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <HugeiconsIcon icon={icon} size={16} className={iconColor ?? 'text-primary'} />
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <motion.div
        key={String(value)}
        initial={{ scale: 1.05 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex items-baseline gap-2"
      >
        <span className="text-foreground text-2xl font-bold">{value}</span>
        {trend && (
          <span className={`text-xs font-medium ${trendColor ?? 'text-score-excellent'}`}>{trend}</span>
        )}
      </motion.div>
    </div>
  );
}

function MetricCardSkeleton() {
  return (
    <div className="bg-card card-elevated rounded-xl p-5 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-4 h-4 rounded bg-muted" />
        <span className="h-3 w-20 rounded bg-muted" />
      </div>
      <div className="h-8 w-16 rounded bg-muted" />
    </div>
  );
}

export default function Home() {
  const { status } = useEvents();
  const metrics = useMetrics();
  const agents = useAgents();
  const loading = useLoading();
  const [showFeed, setShowFeed] = useState(true);

  const agentValues = useMemo(() => Object.values(agents), [agents]);
  const sybilAlerts = useMemo(() => countSybilAlerts(agents), [agents]);

  const avgReputation = useMemo(() => {
    const scored = agentValues.filter((a) => a.reputationScore != null);
    if (scored.length === 0) return 0;
    return scored.reduce((sum, a) => sum + a.reputationScore!, 0) / scored.length;
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
              className="text-sm font-medium px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all duration-150"
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

        {/* Metrics row */}
        <div className="grid grid-cols-4 gap-4">
          {loading ? (
            <>
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
            </>
          ) : (
            <>
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
                trend={healthScore > 0 ? `${healthScore}% health` : undefined}
                trendColor={healthScore >= 80 ? 'text-score-excellent' : healthScore >= 50 ? 'text-score-moderate' : 'text-score-critical'}
              />
              <MetricCard
                label="Civic Flags"
                value={sybilAlerts}
                icon={Shield01Icon}
                iconColor={sybilAlerts > 0 ? 'text-score-critical' : 'text-score-excellent'}
                trend={sybilAlerts > 0 ? 'agents flagged' : 'all clear'}
                trendColor={sybilAlerts > 0 ? 'text-score-critical' : 'text-score-excellent'}
              />
            </>
          )}
        </div>

        {/* Content area */}
        <div className="flex gap-5 flex-1 min-h-0">
          {/* Trust Graph panel */}
          <div className="flex-[3] bg-card card-elevated rounded-xl flex flex-col overflow-hidden min-w-0">
            <div className="px-5 py-3 flex justify-between items-center border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Trust Graph</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground">Requester</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-score-excellent" />
                  <span className="text-xs text-muted-foreground">Provider</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-score-critical" />
                  <span className="text-xs text-muted-foreground">Adversarial</span>
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
                className="bg-card card-elevated rounded-xl overflow-hidden"
              >
                <div className="px-5 py-3 border-b border-border">
                  <h3 className="text-sm font-medium text-foreground">Activity Feed</h3>
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
