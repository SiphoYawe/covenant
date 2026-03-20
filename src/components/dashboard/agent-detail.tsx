'use client';

import {
  useDashboardStore,
  useSelectedAgentId,
  useAgents,
  useEdges,
  useEvents as useStoreEvents,
} from '@/stores/dashboard';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getScoreColor, formatUSDC } from '@/components/dashboard/reputation-card';
import { formatEventDescription, formatTimestamp, getProtocolConfig } from '@/components/dashboard/feed-utils';

export function AgentDetail() {
  const selectedAgentId = useSelectedAgentId();
  const agents = useAgents();
  const edges = useEdges();
  const events = useStoreEvents();

  if (!selectedAgentId) {
    return (
      <Card className="flex items-center justify-center h-full text-zinc-500 text-sm">
        Click an agent node to see details
      </Card>
    );
  }

  const agent = agents[selectedAgentId];
  if (!agent) {
    return (
      <Card className="text-zinc-500 text-sm">
        Agent not found
      </Card>
    );
  }

  const score = agent.reputationScore ?? 5;
  const agentEdges = edges.filter(
    (e) => e.source === selectedAgentId || e.target === selectedAgentId,
  );
  const agentEvents = events.filter(
    (e) => e.agentId === selectedAgentId || e.targetAgentId === selectedAgentId,
  );

  return (
    <Card title={agent.name || selectedAgentId.slice(0, 10)}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant={agent.civicFlagged ? 'danger' : 'default'}>
            {agent.role}
          </Badge>
          <span className={`text-xl font-bold ${getScoreColor(score)}`}>
            {score.toFixed(1)}/10
          </span>
          {agent.civicFlagged && (
            <Badge variant="danger">FLAGGED</Badge>
          )}
        </div>

        {agentEdges.length > 0 && (
          <div>
            <h4 className="text-xs text-zinc-500 mb-1">Transactions ({agentEdges.length})</h4>
            <div className="space-y-1">
              {agentEdges.map((edge, i) => (
                <div key={i} className="text-xs text-zinc-400 flex justify-between">
                  <span>
                    {edge.source === selectedAgentId ? 'Paid' : 'Received from'}{' '}
                    {(edge.source === selectedAgentId ? edge.target : edge.source).slice(0, 8)}
                  </span>
                  <span>{formatUSDC(edge.weight)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {agentEvents.length > 0 && (
          <div>
            <h4 className="text-xs text-zinc-500 mb-1">
              Recent Activity ({agentEvents.length})
            </h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {agentEvents.slice(0, 10).map((event) => {
                const proto = getProtocolConfig(event.protocol);
                return (
                  <div key={event.id} className="text-xs text-zinc-400 flex items-start gap-2">
                    <span className="text-zinc-600 whitespace-nowrap">
                      {formatTimestamp(event.timestamp)}
                    </span>
                    <span className={`${proto.text} whitespace-nowrap`}>{proto.label}</span>
                    <span className="flex-1">{formatEventDescription(event)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!agent.civicFlagged && agentEdges.length === 0 && agentEvents.length === 0 && (
          <p className="text-xs text-zinc-500">No activity recorded yet.</p>
        )}
      </div>
    </Card>
  );
}
