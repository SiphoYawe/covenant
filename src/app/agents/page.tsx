'use client';

import { useMemo } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAgents, useEdges, useDashboardStore } from '@/stores/dashboard';
import type { AgentState } from '@/stores/dashboard';
import { HugeiconsIcon } from '@hugeicons/react';
import { CancelCircleIcon, SecurityCheckIcon } from '@hugeicons/core-free-icons';

function getScoreColor(score: number): string {
  if (score >= 8) return 'text-score-excellent';
  if (score >= 6) return 'text-score-good';
  if (score >= 4) return 'text-score-moderate';
  if (score >= 2) return 'text-score-poor';
  return 'text-score-critical';
}

function AgentRow({ agent }: { agent: AgentState }) {
  const edges = useEdges();
  const setSelected = useDashboardStore((s) => s.setSelectedAgent);
  const score = agent.reputationScore ?? 5;

  const paymentVolume = useMemo(() => {
    return edges
      .filter((e) => e.source === agent.agentId || e.target === agent.agentId)
      .reduce((sum, e) => sum + e.weight, 0);
  }, [edges, agent.agentId]);

  const jobCount = useMemo(() => {
    return edges.filter(
      (e) => e.target === agent.agentId || e.source === agent.agentId,
    ).length;
  }, [edges, agent.agentId]);

  const initials = agent.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      type="button"
      onClick={() => setSelected(agent.agentId)}
      className="flex items-center w-full px-5 py-4 border-b border-border hover:bg-muted/50 transition-colors text-left"
    >
      {/* Avatar + Name */}
      <div className="flex items-center gap-3 w-[200px] shrink-0">
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground">
          {initials}
        </div>
        <span className={`text-sm font-medium ${agent.civicFlagged ? 'text-score-critical' : 'text-foreground'}`}>
          {agent.name || agent.agentId.slice(0, 10)}
        </span>
      </div>

      {/* Role */}
      <span className="text-sm text-muted-foreground w-[160px] shrink-0 truncate">
        {agent.role || 'Unknown'}
      </span>

      {/* Score */}
      <span className={`text-sm font-semibold w-[100px] shrink-0 ${getScoreColor(score)}`}>
        {score.toFixed(1)}
      </span>

      {/* Civic Status */}
      <div className="flex items-center gap-1.5 w-[140px] shrink-0">
        {agent.civicFlagged ? (
          <>
            <HugeiconsIcon icon={CancelCircleIcon} size={14} className="text-score-critical" />
            <span className="text-xs text-score-critical">Flagged</span>
          </>
        ) : (
          <>
            <HugeiconsIcon icon={SecurityCheckIcon} size={14} className="text-score-excellent" />
            <span className="text-xs text-score-excellent">Verified</span>
          </>
        )}
      </div>

      {/* Payments */}
      <span className="text-sm text-foreground w-[140px] shrink-0">
        ${paymentVolume.toLocaleString()}
      </span>

      {/* Jobs */}
      <span className="text-sm text-foreground w-[80px] shrink-0">
        {jobCount}
      </span>

      {/* Status */}
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
          agent.civicFlagged
            ? 'bg-error text-error-foreground'
            : 'bg-success text-success-foreground'
        }`}
      >
        {agent.civicFlagged ? 'Excluded' : 'Active'}
      </span>
    </button>
  );
}

export default function AgentsPage() {
  const agents = useAgents();

  const sortedAgents = useMemo(() => {
    return Object.values(agents).sort(
      (a, b) => (b.reputationScore ?? 5) - (a.reputationScore ?? 5),
    );
  }, [agents]);

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-8 h-full">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-foreground">Registered Agents</h1>
          <span className="text-sm text-muted-foreground">
            {sortedAgents.length} agents
          </span>
        </div>

        {/* Table */}
        <div className="flex-1 bg-card rounded-3xl border border-border overflow-hidden flex flex-col min-h-0">
          {/* Header row */}
          <div className="flex items-center px-5 py-3 border-b border-border">
            <span className="text-xs font-semibold text-muted-foreground w-[200px] shrink-0">Agent</span>
            <span className="text-xs font-semibold text-muted-foreground w-[160px] shrink-0">Role</span>
            <span className="text-xs font-semibold text-muted-foreground w-[100px] shrink-0">Score</span>
            <span className="text-xs font-semibold text-muted-foreground w-[140px] shrink-0">Civic Status</span>
            <span className="text-xs font-semibold text-muted-foreground w-[140px] shrink-0">Payments</span>
            <span className="text-xs font-semibold text-muted-foreground w-[80px] shrink-0">Jobs</span>
            <span className="text-xs font-semibold text-muted-foreground flex-1">Status</span>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto">
            {sortedAgents.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                No agents registered yet. Run the demo to populate.
              </div>
            ) : (
              sortedAgents.map((agent) => (
                <AgentRow key={agent.agentId} agent={agent} />
              ))
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
