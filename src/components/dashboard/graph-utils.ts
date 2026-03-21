import type { AgentState, TrustEdge } from '@/stores/dashboard';

// --- Design token colors ---

const SCORE_EXCELLENT = '#34D399';
const SCORE_GOOD = '#00BBFF';
const SCORE_CRITICAL = '#EF4444';
const EDGE_DEFAULT = '#1E2A3A';

// Role-based colors (AC #1)
const ROLE_COLORS: Record<string, string> = {
  requester: '#00BBFF',
  provider: '#00FF88',
  adversarial: '#FF4444',
};

// --- Node utilities ---

export const getNodeColor = (score: number, role?: string): string => {
  if (role && ROLE_COLORS[role]) return ROLE_COLORS[role];
  return score >= 8 ? SCORE_EXCELLENT : score >= 4 ? SCORE_GOOD : SCORE_CRITICAL;
};

export const getNodeRadius = (score: number): number => 4 + score * 1.6;

// --- Edge utilities ---

export const getEdgeColor = (outcome: string): string =>
  outcome === 'success' ? SCORE_EXCELLENT : outcome === 'fail' ? SCORE_CRITICAL : EDGE_DEFAULT;

export const normalizeEdgeWidth = (
  volume: number,
  maxVolume: number,
): number => {
  if (maxVolume <= 0) return 1;
  return 1 + (volume / maxVolume) * 4;
};

// --- Data transformation ---

export type GraphNode = {
  id: string;
  name: string;
  score: number;
  role: string;
};

export type GraphLink = {
  source: string;
  target: string;
  volume: number;
  outcome: string;
};

export type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

export function buildGraphData(
  agents: Record<string, AgentState>,
  edges: TrustEdge[],
): GraphData {
  const nodes: GraphNode[] = Object.values(agents).map((a) => ({
    id: a.agentId,
    name: a.name || a.agentId.slice(0, 8),
    score: a.reputationScore ?? 0,
    role: a.role,
  }));

  const nodeIds = new Set(nodes.map((n) => n.id));

  const links: GraphLink[] = edges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({
      source: e.source,
      target: e.target,
      volume: e.weight,
      outcome: 'success',
    }));

  return { nodes, links };
}
