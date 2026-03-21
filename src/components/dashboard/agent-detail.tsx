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
import { getDomainColor } from '@/components/dashboard/seed-data-adapter';
import { formatTimestamp, getProtocolConfig } from '@/components/dashboard/feed-utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { SecurityCheckIcon, CancelCircleIcon } from '@hugeicons/core-free-icons';

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

  return (
    <AnimatePresence mode="wait">
      {!selectedAgentId ? (
        <div className="bg-card rounded-xl card-elevated p-6 h-full flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Click an agent node to see details</span>
        </div>
      ) : !agent ? (
        <div className="bg-card rounded-xl card-elevated p-6 h-full flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Agent not found</span>
        </div>
      ) : (
        <motion.div
          key={selectedAgentId}
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 20, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-card card-elevated rounded-xl p-5 h-full overflow-y-auto space-y-5"
        >
          {/* Agent header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              {(agent.name || selectedAgentId).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-foreground font-semibold text-sm truncate">
                {agent.name || selectedAgentId.slice(0, 10)}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <Badge variant={agent.civicFlagged ? 'danger' : 'default'}>{agent.role}</Badge>
                {agent.domain && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getDomainColor(agent.domain)}`}>
                    {agent.domain}
                  </span>
                )}
                {agent.civicFlagged && <Badge variant="danger">FLAGGED</Badge>}
              </div>
            </div>
          </div>

          {/* Reputation score */}
          <div>
            <span className="uppercase text-xs font-medium text-muted-foreground tracking-wider">
              Reputation Score
            </span>
            {agent.reputationScore != null ? (
              <div className="flex items-baseline gap-2 mt-1">
                <motion.span
                  key={agent.reputationScore}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  className={`text-3xl font-bold leading-none ${getScoreColor(agent.reputationScore)}`}
                >
                  {agent.reputationScore.toFixed(1)}
                </motion.span>
                <span className="text-muted-foreground text-sm">/10</span>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm mt-1">Pending computation</p>
            )}
          </div>

          {/* Civic status */}
          <div>
            <span className="uppercase text-xs font-medium text-muted-foreground tracking-wider">
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
              <span className="uppercase text-xs font-medium text-muted-foreground tracking-wider">
                Payment Volume
              </span>
              <p className="text-foreground text-base font-semibold mt-1">{formatUSDC(paymentVolume)} USDC</p>
            </div>
            <div>
              <span className="uppercase text-xs font-medium text-muted-foreground tracking-wider">
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
              <span className="uppercase text-xs font-medium text-muted-foreground tracking-wider">
                Payment History
              </span>
              <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                {agentEdges.slice(0, 10).map((edge, i) => {
                  const counterparty = edge.source === selectedAgentId ? edge.target : edge.source;
                  const counterName = agents[counterparty]?.name || counterparty;
                  return (
                    <div key={`${edge.source}-${edge.target}-${i}`} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground w-16 shrink-0">{edge.weight} USDC</span>
                      <span className="text-foreground truncate flex-1">{counterName}</span>
                      <span className="text-muted-foreground shrink-0 uppercase text-xs">{edge.protocol}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Interaction timeline */}
          {agentEvents.length > 0 && (
            <div>
              <span className="uppercase text-xs font-medium text-muted-foreground tracking-wider">
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
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${proto.bg} ${proto.text}`}>
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
            <span className="uppercase text-xs font-medium text-muted-foreground tracking-wider">
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
