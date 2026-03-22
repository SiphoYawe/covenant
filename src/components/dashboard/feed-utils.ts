import type { DemoEvent } from '@/lib/events';
import { Protocol } from '@/lib/events';

// --- Protocol badge configuration ---

export type ProtocolConfig = {
  label: string;
  bg: string;
  text: string;
};

export const PROTOCOL_COLORS: Record<string, ProtocolConfig> = {
  [Protocol.A2a]: { label: 'A2A', bg: 'bg-primary/20', text: 'text-primary' },
  [Protocol.X402]: { label: 'x402', bg: 'bg-score-excellent/20', text: 'text-score-excellent' },
  [Protocol.Mcp]: { label: 'MCP', bg: 'bg-purple-600/20', text: 'text-purple-400' },
  [Protocol.Erc8004]: { label: 'ERC-8004', bg: 'bg-score-moderate/20', text: 'text-score-moderate' },
  [Protocol.Civic]: { label: 'Civic', bg: 'bg-error/20', text: 'text-error-foreground' },
  [Protocol.CovenantAi]: { label: 'Covenant AI', bg: 'bg-warning/20', text: 'text-warning-foreground' },
};

export function getProtocolConfig(protocol: string): ProtocolConfig {
  return (
    PROTOCOL_COLORS[protocol] ?? {
      label: protocol,
      bg: 'bg-secondary',
      text: 'text-muted-foreground',
    }
  );
}

// --- Event description formatting ---

export function formatEventDescription(event: DemoEvent): string {
  const d = event.data;
  const agent = (d.name as string) || event.agentId?.slice(0, 8) || 'Unknown';

  switch (event.type) {
    case 'agent:registered':
      return `${agent} registered on ERC-8004`;
    case 'agent:metadata-stored':
      return `${agent} metadata pinned to IPFS`;
    case 'task:requested':
      return `${agent} submitted a task request`;
    case 'task:negotiated': {
      const target = (d.targetName as string) || event.targetAgentId?.slice(0, 8) || 'unknown';
      const price = d.price ?? d.agreedPrice ?? d.amount;
      const priceStr = price != null ? `${price} USDC` : 'terms agreed';
      return `${agent} negotiated with ${target}: ${priceStr}`;
    }
    case 'task:delivered':
      return `${agent} delivered task results`;
    case 'task:accepted':
      return `${agent} accepted delivery`;
    case 'task:rejected':
      return `${agent} rejected delivery`;
    case 'payment:initiated': {
      const amt = d.amount ?? d.usdcAmount;
      return `Payment initiated${amt != null ? `: ${amt} USDC` : ''}`;
    }
    case 'payment:settled': {
      const target = (d.payeeName as string) || event.targetAgentId?.slice(0, 8) || 'unknown';
      const amt = d.amount ?? d.usdcAmount;
      return `${agent} paid ${target} ${amt != null ? `${amt} USDC` : ''} via x402`;
    }
    case 'payment:failed':
      return `Payment failed: ${d.reason ?? 'unknown error'}`;
    case 'civic:identity-checked':
      return `Civic L1 identity check on ${agent}`;
    case 'civic:behavioral-checked':
      return `Civic L2 behavioral scan on ${agent}`;
    case 'civic:flagged':
      return `Civic flagged ${agent}: ${d.attackType ?? 'suspicious behavior'} (${d.severity ?? 'warning'})`;
    case 'civic:cleared':
      return `${agent} cleared by Civic`;
    case 'reputation:computing':
      return `Computing reputation for ${agent}`;
    case 'reputation:updated':
      return `${agent} reputation updated to ${d.reputationScore ?? '?'}/10`;
    case 'reputation:explanation-stored':
      return `AI explanation stored for ${agent}`;
    case 'feedback:submitted':
      return `Feedback submitted for ${agent}`;
    case 'feedback:recorded-onchain':
      return `Feedback recorded on-chain for ${agent}`;
    case 'demo:act-changed':
      return `Demo Act ${d.act ?? '?'}: ${d.status ?? 'started'}`;
    case 'demo:reset':
      return 'Demo state reset';
    case 'demo:complete':
      return 'Demo sequence complete';
    default:
      return `${event.type.split(':').pop()} for ${agent}`;
  }
}

// --- Timestamp formatting ---

export function formatTimestamp(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);

  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// --- Civic flag detection ---

export function isCivicFlagEvent(event: DemoEvent): boolean {
  return event.type === 'civic:flagged';
}
