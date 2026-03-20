'use client';

import { useEffect, useState } from 'react';
import { useDashboardStore, useAgents } from '@/stores/dashboard';

export function useReputation() {
  const agents = useAgents();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchScores() {
      try {
        const res = await fetch('/api/reputation/scores');
        if (!res.ok) {
          if (res.status === 404) {
            // API not yet implemented — graceful degradation
            setIsLoading(false);
            return;
          }
          throw new Error(`Failed to fetch reputation scores: ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;

        const { updateAgent } = useDashboardStore.getState();
        for (const agent of data.agents ?? []) {
          updateAgent(agent.agentId, {
            name: agent.name,
            role: agent.role,
            reputationScore: agent.score,
            lastUpdated: Date.now(),
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchScores();
    return () => {
      cancelled = true;
    };
  }, []);

  return { agents, isLoading, error };
}
