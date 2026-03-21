import { describe, it, expect, vi, afterEach } from 'vitest';
import { Protocol, type DemoEvent } from '@/lib/events';
import {
  formatEventDescription,
  formatTimestamp,
  getProtocolConfig,
  isCivicFlagEvent,
  PROTOCOL_COLORS,
} from '@/components/dashboard/feed-utils';

function makeEvent(overrides: Partial<DemoEvent> = {}): DemoEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'agent:registered',
    protocol: Protocol.Erc8004,
    data: {},
    ...overrides,
  };
}

describe('feed-utils', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getProtocolConfig', () => {
    it('returns correct config for all 6 protocols', () => {
      expect(getProtocolConfig(Protocol.A2a).label).toBe('A2A');
      expect(getProtocolConfig(Protocol.A2a).bg).toBe('bg-primary/20');

      expect(getProtocolConfig(Protocol.X402).label).toBe('x402');
      expect(getProtocolConfig(Protocol.X402).bg).toBe('bg-score-excellent/20');

      expect(getProtocolConfig(Protocol.Mcp).label).toBe('MCP');
      expect(getProtocolConfig(Protocol.Mcp).bg).toContain('purple');

      expect(getProtocolConfig(Protocol.Erc8004).label).toBe('ERC-8004');
      expect(getProtocolConfig(Protocol.Erc8004).bg).toBe('bg-score-moderate/20');

      expect(getProtocolConfig(Protocol.Civic).label).toBe('Civic');
      expect(getProtocolConfig(Protocol.Civic).bg).toBe('bg-error/20');

      expect(getProtocolConfig(Protocol.CovenantAi).label).toBe('Covenant AI');
      expect(getProtocolConfig(Protocol.CovenantAi).bg).toBe('bg-warning/20');
    });

    it('returns fallback for unknown protocol', () => {
      const config = getProtocolConfig('unknown-proto');
      expect(config.label).toBe('unknown-proto');
      expect(config.bg).toBe('bg-secondary');
    });

    it('has 6 protocol entries', () => {
      expect(Object.keys(PROTOCOL_COLORS)).toHaveLength(6);
    });
  });

  describe('formatEventDescription', () => {
    it('formats agent:registered event', () => {
      const event = makeEvent({
        type: 'agent:registered',
        agentId: '0xabc',
        data: { name: 'Researcher' },
      });
      expect(formatEventDescription(event)).toBe(
        'Agent Researcher registered on ERC-8004',
      );
    });

    it('formats task:negotiated event', () => {
      const event = makeEvent({
        type: 'task:negotiated',
        agentId: '0xaaa',
        targetAgentId: '0xbbb',
        protocol: Protocol.A2a,
        data: { name: 'Agent A', targetName: 'Agent B', price: 6 },
      });
      expect(formatEventDescription(event)).toBe(
        'Agent Agent A negotiated with Agent B at 6 USDC',
      );
    });

    it('formats payment:settled event', () => {
      const event = makeEvent({
        type: 'payment:settled',
        agentId: '0xaaa',
        targetAgentId: '0xbbb',
        protocol: Protocol.X402,
        data: { name: 'Agent A', payeeName: 'Agent B', amount: 6 },
      });
      expect(formatEventDescription(event)).toBe(
        'Agent Agent A paid Agent B 6 USDC via x402',
      );
    });

    it('formats civic:flagged event', () => {
      const event = makeEvent({
        type: 'civic:flagged',
        agentId: '0xbad',
        protocol: Protocol.Civic,
        data: {
          name: 'Malicious',
          attackType: 'prompt_injection',
          severity: 'critical',
        },
      });
      expect(formatEventDescription(event)).toBe(
        'Civic flagged Agent Malicious: prompt_injection (critical)',
      );
    });

    it('formats reputation:updated event', () => {
      const event = makeEvent({
        type: 'reputation:updated',
        agentId: '0xaaa',
        protocol: Protocol.CovenantAi,
        data: { name: 'Researcher', reputationScore: 9.1 },
      });
      expect(formatEventDescription(event)).toBe(
        'Agent Researcher reputation updated to 9.1/10',
      );
    });

    it('formats demo:act-changed event', () => {
      const event = makeEvent({
        type: 'demo:act-changed',
        data: { act: 3, status: 'running' },
      });
      expect(formatEventDescription(event)).toBe('Demo Act 3: running');
    });

    it('handles unknown event type with fallback', () => {
      const event = makeEvent({
        type: 'custom:unknown',
        agentId: '0xabc123',
        data: {},
      });
      expect(formatEventDescription(event)).toBe(
        'custom:unknown event for Agent 0xabc123',
      );
    });

    it('falls back to truncated agentId when name is missing', () => {
      const event = makeEvent({
        type: 'agent:registered',
        agentId: '0xabcdef12',
        data: {},
      });
      expect(formatEventDescription(event)).toContain('0xabcdef');
    });
  });

  describe('formatTimestamp', () => {
    it('returns "just now" for recent timestamps', () => {
      expect(formatTimestamp(Date.now() - 2000)).toBe('just now');
    });

    it('returns seconds ago', () => {
      expect(formatTimestamp(Date.now() - 30000)).toBe('30s ago');
    });

    it('returns minutes ago', () => {
      expect(formatTimestamp(Date.now() - 120000)).toBe('2m ago');
    });

    it('returns hours ago', () => {
      expect(formatTimestamp(Date.now() - 7200000)).toBe('2h ago');
    });

    it('returns days ago', () => {
      expect(formatTimestamp(Date.now() - 172800000)).toBe('2d ago');
    });
  });

  describe('isCivicFlagEvent', () => {
    it('returns true for civic:flagged events', () => {
      const event = makeEvent({ type: 'civic:flagged', protocol: Protocol.Civic });
      expect(isCivicFlagEvent(event)).toBe(true);
    });

    it('returns false for other events', () => {
      const event = makeEvent({ type: 'agent:registered' });
      expect(isCivicFlagEvent(event)).toBe(false);
    });

    it('returns false for other civic events', () => {
      const event = makeEvent({ type: 'civic:cleared', protocol: Protocol.Civic });
      expect(isCivicFlagEvent(event)).toBe(false);
    });
  });
});
