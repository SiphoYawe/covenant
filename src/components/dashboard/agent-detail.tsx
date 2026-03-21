'use client';

import {
  useDashboardStore,
  useSelectedAgentId,
  useAgents,
  useEdges,
  useEvents as useStoreEvents,
} from '@/stores/dashboard';
import { Badge } from '@/components/ui/badge';
import { getScoreColor, formatUSDC } from '@/components/dashboard/reputation-card';

export function AgentDetail() {
  const selectedAgentId = useSelectedAgentId();
  const agents = useAgents();
  const edges = useEdges();
  const events = useStoreEvents();

  if (!selectedAgentId) {
    return (
      <div className="bg-card rounded-3xl border border-border p-6 h-full flex items-center justify-center">
        <span className="text-muted-foreground text-sm">Click an agent node to see details</span>
      </div>
    );
  }

  const agent = agents[selectedAgentId];
  if (!agent) {
    return (
      <div className="bg-card rounded-3xl border border-border p-6 h-full flex items-center justify-center">
        <span className="text-muted-foreground text-sm">Agent not found</span>
      </div>
    );
  }

  const score = agent.reputationScore ?? 5;
  const agentEdges = edges.filter(
    (e) => e.source === selectedAgentId || e.target === selectedAgentId,
  );
  const agentEvents = events.filter(
    (e) => e.agentId === selectedAgentId || e.targetAgentId === selectedAgentId,
  );

  const paymentVolume = agentEdges.reduce((sum, e) => sum + e.weight, 0);
  const jobCount = agentEvents.filter((e) => e.type === 'task.delivered').length;

  const scorePercent = (score / 10) * 100;

  return (
    <div className="bg-card rounded-3xl border border-border p-6 h-full overflow-y-auto space-y-6">
      {/* Agent header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
          {(agent.name || selectedAgentId).charAt(0).toUpperCase()}
        </div>
        <div>
          <h3 className="text-foreground font-semibold text-sm">{agent.name || selectedAgentId.slice(0, 10)}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant={agent.civicFlagged ? 'danger' : 'default'}>{agent.role}</Badge>
            {agent.civicFlagged && <Badge variant="danger">FLAGGED</Badge>}
          </div>
        </div>
      </div>

      {/* Reputation score section */}
      <div>
        <span className="uppercase text-[11px] font-semibold text-muted-foreground tracking-widest">
          Reputation Score
        </span>
        <div className="flex items-baseline gap-2 mt-1">
          <span className={`text-[32px] font-bold leading-tight ${getScoreColor(score)}`}>
            {score.toFixed(1)}
          </span>
          <span className="text-muted-foreground text-sm">/10</span>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              score >= 8
                ? 'bg-score-excellent'
                : score >= 4
                  ? 'bg-score-moderate'
                  : 'bg-score-critical'
            }`}
            style={{ width: `${scorePercent}%` }}
          />
        </div>
      </div>

      {/* Civic status section */}
      <div>
        <span className="uppercase text-[11px] font-semibold text-muted-foreground tracking-widest">
          Civic Status
        </span>
        <div className="flex items-center gap-2 mt-1">
          <svg
            className={`w-5 h-5 ${agent.civicFlagged ? 'text-score-critical' : 'text-score-excellent'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <span className="text-foreground text-sm font-medium">
            {agent.civicFlagged ? 'Flagged' : 'Identity Verified'}
          </span>
        </div>
      </div>

      {/* Payment volume section */}
      <div>
        <span className="uppercase text-[11px] font-semibold text-muted-foreground tracking-widest">
          Payment Volume
        </span>
        <p className="text-foreground text-lg font-semibold mt-1">{formatUSDC(paymentVolume)} USDC</p>
      </div>

      {/* Completed jobs section */}
      <div>
        <span className="uppercase text-[11px] font-semibold text-muted-foreground tracking-widest">
          Completed Jobs
        </span>
        <p className="text-foreground text-lg font-semibold mt-1">
          {jobCount} {jobCount === 1 ? 'task' : 'tasks'}
        </p>
      </div>

      {/* AI Explanation section */}
      <div>
        <span className="uppercase text-[11px] font-semibold text-muted-foreground tracking-widest">
          AI Explanation
        </span>
        <p className="text-muted-foreground text-sm leading-relaxed mt-1">
          {agent.trustLevel
            ? `Trust level: ${agent.trustLevel}. Score reflects payment history, task completion rate, and behavioral analysis across ${agentEdges.length} connections.`
            : 'Awaiting first assessment from the reputation engine.'}
        </p>
      </div>

      {/* Activity indicator */}
      {agentEvents.length === 0 && !agent.civicFlagged && agentEdges.length === 0 && (
        <p className="text-muted-foreground text-xs">No activity recorded yet.</p>
      )}
    </div>
  );
}
