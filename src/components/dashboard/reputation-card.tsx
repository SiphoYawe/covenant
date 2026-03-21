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
  researcher: 'bg-primary/20 text-primary',
  reviewer: 'bg-purple-600/20 text-purple-400',
  summarizer: 'bg-teal-600/20 text-teal-400',
  malicious: 'bg-error/20 text-error-foreground',
  system: 'bg-secondary text-muted-foreground',
};

export function getScoreColor(score: number): string {
  if (score >= 8) return 'text-score-excellent';
  if (score >= 6) return 'text-score-good';
  if (score >= 4) return 'text-score-moderate';
  if (score >= 2) return 'text-score-poor';
  return 'text-score-critical';
}

export function getTrendIndicator(
  score: number,
  previousScore: number | null,
): { symbol: string; color: string } {
  if (previousScore === null || score === previousScore) {
    return { symbol: '—', color: 'text-muted-foreground' };
  }
  if (score > previousScore) {
    return { symbol: '\u2191', color: 'text-score-excellent' };
  }
  return { symbol: '\u2193', color: 'text-score-critical' };
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
      className={`w-full text-left p-4 bg-card rounded-3xl border transition-colors ${
        isSelected
          ? 'border-primary bg-primary/10'
          : 'border-border hover:border-primary/50'
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
          <span className="text-muted-foreground text-sm">/10</span>
          <span className={`text-sm ${trend.color}`}>{trend.symbol}</span>
        </div>
      </div>

      <div className="flex gap-4 text-sm text-muted-foreground mb-2">
        <span>{formatUSDC(paymentVolume)}</span>
        <span>{jobCount} {jobCount === 1 ? 'job' : 'jobs'}</span>
      </div>

      {civicFlags && (
        <div className="mb-2">
          <Badge variant={civicFlags.severity === 'critical' ? 'danger' : 'warning'}>
            {civicFlags.severity === 'critical' ? 'FLAGGED' : 'WARNING'}
          </Badge>
          <span className="text-xs text-muted-foreground ml-2">{civicFlags.latestReason}</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground leading-relaxed">
        {explanation ?? 'Awaiting first assessment...'}
      </p>
    </button>
  );
}
