'use client';

import { useMemo } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useAgents, useEdges, useEvents } from '@/stores/dashboard';
import { formatTimestamp } from '@/components/dashboard/feed-utils';
import { Badge } from '@/components/ui/badge';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  SecurityCheckIcon,
  CancelCircleIcon,
  Alert02Icon,
  Shield01Icon,
} from '@hugeicons/core-free-icons';

// -- Adversarial agent threat metadata --

type ThreatProfile = {
  walletName: string;
  name: string;
  attackType: 'prompt-injection' | 'sybil-ring';
  attackDescription: string;
  severity: 'critical';
};

const THREAT_PROFILES: ThreatProfile[] = [
  {
    walletName: 'X1',
    name: 'ShadowReview',
    attackType: 'prompt-injection',
    attackDescription:
      'Embeds malicious code suggestions disguised as optimizations in otherwise legitimate code reviews. Recommends removing security checks, hardcoding credentials, and disabling CSRF protection.',
    severity: 'critical',
  },
  {
    walletName: 'X2',
    name: 'EchoNode',
    attackType: 'sybil-ring',
    attackDescription:
      'Operates as part of a reputation farming ring with MirrorBot and GhostAgent. Engages in mutual positive feedback loops and circular small-value payments to inflate reputation scores.',
    severity: 'critical',
  },
  {
    walletName: 'X3',
    name: 'MirrorBot',
    attackType: 'sybil-ring',
    attackDescription:
      'Mirrors EchoNode behavior patterns to appear independent. Participates in circular payment routing and provides inflated reviews to ring members regardless of actual work quality.',
    severity: 'critical',
  },
  {
    walletName: 'X4',
    name: 'GhostAgent',
    attackType: 'sybil-ring',
    attackDescription:
      'Anchor of the Sybil ring. Dual strategy: coordinates circular reputation boosting with ring members, and undercuts legitimate providers at 50% below market rate to attract budget buyers.',
    severity: 'critical',
  },
];

// -- Civic inspection entry type --

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

export default function CivicGuardsPage() {
  const agents = useAgents();
  const edges = useEdges();
  const events = useEvents();

  // Build civic inspection timeline from store agents
  const inspections = useMemo<CivicInspection[]>(() => {
    const agentList = Object.values(agents);
    if (agentList.length === 0) return [];

    const adversarialIds = new Set(['X1', 'X2', 'X3', 'X4']);
    const baseTime = Date.now() - agentList.length * 120_000;
    const items: CivicInspection[] = [];
    let seq = 0;

    // Layer 1 identity checks for all 28 agents
    for (const agent of agentList) {
      const isAdversarial = adversarialIds.has(agent.agentId);
      items.push({
        id: `civic-l1-${agent.agentId}-${seq}`,
        timestamp: baseTime + seq * 90_000,
        agentName: agent.name || agent.agentId,
        agentId: agent.agentId,
        layer: 'L1',
        result: isAdversarial ? 'flag' : 'pass',
        severity: isAdversarial ? 'warning' : 'clean',
        description: isAdversarial
          ? `Identity verification flagged suspicious wallet activity for ${agent.name || agent.agentId}`
          : `Identity verified via Civic Auth for ${agent.name || agent.agentId}`,
      });
      seq++;
    }

    // Layer 2 behavioral checks for adversarial agents
    const threatMap: Record<string, ThreatProfile> = {};
    for (const t of THREAT_PROFILES) {
      threatMap[t.walletName] = t;
    }

    for (const id of ['X1', 'X2', 'X3', 'X4']) {
      const agent = agents[id];
      const threat = threatMap[id];
      if (!agent || !threat) continue;

      items.push({
        id: `civic-l2-${id}-${seq}`,
        timestamp: baseTime + seq * 90_000,
        agentName: agent.name || id,
        agentId: id,
        layer: 'L2',
        result: 'catch',
        severity: 'critical',
        description:
          threat.attackType === 'prompt-injection'
            ? `Behavioral analysis caught prompt injection attempt from ${agent.name || id}`
            : `Sybil ring detected: ${agent.name || id} identified as coordinated farming participant`,
      });
      seq++;
    }

    // Sort by timestamp descending (newest first)
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [agents]);

  // Summary metrics
  const metrics = useMemo(() => {
    const totalInspections = inspections.length;
    const l1Passes = inspections.filter(
      (i) => i.layer === 'L1' && i.result === 'pass',
    ).length;
    const l2Catches = inspections.filter(
      (i) => i.layer === 'L2' && i.result === 'catch',
    ).length;
    const criticalFlags = inspections.filter(
      (i) => i.severity === 'critical',
    ).length;
    return { totalInspections, l1Passes, l2Catches, criticalFlags };
  }, [inspections]);

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-8 h-full min-h-0">
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
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-score-excellent animate-pulse" />
            <span className="text-sm text-score-excellent font-medium">
              MCP Connected
            </span>
          </div>
        </div>

        {/* Summary stats bar */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="Total Inspections"
            value={metrics.totalInspections}
            icon={SecurityCheckIcon}
            iconColor="text-primary"
            bgColor="bg-primary/10"
          />
          <StatCard
            label="Layer 1 Passes"
            value={metrics.l1Passes}
            icon={SecurityCheckIcon}
            iconColor="text-score-excellent"
            bgColor="bg-score-excellent/10"
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
        </div>

        {/* Two-column layout */}
        <div className="flex-1 grid grid-cols-5 gap-6 min-h-0">
          {/* Left: Inspection timeline (3/5 width) */}
          <div className="col-span-3 bg-card rounded-3xl border border-border overflow-hidden flex flex-col min-h-0">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">
                Inspection Timeline
              </h2>
              <span className="text-xs text-muted-foreground">
                {inspections.length} inspections
              </span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {inspections.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                  No inspection data available. Seed data will populate
                  automatically.
                </div>
              ) : (
                inspections.map((entry) => (
                  <TimelineEntry key={entry.id} entry={entry} />
                ))
              )}
            </div>
          </div>

          {/* Right: Flagged agent threat cards (2/5 width) */}
          <div className="col-span-2 flex flex-col gap-4 overflow-y-auto min-h-0">
            <h2 className="text-base font-semibold text-foreground px-1">
              Flagged Agents
            </h2>
            {THREAT_PROFILES.map((threat) => {
              const agent = agents[threat.walletName];
              return (
                <ThreatCard
                  key={threat.walletName}
                  threat={threat}
                  reputationScore={agent?.reputationScore}
                />
              );
            })}
          </div>
        </div>
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
    <div className="bg-card rounded-3xl border border-border p-5 flex items-center gap-4">
      <div
        className={`w-10 h-10 rounded-2xl ${bgColor} flex items-center justify-center shrink-0`}
      >
        <HugeiconsIcon icon={icon} size={20} className={iconColor} />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// -- Timeline entry component --

function TimelineEntry({ entry }: { entry: CivicInspection }) {
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
    <div
      className={`flex items-center gap-3 px-5 py-3 border-b border-border transition-colors ${rowBg}`}
    >
      {/* Severity dot */}
      <span className={`w-2 h-2 rounded-full ${severityDot} shrink-0`} />

      {/* Icon */}
      <HugeiconsIcon
        icon={resultIcon}
        size={16}
        className={`shrink-0 ${resultColor}`}
      />

      {/* Agent name */}
      <span className="text-[13px] font-medium text-foreground w-28 shrink-0 truncate">
        {entry.agentName}
      </span>

      {/* Layer badge */}
      {entry.layer === 'L1' ? (
        <Badge className="bg-primary/20 text-primary text-[11px] px-2 py-0.5">
          L1
        </Badge>
      ) : (
        <Badge className="bg-score-moderate/20 text-score-moderate text-[11px] px-2 py-0.5">
          L2
        </Badge>
      )}

      {/* Description */}
      <span
        className={`flex-1 text-[13px] ${
          entry.severity === 'critical'
            ? 'text-score-critical'
            : entry.severity === 'warning'
              ? 'text-score-moderate'
              : 'text-muted-foreground'
        } truncate`}
      >
        {entry.description}
      </span>

      {/* Timestamp */}
      <span className="text-xs text-muted-foreground shrink-0">
        {formatTimestamp(entry.timestamp)}
      </span>
    </div>
  );
}

// -- Threat card component --

function ThreatCard({
  threat,
  reputationScore,
}: {
  threat: ThreatProfile;
  reputationScore?: number;
}) {
  const attackTypeLabel =
    threat.attackType === 'prompt-injection'
      ? 'Prompt Injection'
      : 'Sybil Ring';

  const attackTypeBadgeBg =
    threat.attackType === 'prompt-injection'
      ? 'bg-score-critical/20 text-score-critical'
      : 'bg-purple-600/20 text-purple-400';

  return (
    <div className="bg-card rounded-3xl border border-score-critical/30 p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={CancelCircleIcon}
            size={18}
            className="text-score-critical"
          />
          <span className="text-[15px] font-semibold text-foreground">
            {threat.name}
          </span>
        </div>
        {reputationScore !== undefined && (
          <span className="text-sm font-bold text-score-critical">
            {reputationScore.toFixed(1)}/10
          </span>
        )}
      </div>

      {/* Attack type badge + severity */}
      <div className="flex items-center gap-2">
        <Badge className={`${attackTypeBadgeBg} text-[11px] px-2 py-0.5`}>
          {attackTypeLabel}
        </Badge>
        <Badge className="bg-score-critical/20 text-score-critical text-[11px] px-2 py-0.5">
          Critical
        </Badge>
      </div>

      {/* Description */}
      <p className="text-[13px] text-muted-foreground leading-relaxed">
        {threat.attackDescription}
      </p>

      {/* Status bar */}
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <span className="w-2 h-2 rounded-full bg-score-critical" />
        <span className="text-xs text-score-critical font-medium">
          Blocked by Civic L2
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          Excluded from marketplace
        </span>
      </div>
    </div>
  );
}
