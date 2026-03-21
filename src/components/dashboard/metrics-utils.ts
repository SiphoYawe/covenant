import type { AgentState, EconomicMetrics } from '@/stores/dashboard';

export function computeHealthScore(
  metrics: EconomicMetrics,
  agents: Record<string, AgentState>,
  sybilAlerts: number,
): number {
  const total = metrics.totalTransactions;
  const successRate = total > 0 ? (total - (metrics.totalFeedback ?? 0)) / total : 0;

  const agentValues = Object.values(agents);
  const scored = agentValues.filter((a) => a.reputationScore != null);
  const avgReputation =
    scored.length > 0
      ? scored.reduce((sum, a) => sum + a.reputationScore!, 0) / scored.length
      : 0;

  const score =
    successRate * 40 +
    (avgReputation / 10) * 40 +
    Math.max(0, 20 - sybilAlerts * 5);

  return Math.min(100, Math.max(0, Math.round(score)));
}

export function formatUSDCCompact(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getHealthColor(score: number): string {
  if (score >= 80) return 'text-score-excellent';
  if (score >= 50) return 'text-score-moderate';
  return 'text-score-critical';
}

export function countSybilAlerts(agents: Record<string, AgentState>): number {
  return Object.values(agents).filter((a) => a.civicFlagged).length;
}
