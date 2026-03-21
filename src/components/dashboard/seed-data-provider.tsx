'use client';

import { useEffect, useRef } from 'react';
import { useDashboardStore } from '@/stores/dashboard';
import { AGENT_ROSTER } from '../../../seed/agents';
import { ALL_INTERACTIONS } from '../../../seed/interactions';
import {
  seedAgentsToStoreAgents,
  seedInteractionsToEdges,
  seedInteractionsToEvents,
} from '@/components/dashboard/seed-data-adapter';

export function SeedDataProvider({ children }: { children: React.ReactNode }) {
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;

    const store = useDashboardStore.getState();
    const agents = Object.values(store.agents);

    // Only seed if store is empty (no agents loaded from SSE yet)
    if (agents.length > 0) return;

    const storeAgents = seedAgentsToStoreAgents(AGENT_ROSTER.all);
    const edges = seedInteractionsToEdges(ALL_INTERACTIONS);
    const events = seedInteractionsToEvents(ALL_INTERACTIONS.slice(0, 50));

    // Compute payment volumes per agent from edges
    for (const edge of edges) {
      if (storeAgents[edge.source]) {
        storeAgents[edge.source].paymentVolume =
          (storeAgents[edge.source].paymentVolume ?? 0) + edge.weight;
      }
      if (storeAgents[edge.target]) {
        storeAgents[edge.target].paymentVolume =
          (storeAgents[edge.target].paymentVolume ?? 0) + edge.weight;
      }
    }

    // Compute total metrics from interactions
    const totalUsdc = ALL_INTERACTIONS.reduce((sum, ix) => sum + ix.usdcAmount, 0);

    useDashboardStore.setState({
      agents: storeAgents,
      edges,
      events,
      metrics: {
        totalPayments: totalUsdc,
        totalTransactions: ALL_INTERACTIONS.length,
        averagePayment: totalUsdc / ALL_INTERACTIONS.length,
        totalFeedback: ALL_INTERACTIONS.filter((ix) => ix.outcome === 'negative' || ix.outcome === 'rejected').length,
      },
    });
  }, []);

  return <>{children}</>;
}
