'use client';

import { useMemo, useCallback } from 'react';
import { useDashboardStore, useSelectedAgentId } from '@/stores/dashboard';
import { useReputation } from '@/hooks/use-reputation';
import { ReputationCard } from '@/components/dashboard/reputation-card';

export function ReputationCards() {
  const { agents, isLoading, error } = useReputation();
  const selectedAgentId = useSelectedAgentId();

  const sortedAgents = useMemo(() => {
    return Object.values(agents).sort(
      (a, b) => (b.reputationScore ?? 5) - (a.reputationScore ?? 5),
    );
  }, [agents]);

  const handleSelect = useCallback((agentId: string) => {
    useDashboardStore.getState().setSelectedAgent(agentId);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 rounded-3xl bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-3xl border border-error bg-error/10 text-error-foreground text-sm">
        {error}
      </div>
    );
  }

  if (sortedAgents.length === 0) {
    return (
      <div className="p-4 text-muted-foreground text-sm text-center">
        No agents registered yet.
      </div>
    );
  }

  return (
    <div className="space-y-3 overflow-y-auto">
      {sortedAgents.map((agent) => (
        <ReputationCard
          key={agent.agentId}
          agentId={agent.agentId}
          name={agent.name}
          role={agent.role}
          score={agent.reputationScore ?? 5}
          previousScore={null}
          paymentVolume={0}
          jobCount={0}
          explanation={null}
          civicFlags={
            agent.civicFlagged
              ? { severity: 'critical', count: 1, latestReason: 'Civic flagged' }
              : null
          }
          isSelected={agent.agentId === selectedAgentId}
          onSelect={handleSelect}
        />
      ))}
    </div>
  );
}
