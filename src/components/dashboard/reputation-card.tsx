'use client';

import { Badge } from '@/components/ui/badge';

export type CivicFlagSummary = {
  severity: 'warning' | 'critical';
  count: number;
  latestReason: string;
};

export type ReputationCardProps = {
  agentId: string;
  name: string;
  role: string;
  score: number;
  previousScore: number | null;
  paymentVolume: number;
  jobCount: number;
  explanation: string | null;
  civicFlags: CivicFlagSummary | null;
  isSelected: boolean;
  onSelect: (agentId: string) => void;
};

const ROLE_COLORS: Record<string, string> = {
  researcher: 'bg-blue-600/20 text-blue-400',
  reviewer: 'bg-purple-600/20 text-purple-400',
  summarizer: 'bg-teal-600/20 text-teal-400',
  malicious: 'bg-red-600/20 text-red-400',
  system: 'bg-zinc-600/20 text-zinc-400',
};

export function getScoreColor(score: number): string {
  if (score >= 8) return 'text-green-400';
  if (score >= 4) return 'text-yellow-400';
  return 'text-red-400';
}

export function getTrendIndicator(
  score: number,
  previousScore: number | null,
): { symbol: string; color: string } {
  if (previousScore === null || score === previousScore) {
    return { symbol: '—', color: 'text-zinc-500' };
  }
  if (score > previousScore) {
    return { symbol: '\u2191', color: 'text-green-400' };
  }
  return { symbol: '\u2193', color: 'text-red-400' };
}

export function formatUSDC(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function ReputationCard({
  agentId,
  name,
  role,
  score,
  previousScore,
  paymentVolume,
  jobCount,
  explanation,
  civicFlags,
  isSelected,
  onSelect,
}: ReputationCardProps) {
  const trend = getTrendIndicator(score, previousScore);

  return (
    <button
      type="button"
      onClick={() => onSelect(agentId)}
      className={`w-full text-left p-4 rounded-lg border transition-colors ${
        isSelected
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{name || agentId.slice(0, 8)}</span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[role] ?? ROLE_COLORS.system}`}
          >
            {role}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-lg font-bold ${getScoreColor(score)}`}>
            {score.toFixed(1)}
          </span>
          <span className="text-zinc-500 text-sm">/10</span>
          <span className={`text-sm ${trend.color}`}>{trend.symbol}</span>
        </div>
      </div>

      <div className="flex gap-4 text-sm text-zinc-400 mb-2">
        <span>{formatUSDC(paymentVolume)}</span>
        <span>{jobCount} {jobCount === 1 ? 'job' : 'jobs'}</span>
      </div>

      {civicFlags && (
        <div className="mb-2">
          <Badge variant={civicFlags.severity === 'critical' ? 'danger' : 'warning'}>
            {civicFlags.severity === 'critical' ? 'FLAGGED' : 'WARNING'}
          </Badge>
          <span className="text-xs text-zinc-500 ml-2">{civicFlags.latestReason}</span>
        </div>
      )}

      <p className="text-xs text-zinc-500 leading-relaxed">
        {explanation ?? 'Awaiting first assessment...'}
      </p>
    </button>
  );
}
