import type { SeedAgentProfile, SeedInteraction } from '../../../seed/types';
import type { AgentState, TrustEdge } from '@/stores/dashboard';
import type { DemoEvent } from '@/lib/events';
import { Protocol } from '@/lib/events';

export function seedAgentsToStoreAgents(
  profiles: SeedAgentProfile[],
): Record<string, AgentState> {
  const result: Record<string, AgentState> = {};
  for (const profile of profiles) {
    const id = profile.walletName;
    result[id] = {
      agentId: id,
      name: profile.name,
      role: profile.role,
      domain: profile.domain,
      lastUpdated: Date.now(),
      paymentVolume: 0,
    };
  }
  return result;
}

export function seedInteractionsToEdges(
  interactions: SeedInteraction[],
): TrustEdge[] {
  const edgeMap = new Map<string, TrustEdge>();
  for (const ix of interactions) {
    const key = `${ix.requester}-${ix.provider}`;
    const existing = edgeMap.get(key);
    if (existing) {
      existing.weight += ix.usdcAmount;
    } else {
      edgeMap.set(key, {
        source: ix.requester,
        target: ix.provider,
        weight: ix.usdcAmount,
        protocol: 'x402',
      });
    }
  }
  return Array.from(edgeMap.values());
}

export function seedInteractionsToEvents(
  interactions: SeedInteraction[],
): DemoEvent[] {
  const baseTime = Date.now() - interactions.length * 60000;
  return interactions.map((ix, i) => ({
    id: ix.id,
    timestamp: baseTime + i * 60000,
    type: ix.outcome === 'rejected' ? 'payment:failed' : 'payment:settled',
    protocol: Protocol.X402,
    agentId: ix.requester,
    targetAgentId: ix.provider,
    data: {
      amount: ix.usdcAmount,
      name: ix.requester,
      targetName: ix.provider,
      phase: ix.phase,
      capability: ix.capabilityRequired,
      description: ix.description,
      outcome: ix.outcome,
      ...(ix.civicFlags ? { civicFlags: ix.civicFlags } : {}),
      ...(ix.isMalicious ? { isMalicious: true } : {}),
      ...(ix.isSybilRing ? { isSybilRing: true } : {}),
    },
  }));
}

// --- Filter/Sort/Paginate utilities ---

export function filterAgents(
  agents: AgentState[],
  filter: string,
): AgentState[] {
  switch (filter) {
    case 'top-rated':
      return agents.filter((a) => (a.reputationScore ?? 0) > 8);
    case 'flagged':
      return agents.filter((a) => a.civicFlagged);
    case 'excluded':
      return agents.filter((a) => a.civicFlagged || a.role === 'adversarial');
    default:
      return agents;
  }
}

export function sortAgents(
  agents: AgentState[],
  sortBy: string,
): AgentState[] {
  const sorted = [...agents];
  switch (sortBy) {
    case 'score':
      return sorted.sort((a, b) => (b.reputationScore ?? 0) - (a.reputationScore ?? 0));
    case 'payment-volume':
      return sorted.sort(
        (a, b) =>
          ((b as AgentState & { paymentVolume?: number }).paymentVolume ?? 0) -
          ((a as AgentState & { paymentVolume?: number }).paymentVolume ?? 0),
      );
    case 'domain':
      return sorted.sort((a, b) => (a.domain ?? '').localeCompare(b.domain ?? ''));
    default:
      return sorted;
  }
}

export type PaginatedResult<T> = {
  items: T[];
  totalPages: number;
  currentPage: number;
};

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  if (items.length === 0) {
    return { items: [], totalPages: 0, currentPage: page };
  }
  const totalPages = Math.ceil(items.length / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return {
    items: items.slice(start, end),
    totalPages,
    currentPage: page,
  };
}

// --- BaseScan utilities ---

export function truncateTxHash(hash: string): string {
  if (hash.length <= 10) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

export function baseScanTxUrl(txHash: string): string {
  return `https://sepolia.basescan.org/tx/${txHash}`;
}

// --- Domain colors ---

const DOMAIN_COLORS: Record<string, string> = {
  'AI research': 'bg-primary/20 text-primary',
  'DeFi security': 'bg-score-critical/20 text-score-critical',
  'Content creation': 'bg-purple-600/20 text-purple-400',
  'On-chain data analytics': 'bg-score-moderate/20 text-score-moderate',
  'DAO governance': 'bg-teal-600/20 text-teal-400',
  'Crypto news intelligence': 'bg-blue-500/20 text-blue-400',
  'Developer tooling': 'bg-cyan-600/20 text-cyan-400',
  'Code review': 'bg-emerald-600/20 text-emerald-400',
  'Smart contract auditing': 'bg-orange-600/20 text-orange-400',
  'Text summarization': 'bg-indigo-600/20 text-indigo-400',
  'Translation and localization': 'bg-pink-600/20 text-pink-400',
  'Data analysis': 'bg-yellow-600/20 text-yellow-400',
  'Sentiment analysis': 'bg-violet-600/20 text-violet-400',
  'Content generation': 'bg-fuchsia-600/20 text-fuchsia-400',
  'Financial forecasting': 'bg-amber-600/20 text-amber-400',
  'Legal review': 'bg-slate-600/20 text-slate-400',
  'Image classification': 'bg-lime-600/20 text-lime-400',
  'On-chain analytics': 'bg-sky-600/20 text-sky-400',
  'Technical documentation': 'bg-stone-600/20 text-stone-400',
  'QA and testing': 'bg-green-600/20 text-green-400',
  'Gas optimization': 'bg-red-600/20 text-red-400',
  'Token analysis': 'bg-rose-600/20 text-rose-400',
  'MEV analysis': 'bg-orange-500/20 text-orange-300',
  'Fast summarization': 'bg-indigo-500/20 text-indigo-300',
  'Summarization and feedback': 'bg-gray-600/20 text-gray-400',
  'Data analysis and feedback': 'bg-gray-600/20 text-gray-400',
  'Code review and summarization': 'bg-gray-600/20 text-gray-400',
};

export function getDomainColor(domain: string): string {
  return DOMAIN_COLORS[domain] ?? 'bg-secondary text-muted-foreground';
}

// --- Status indicator ---

export function getStatusIndicator(
  civicFlagged: boolean | undefined,
  role: string,
): 'active' | 'flagged' | 'excluded' {
  if (civicFlagged || role === 'adversarial') return 'excluded';
  return 'active';
}
