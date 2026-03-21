import { describe, it, expect, beforeEach } from 'vitest';
import {
  seedAgentsToStoreAgents,
  seedInteractionsToEdges,
  seedInteractionsToEvents,
  filterAgents,
  sortAgents,
  paginateItems,
  truncateTxHash,
  baseScanTxUrl,
  getDomainColor,
  getStatusIndicator,
} from '@/components/dashboard/seed-data-adapter';
import { AGENT_ROSTER } from '../../../seed/agents';
import type { AgentState, TrustEdge } from '@/stores/dashboard';

describe('Seed Data Adapter', () => {
  describe('seedAgentsToStoreAgents', () => {
    it('converts all 28 seed agents to store format', () => {
      const result = seedAgentsToStoreAgents(AGENT_ROSTER.all);
      const agents = Object.values(result);
      expect(agents).toHaveLength(28);
    });

    it('preserves agent name and role', () => {
      const result = seedAgentsToStoreAgents(AGENT_ROSTER.all);
      const nexus = Object.values(result).find((a) => a.name === 'NexusResearch');
      expect(nexus).toBeDefined();
      expect(nexus!.role).toBe('requester');
    });

    it('maps adversarial agents with civicFlagged', () => {
      const result = seedAgentsToStoreAgents(AGENT_ROSTER.all);
      const adversarial = Object.values(result).filter((a) => a.civicFlagged);
      expect(adversarial.length).toBe(4);
    });

    it('assigns domain from seed profile', () => {
      const result = seedAgentsToStoreAgents(AGENT_ROSTER.all);
      const nexus = Object.values(result).find((a) => a.name === 'NexusResearch');
      expect(nexus!.domain).toBe('AI research');
    });

    it('assigns realistic reputation scores based on role', () => {
      const result = seedAgentsToStoreAgents(AGENT_ROSTER.all);
      const agents = Object.values(result);
      // Providers should have scores
      const providers = agents.filter((a) => a.role === 'provider');
      providers.forEach((p) => {
        expect(p.reputationScore).toBeGreaterThanOrEqual(0);
        expect(p.reputationScore).toBeLessThanOrEqual(10);
      });
      // Adversarial should have low scores
      const adversarial = agents.filter((a) => a.civicFlagged);
      adversarial.forEach((a) => {
        expect(a.reputationScore!).toBeLessThan(4);
      });
    });
  });

  describe('filterAgents', () => {
    let agents: Record<string, AgentState>;

    beforeEach(() => {
      agents = {
        a1: { agentId: 'a1', name: 'Top', role: 'provider', reputationScore: 9, lastUpdated: 0, domain: 'Code review' },
        a2: { agentId: 'a2', name: 'Mid', role: 'requester', reputationScore: 6, lastUpdated: 0, domain: 'DeFi security' },
        a3: { agentId: 'a3', name: 'Bad', role: 'adversarial', reputationScore: 1.5, civicFlagged: true, lastUpdated: 0, domain: 'Code review' },
        a4: { agentId: 'a4', name: 'Flagged', role: 'provider', reputationScore: 3, civicFlagged: true, lastUpdated: 0, domain: 'Summarization' },
      } as Record<string, AgentState>;
    });

    it('returns all agents with filter "all"', () => {
      const result = filterAgents(Object.values(agents), 'all');
      expect(result).toHaveLength(4);
    });

    it('returns agents with score > 8 for "top-rated"', () => {
      const result = filterAgents(Object.values(agents), 'top-rated');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Top');
    });

    it('returns civic-flagged agents for "flagged"', () => {
      const result = filterAgents(Object.values(agents), 'flagged');
      expect(result).toHaveLength(2);
    });

    it('returns adversarial/excluded agents for "excluded"', () => {
      const result = filterAgents(Object.values(agents), 'excluded');
      expect(result.every((a) => a.civicFlagged || a.role === 'adversarial')).toBe(true);
    });
  });

  describe('sortAgents', () => {
    const agents: AgentState[] = [
      { agentId: 'a1', name: 'Beta', role: 'provider', reputationScore: 5, lastUpdated: 0, domain: 'Code review' } as AgentState,
      { agentId: 'a2', name: 'Alpha', role: 'requester', reputationScore: 9, lastUpdated: 0, domain: 'AI research' } as AgentState,
      { agentId: 'a3', name: 'Gamma', role: 'provider', reputationScore: 3, lastUpdated: 0, domain: 'Summarization' } as AgentState,
    ];

    it('sorts by score descending', () => {
      const result = sortAgents(agents, 'score');
      expect(result[0].reputationScore).toBe(9);
      expect(result[2].reputationScore).toBe(3);
    });

    it('sorts by domain alphabetical', () => {
      const result = sortAgents(agents, 'domain');
      expect(result[0].domain).toBe('AI research');
      expect(result[2].domain).toBe('Summarization');
    });

    it('sorts by payment-volume descending', () => {
      const agentsWithVolume = agents.map((a, i) => ({ ...a, paymentVolume: (i + 1) * 10 }));
      const result = sortAgents(agentsWithVolume, 'payment-volume');
      expect((result[0] as AgentState & { paymentVolume: number }).paymentVolume).toBe(30);
    });
  });

  describe('paginateItems', () => {
    const items = Array.from({ length: 28 }, (_, i) => i);

    it('returns first page of 12 items', () => {
      const result = paginateItems(items, 1, 12);
      expect(result.items).toHaveLength(12);
      expect(result.items[0]).toBe(0);
      expect(result.items[11]).toBe(11);
    });

    it('returns second page', () => {
      const result = paginateItems(items, 2, 12);
      expect(result.items).toHaveLength(12);
      expect(result.items[0]).toBe(12);
    });

    it('returns partial last page', () => {
      const result = paginateItems(items, 3, 12);
      expect(result.items).toHaveLength(4);
    });

    it('returns total pages', () => {
      const result = paginateItems(items, 1, 12);
      expect(result.totalPages).toBe(3);
    });

    it('handles empty array', () => {
      const result = paginateItems([], 1, 12);
      expect(result.items).toHaveLength(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('truncateTxHash', () => {
    it('truncates to first 6 and last 4 chars', () => {
      const hash = '0x1234567890abcdef1234567890abcdef12345678';
      expect(truncateTxHash(hash)).toBe('0x1234...5678');
    });

    it('returns short hashes as-is', () => {
      expect(truncateTxHash('0x1234')).toBe('0x1234');
    });
  });

  describe('baseScanTxUrl', () => {
    it('generates correct BaseScan Sepolia URL', () => {
      const hash = '0xabcdef123456';
      expect(baseScanTxUrl(hash)).toBe('https://sepolia.basescan.org/tx/0xabcdef123456');
    });
  });

  describe('getDomainColor', () => {
    it('returns a color for known domains', () => {
      expect(getDomainColor('Code review')).toBeTruthy();
      expect(getDomainColor('DeFi security')).toBeTruthy();
    });

    it('returns a default color for unknown domains', () => {
      expect(getDomainColor('unknown-domain')).toBeTruthy();
    });
  });

  describe('getStatusIndicator', () => {
    it('returns "excluded" for flagged agents', () => {
      expect(getStatusIndicator(true, 'adversarial')).toBe('excluded');
    });

    it('returns "flagged" for civic-flagged non-adversarial', () => {
      expect(getStatusIndicator(true, 'provider')).toBe('excluded');
    });

    it('returns "active" for normal agents', () => {
      expect(getStatusIndicator(false, 'provider')).toBe('active');
    });
  });
});
