'use client';

import { useMemo } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAgents, useEdges, useDashboardStore } from '@/stores/dashboard';
import type { AgentState } from '@/stores/dashboard';
import { HugeiconsIcon } from '@hugeicons/react';
import { SecurityCheckIcon, CancelCircleIcon, Search01Icon } from '@hugeicons/core-free-icons';
import { getDomainColor, getStatusIndicator } from '@/components/dashboard/seed-data-adapter';

function getScoreColor(score: number): string {
  if (score >= 8) return 'text-score-excellent';
  if (score >= 6) return 'text-score-good';
  if (score >= 4) return 'text-score-moderate';
  if (score >= 2) return 'text-score-poor';
  return 'text-score-critical';
}

function getScoreBarColor(score: number): string {
  if (score >= 8) return 'bg-score-excellent';
  if (score >= 6) return 'bg-score-good';
  if (score >= 4) return 'bg-score-moderate';
  if (score >= 2) return 'bg-score-poor';
  return 'bg-score-critical';
}

function StatusDot({ status }: { status: 'active' | 'flagged' | 'excluded' }) {
  const colors: Record<string, string> = {
    active: 'bg-green-500',
    flagged: 'bg-yellow-500',
    excluded: 'bg-red-500',
  };
  const labels: Record<string, string> = {
    active: 'Active',
    flagged: 'Flagged',
    excluded: 'Excluded',
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${colors[status]}`} />
      <span
        className={`text-xs font-medium ${
          status === 'active'
            ? 'text-green-400'
            : status === 'flagged'
              ? 'text-yellow-400'
              : 'text-red-400'
        }`}
      >
        {labels[status]}
      </span>
    </span>
  );
}

function AgentCard({ agent }: { agent: AgentState }) {
  const edges = useEdges();
  const setSelected = useDashboardStore((s) => s.setSelectedAgent);
  const score = agent.reputationScore ?? 5;
  const status = getStatusIndicator(agent.civicFlagged, agent.role);
  const domainColorClass = getDomainColor(agent.domain ?? '');

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
      className="bg-card border border-border rounded-3xl p-5 hover:border-primary/50 hover:bg-card/80 transition-all duration-200 text-left flex flex-col gap-4 group"
    >
      {/* Top row: avatar, name, status */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
              status === 'excluded'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-primary/20 text-primary'
            }`}
          >
            {initials}
          </div>
          <div className="flex flex-col min-w-0">
            <span
              className={`text-sm font-semibold truncate ${
                status === 'excluded' ? 'text-score-critical' : 'text-foreground'
              }`}
            >
              {agent.name || agent.agentId.slice(0, 10)}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {agent.role || 'Unknown'}
            </span>
          </div>
        </div>
        <StatusDot status={status} />
      </div>

      {/* Domain badge */}
      {agent.domain && (
        <span
          className={`inline-flex self-start px-2.5 py-1 rounded-full text-xs font-medium ${domainColorClass}`}
        >
          {agent.domain}
        </span>
      )}

      {/* Reputation score bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Reputation</span>
          <span className={`text-sm font-bold ${getScoreColor(score)}`}>
            {score.toFixed(1)}
          </span>
        </div>
        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor(score)}`}
            style={{ width: `${(score / 10) * 100}%` }}
          />
        </div>
      </div>

      {/* Civic verification and stats */}
      <div className="flex items-center justify-between pt-1 border-t border-border/50">
        <div className="flex items-center gap-1.5">
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
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {jobCount} job{jobCount !== 1 ? 's' : ''}
          </span>
          <span className="text-xs text-muted-foreground">
            ${paymentVolume.toLocaleString()}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function AgentsPage() {
  const agents = useAgents();
  const searchQuery = useDashboardStore((s) => s.searchQuery);
  const setSearchQuery = useDashboardStore((s) => s.setSearchQuery);

  const filteredAgents = useMemo(() => {
    const all = Object.values(agents).sort(
      (a, b) => (b.reputationScore ?? 5) - (a.reputationScore ?? 5),
    );
    if (!searchQuery.trim()) return all;
    const q = searchQuery.toLowerCase();
    return all.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.domain ?? '').toLowerCase().includes(q),
    );
  }, [agents, searchQuery]);

  const activeCount = filteredAgents.filter(
    (a) => getStatusIndicator(a.civicFlagged, a.role) === 'active',
  ).length;
  const excludedCount = filteredAgents.filter(
    (a) => getStatusIndicator(a.civicFlagged, a.role) === 'excluded',
  ).length;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-8 h-full">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Registered Agents
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''}
              {searchQuery.trim() ? ` matching "${searchQuery}"` : ''}
              {' '}&middot;{' '}
              <span className="text-green-400">{activeCount} active</span>
              {excludedCount > 0 && (
                <>
                  {' '}&middot;{' '}
                  <span className="text-red-400">{excludedCount} excluded</span>
                </>
              )}
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-80">
            <HugeiconsIcon
              icon={Search01Icon}
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search by name or domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <HugeiconsIcon icon={CancelCircleIcon} size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Agent grid */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {filteredAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-muted-foreground">
              <HugeiconsIcon icon={Search01Icon} size={40} className="mb-3 opacity-40" />
              <p className="text-sm">
                {searchQuery.trim()
                  ? 'No agents match your search. Try a different query.'
                  : 'No agents registered yet. Run the demo to populate.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAgents.map((agent) => (
                <AgentCard key={agent.agentId} agent={agent} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
