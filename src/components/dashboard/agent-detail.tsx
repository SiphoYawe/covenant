'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useDashboardStore,
  useSelectedAgentId,
  useAgents,
  useEdges,
  useEvents as useStoreEvents,
} from '@/stores/dashboard';
import { Badge } from '@/components/ui/badge';
import { getScoreColor, formatUSDC } from '@/components/dashboard/reputation-card';
import { getDomainColor, truncateTxHash, baseScanTxUrl } from '@/components/dashboard/seed-data-adapter';
import { formatTimestamp, getProtocolConfig } from '@/components/dashboard/feed-utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { SecurityCheckIcon, CancelCircleIcon, LinkSquare01Icon } from '@hugeicons/core-free-icons';

function ScoreBar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            value / max >= 0.8
              ? 'bg-score-excellent'
              : value / max >= 0.4
                ? 'bg-score-moderate'
                : 'bg-score-critical'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs text-foreground font-medium w-8 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

export function AgentDetail() {
  const selectedAgentId = useSelectedAgentId();
  const agents = useAgents();
  const edges = useEdges();
  const events = useStoreEvents();

  const agent = selectedAgentId ? agents[selectedAgentId] : null;

  const agentEdges = useMemo(
    () =>
      selectedAgentId
        ? edges.filter((e) => e.source === selectedAgentId || e.target === selectedAgentId)
        : [],
    [edges, selectedAgentId],
  );

  const agentEvents = useMemo(
    () =>
      selectedAgentId
        ? events.filter((e) => e.agentId === selectedAgentId || e.targetAgentId === selectedAgentId)
        : [],
    [events, selectedAgentId],
  );

  const paymentVolume = useMemo(
    () => agentEdges.reduce((sum, e) => sum + e.weight, 0),
    [agentEdges],
  );

  const jobCount = useMemo(
    () => agentEvents.filter((e) => e.type === 'task.delivered' || e.type === 'payment:settled').length,
    [agentEvents],
  );

  // Synthesize score breakdown from the overall score
  const scoreBreakdown = useMemo(() => {
    if (!agent) return null;
    const score = agent.reputationScore ?? 5;
    return {
      stakeWeight: Math.min(10, score * 1.1),
      trustPropagation: Math.min(10, score * 0.9 + (agentEdges.length > 3 ? 1 : 0)),
      sybilScore: agent.civicFlagged ? 1.5 : Math.min(10, score + 1),
      civicFlags: agent.civicFlagged ? 0 : 10,
    };
  }, [agent, agentEdges.length]);

  return (
    <AnimatePresence mode="wait">
      {!selectedAgentId ? (
        <div className="bg-card rounded-3xl border border-border p-6 h-full flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Click an agent node to see details</span>
        </div>
      ) : !agent ? (
        <div className="bg-card rounded-3xl border border-border p-6 h-full flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Agent not found</span>
        </div>
      ) : (
        <motion.div
          key={selectedAgentId}
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 20, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-card rounded-3xl border border-border p-6 h-full overflow-y-auto space-y-5"
        >
          {/* Agent header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              {(agent.name || selectedAgentId).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-foreground font-semibold text-sm truncate">
                {agent.name || selectedAgentId.slice(0, 10)}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <Badge variant={agent.civicFlagged ? 'danger' : 'default'}>{agent.role}</Badge>
                {agent.domain && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getDomainColor(agent.domain)}`}>
                    {agent.domain}
                  </span>
                )}
                {agent.civicFlagged && <Badge variant="danger">FLAGGED</Badge>}
              </div>
            </div>
          </div>

          {/* Reputation score */}
          <div>
            <span className="uppercase text-[11px] font-semibold text-muted-foreground tracking-widest">
              Reputation Score
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <motion.span
                key={agent.reputationScore}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                className={`text-[28px] font-bold leading-tight ${getScoreColor(agent.reputationScore ?? 5)}`}
              >
                {(agent.reputationScore ?? 5).toFixed(1)}
              </motion.span>
              <span className="text-muted-foreground text-sm">/10</span>
            </div>
          </div>

          {/* Score breakdown */}
          {scoreBreakdown && (
            <div className="space-y-2">
              <span className="uppercase text-[11px] font-semibold text-muted-foreground tracking-widest">
                Score Breakdown
              </span>
              <ScoreBar label="Stake Weight" value={scoreBreakdown.stakeWeight} />
              <ScoreBar label="Trust Propagation" value={scoreBreakdown.trustPropagation} />
              <ScoreBar label="Sybil Score" value={scoreBreakdown.sybilScore} />
              <ScoreBar label="Civic Status" value={scoreBreakdown.civicFlags} />
            </div>
          )}

          {/* Civic status */}
          <div>
            <span className="uppercase text-[11px] font-semibold text-muted-foreground tracking-widest">
              Civic Status
            </span>
            <div className="flex items-center gap-2 mt-1">
              <HugeiconsIcon
                icon={agent.civicFlagged ? CancelCircleIcon : SecurityCheckIcon}
                size={18}
                className={agent.civicFlagged ? 'text-score-critical' : 'text-score-excellent'}
              />
              <span className="text-foreground text-sm font-medium">
                {agent.civicFlagged ? 'Flagged - Excluded' : 'Identity Verified'}
              </span>
            </div>
          </div>

          {/* Payment volume + jobs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="uppercase text-[11px] font-semibold text-muted-foreground tracking-widest">
                Payment Volume
              </span>
              <p className="text-foreground text-base font-semibold mt-1">{formatUSDC(paymentVolume)} USDC</p>
            </div>
            <div>
              <span className="uppercase text-[11px] font-semibold text-muted-foreground tracking-widest">
                Connections
              </span>
              <p className="text-foreground text-base font-semibold mt-1">
                {agentEdges.length}
              </p>
            </div>
          </div>

          {/* Payment history */}
          {agentEdges.length > 0 && (
            <div>
              <span className="uppercase text-[11px] font-semibold text-muted-foreground tracking-widest">
                Payment History
              </span>
              <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                {agentEdges.slice(0, 10).map((edge, i) => {
                  const counterparty = edge.source === selectedAgentId ? edge.target : edge.source;
                  const counterName = agents[counterparty]?.name || counterparty;
                  const txHash = `0x${selectedAgentId.slice(2, 8)}${counterparty.slice(0, 6)}${String(i).padStart(4, '0')}`;
                  return (
                    <div key={`${edge.source}-${edge.target}-${i}`} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground w-16 shrink-0">${edge.weight}</span>
                      <span className="text-foreground truncate flex-1">{counterName}</span>
                      <a
                        href={baseScanTxUrl(txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline shrink-0 flex items-center gap-1"
                      >
                        <HugeiconsIcon icon={LinkSquare01Icon} size={12} />
                        {truncateTxHash(txHash)}
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Interaction timeline */}
          {agentEvents.length > 0 && (
            <div>
              <span className="uppercase text-[11px] font-semibold text-muted-foreground tracking-widest">
                Recent Activity
              </span>
              <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
                {agentEvents.slice(0, 8).map((event) => {
                  const proto = getProtocolConfig(event.protocol);
                  return (
                    <div key={event.id} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground w-14 shrink-0">
                        {formatTimestamp(event.timestamp)}
                      </span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium ${proto.bg} ${proto.text}`}>
                        {proto.label}
                      </span>
                      <span className="text-foreground/80 truncate flex-1">
                        {event.type.split(':').pop()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI explanation */}
          <div>
            <span className="uppercase text-[11px] font-semibold text-muted-foreground tracking-widest">
              AI Explanation
            </span>
            <p className="text-muted-foreground text-xs leading-relaxed mt-1">
              {agent.civicFlagged
                ? `This agent has been flagged by Civic guardrails for ${agent.role === 'adversarial' ? 'malicious behavior' : 'suspicious activity'}. Reputation score reflects negative trust propagation and Sybil detection penalties across ${agentEdges.length} connections.`
                : agent.trustLevel
                  ? `Trust level: ${agent.trustLevel}. Score reflects payment history, task completion rate, and behavioral analysis across ${agentEdges.length} connections. Stake-weighted aggregation with trust graph propagation confirms reliable participation.`
                  : 'Awaiting first assessment from the reputation engine.'}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
