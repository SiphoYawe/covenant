'use client';

import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAgents, useEvents, useCivicMetrics, useLoading } from '@/stores/dashboard';
import { formatTimestamp } from '@/components/dashboard/feed-utils';
import { Badge } from '@/components/ui/badge';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  SecurityCheckIcon,
  CancelCircleIcon,
  Alert02Icon,
  Shield01Icon,
} from '@hugeicons/core-free-icons';

// Civic event types from the event bus
const CIVIC_EVENT_TYPES = [
  'civic:identity-checked',
  'civic:behavioral-checked',
  'civic:flagged',
  'civic:tool-blocked',
  'civic:resolved',
];

type CivicInspection = {
  id: string;
  timestamp: number;
  agentName: string;
  agentId: string;
  layer: 'L1' | 'L2';
  result: 'pass' | 'flag' | 'catch';
  severity: 'clean' | 'warning' | 'critical';
  description: string;
};

function eventToInspection(
  event: { id: string; timestamp: number; type: string; agentId?: string; data: Record<string, unknown> },
  agentName: string,
): CivicInspection | null {
  const agentId = event.agentId ?? '';

  switch (event.type) {
    case 'civic:identity-checked':
      return {
        id: event.id,
        timestamp: event.timestamp,
        agentName,
        agentId,
        layer: 'L1',
        result: event.data.passed ? 'pass' : 'flag',
        severity: event.data.passed ? 'clean' : 'warning',
        description: event.data.passed
          ? `Identity verified via Civic Auth for ${agentName}`
          : `Identity verification flagged for ${agentName}`,
      };

    case 'civic:behavioral-checked':
      return {
        id: event.id,
        timestamp: event.timestamp,
        agentName,
        agentId,
        layer: 'L2',
        result: 'pass',
        severity: 'clean',
        description: `Behavioral check passed for ${agentName} (${event.data.direction ?? 'output'})`,
      };

    case 'civic:flagged':
      return {
        id: event.id,
        timestamp: event.timestamp,
        agentName,
        agentId,
        layer: 'L2',
        result: 'catch',
        severity: 'critical',
        description: `${event.data.attackType ?? 'Threat'} detected from ${agentName}: ${event.data.evidence ?? 'Flagged by Civic behavioral analysis'}`,
      };

    case 'civic:tool-blocked':
      return {
        id: event.id,
        timestamp: event.timestamp,
        agentName,
        agentId,
        layer: 'L2',
        result: 'catch',
        severity: 'critical',
        description: `Unauthorized tool call blocked for ${agentName}: ${event.data.attemptedTool ?? 'unknown'}`,
      };

    case 'civic:resolved':
      return {
        id: event.id,
        timestamp: event.timestamp,
        agentName,
        agentId,
        layer: 'L2',
        result: 'catch',
        severity: 'critical',
        description: `Threat resolved for ${agentName}: ${event.data.action ?? 'blocked'}`,
      };

    default:
      return null;
  }
}

function StatCardSkeleton() {
  return (
    <div className="bg-card card-elevated rounded-xl p-5 flex items-center gap-4 animate-pulse">
      <div className="w-10 h-10 rounded-lg bg-muted shrink-0" />
      <div className="flex-1">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-7 w-12 rounded bg-muted mt-2" />
      </div>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3 border-b border-border animate-pulse">
          <span className="w-2 h-2 rounded-full bg-muted shrink-0" />
          <span className="h-4 w-4 rounded bg-muted shrink-0" />
          <span className="h-4 w-24 rounded bg-muted shrink-0" />
          <span className="h-5 w-8 rounded bg-muted shrink-0" />
          <span className="h-4 flex-1 rounded bg-muted" style={{ maxWidth: `${40 + (i % 3) * 15}%` }} />
          <span className="h-3 w-12 rounded bg-muted shrink-0" />
        </div>
      ))}
    </div>
  );
}

export default function CivicGuardsPage() {
  const agents = useAgents();
  const events = useEvents();
  const civicMetrics = useCivicMetrics();
  const loading = useLoading();

  // Build inspection timeline from real Civic events in the store
  const inspections = useMemo<CivicInspection[]>(() => {
    return events
      .filter((e) => CIVIC_EVENT_TYPES.includes(e.type))
      .map((e) => {
        const agentName = e.agentId ? (agents[e.agentId]?.name ?? e.agentId) : 'Unknown';
        return eventToInspection(e, agentName);
      })
      .filter((i): i is CivicInspection => i !== null)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [events, agents]);

  // Flagged agents from real store state
  const flaggedAgents = useMemo(() => {
    return Object.values(agents).filter((a) => a.civicFlagged);
  }, [agents]);

  // Use server-computed civic metrics (covers all events, not capped at 50)
  const metrics = civicMetrics;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-6 h-full min-h-0">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <HugeiconsIcon
              icon={Shield01Icon}
              size={28}
              className="text-primary"
            />
            <h1 className="text-2xl font-semibold text-foreground">
              Civic Guards
            </h1>
          </div>
        </div>

        {/* Summary stats bar */}
        <div className="grid grid-cols-3 gap-4">
          {loading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard
                label="Total Inspections"
                value={metrics.totalInspections}
                icon={SecurityCheckIcon}
                iconColor="text-primary"
                bgColor="bg-primary/10"
              />
              <StatCard
                label="Layer 2 Catches"
                value={metrics.l2Catches}
                icon={Alert02Icon}
                iconColor="text-score-moderate"
                bgColor="bg-score-moderate/10"
              />
              <StatCard
                label="Critical Flags"
                value={metrics.criticalFlags}
                icon={CancelCircleIcon}
                iconColor="text-score-critical"
                bgColor="bg-score-critical/10"
              />
            </>
          )}
        </div>

        {/* Full-width Inspection Timeline */}
        <div className="flex-1 bg-card card-elevated rounded-xl overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">
              Inspection Timeline
            </h2>
            <span className="text-sm text-muted-foreground">
              {inspections.length} inspections
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <TimelineSkeleton />
            ) : inspections.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-base">
                No Civic inspections yet. Run the seed engine or trigger a live demo to generate real inspections.
              </div>
            ) : (
              inspections.map((entry) => (
                <TimelineEntry key={entry.id} entry={entry} />
              ))
            )}
          </div>
        </div>

        {/* Flagged Agents (bottom) */}
        {flaggedAgents.length > 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-semibold text-foreground px-1">
              Flagged Agents
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {flaggedAgents.map((agent) => (
                <FlaggedAgentCard
                  key={agent.agentId}
                  name={agent.name || agent.agentId}
                  role={agent.role}
                  reputationScore={agent.reputationScore}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// -- Stat card component --

function StatCard({
  label,
  value,
  icon,
  iconColor,
  bgColor,
}: {
  label: string;
  value: number;
  icon: typeof SecurityCheckIcon;
  iconColor: string;
  bgColor: string;
}) {
  return (
    <div className="bg-card card-elevated rounded-xl p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center shrink-0`}>
        <HugeiconsIcon icon={icon} size={20} className={iconColor} />
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// -- Timeline entry component (expandable) --

function TimelineEntry({ entry }: { entry: CivicInspection }) {
  const [expanded, setExpanded] = useState(false);

  const severityDot =
    entry.severity === 'critical'
      ? 'bg-score-critical'
      : entry.severity === 'warning'
        ? 'bg-score-moderate'
        : 'bg-score-excellent';

  const rowBg =
    entry.severity === 'critical'
      ? 'bg-score-critical/5 hover:bg-score-critical/10'
      : entry.severity === 'warning'
        ? 'bg-score-moderate/5 hover:bg-score-moderate/10'
        : 'hover:bg-secondary/50';

  const selectedBorder = expanded ? 'border-l-2 border-l-primary' : '';

  const resultIcon =
    entry.result === 'catch' || entry.result === 'flag'
      ? CancelCircleIcon
      : SecurityCheckIcon;

  const resultColor =
    entry.result === 'catch'
      ? 'text-score-critical'
      : entry.result === 'flag'
        ? 'text-score-moderate'
        : 'text-score-excellent';

  return (
    <div className={`border-b border-border transition-colors ${rowBg} ${selectedBorder}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 px-5 py-3 w-full text-left cursor-pointer"
      >
        <span className={`w-2 h-2 rounded-full ${severityDot} shrink-0`} />
        <HugeiconsIcon
          icon={resultIcon}
          size={16}
          className={`shrink-0 ${resultColor}`}
        />
        <span className="text-sm font-semibold text-foreground w-32 shrink-0 truncate">
          {entry.agentName}
        </span>
        {entry.layer === 'L1' ? (
          <Badge className="bg-primary/20 text-primary text-[12px] px-2 py-0.5">
            L1
          </Badge>
        ) : (
          <Badge className="bg-score-moderate/20 text-score-moderate text-[12px] px-2 py-0.5">
            L2
          </Badge>
        )}
        <span
          className={`flex-1 text-sm ${
            entry.severity === 'critical'
              ? 'text-score-critical'
              : entry.severity === 'warning'
                ? 'text-score-moderate'
                : 'text-muted-foreground'
          } truncate`}
        >
          {entry.description}
        </span>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatTimestamp(entry.timestamp)}
        </span>
        <span className={`text-muted-foreground text-xs shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}>
          &#9654;
        </span>
      </button>
      {expanded && (
        <div className="px-5 pb-4 pt-1 ml-8 space-y-2 animate-fade-in">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Agent</span>
              <p className="text-foreground font-medium mt-0.5">{entry.agentName}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Layer</span>
              <p className="text-foreground font-medium mt-0.5">{entry.layer === 'L1' ? 'Identity (L1)' : 'Behavioral (L2)'}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Severity</span>
              <p className={`font-medium mt-0.5 ${
                entry.severity === 'critical' ? 'text-score-critical' : entry.severity === 'warning' ? 'text-score-moderate' : 'text-score-excellent'
              }`}>{entry.severity}</p>
            </div>
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Details</span>
            <p className="text-sm text-foreground mt-0.5">{entry.description}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Agent ID</span>
            <p className="text-sm text-foreground font-mono mt-0.5">{entry.agentId}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// -- Flagged agent card (from real store data) --

function FlaggedAgentCard({
  name,
  role,
  reputationScore,
}: {
  name: string;
  role: string;
  reputationScore?: number;
}) {
  return (
    <div className="bg-card rounded-xl border border-score-critical/30 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={CancelCircleIcon}
            size={18}
            className="text-score-critical"
          />
          <span className="text-base font-semibold text-foreground">
            {name}
          </span>
        </div>
        {reputationScore != null && (
          <span className="text-sm font-bold text-score-critical">
            {reputationScore.toFixed(1)}/10
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge className="bg-score-critical/20 text-score-critical text-[12px] px-2 py-0.5">
          {role}
        </Badge>
        <Badge className="bg-score-critical/20 text-score-critical text-[12px] px-2 py-0.5">
          Civic Flagged
        </Badge>
      </div>
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <span className="w-2 h-2 rounded-full bg-score-critical" />
        <span className="text-xs text-score-critical font-medium">
          Excluded from marketplace
        </span>
      </div>
    </div>
  );
}
