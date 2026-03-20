import { describe, it, expect } from 'vitest';
import type { AgentState, EconomicMetrics } from '@/stores/dashboard';
import {
  computeHealthScore,
  formatUSDCCompact,
  getHealthColor,
  countSybilAlerts,
} from '@/components/dashboard/metrics-utils';

const baseMetrics: EconomicMetrics = {
  totalPayments: 0,
  totalTransactions: 0,
  averagePayment: 0,
  totalFeedback: 0,
};

describe('metrics-utils', () => {
  describe('computeHealthScore', () => {
    it('returns 100 for perfect conditions', () => {
      const metrics: EconomicMetrics = {
        ...baseMetrics,
        totalTransactions: 10,
        totalFeedback: 0,
      };
      const agents: Record<string, AgentState> = {
        a: { agentId: 'a', name: 'A', role: 'r', reputationScore: 10, lastUpdated: 0 },
      };
      const score = computeHealthScore(metrics, agents, 0);
      expect(score).toBe(100);
    });

    it('returns 0 for worst conditions', () => {
      const metrics: EconomicMetrics = {
        ...baseMetrics,
        totalTransactions: 10,
        totalFeedback: 10,
      };
      const agents: Record<string, AgentState> = {
        a: { agentId: 'a', name: 'A', role: 'r', reputationScore: 0, lastUpdated: 0 },
      };
      const score = computeHealthScore(metrics, agents, 5);
      expect(score).toBe(0);
    });

    it('computes known score: 80% success, avg rep 7, 1 sybil alert', () => {
      const metrics: EconomicMetrics = {
        ...baseMetrics,
        totalTransactions: 10,
        totalFeedback: 2,
      };
      const agents: Record<string, AgentState> = {
        a: { agentId: 'a', name: 'A', role: 'r', reputationScore: 7, lastUpdated: 0 },
      };
      // successRate = 0.8, avgRep = 7, sybil = 1
      // 0.8*40 + (7/10)*40 + max(0, 20-5) = 32 + 28 + 15 = 75
      const score = computeHealthScore(metrics, agents, 1);
      expect(score).toBe(75);
    });

    it('handles zero transactions gracefully', () => {
      const score = computeHealthScore(baseMetrics, {}, 0);
      // successRate = 0, avgRep = 5 (default), sybil = 0
      // 0 + (5/10)*40 + 20 = 0 + 20 + 20 = 40
      expect(score).toBe(40);
    });

    it('clamps score to 0-100 range', () => {
      const metrics: EconomicMetrics = {
        ...baseMetrics,
        totalTransactions: 10,
        totalFeedback: 20,
      };
      const score = computeHealthScore(metrics, {}, 10);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('formatUSDCCompact', () => {
    it('formats with $ prefix and 2 decimal places', () => {
      expect(formatUSDCCompact(0)).toBe('$0.00');
      expect(formatUSDCCompact(1234.5)).toBe('$1,234.50');
      expect(formatUSDCCompact(11)).toBe('$11.00');
    });
  });

  describe('getHealthColor', () => {
    it('returns green for score >= 80', () => {
      expect(getHealthColor(80)).toBe('text-green-400');
      expect(getHealthColor(100)).toBe('text-green-400');
    });

    it('returns yellow for score >= 50 and < 80', () => {
      expect(getHealthColor(50)).toBe('text-yellow-400');
      expect(getHealthColor(79)).toBe('text-yellow-400');
    });

    it('returns red for score < 50', () => {
      expect(getHealthColor(49)).toBe('text-red-400');
      expect(getHealthColor(0)).toBe('text-red-400');
    });
  });

  describe('countSybilAlerts', () => {
    it('counts agents with civicFlagged = true', () => {
      const agents: Record<string, AgentState> = {
        a: { agentId: 'a', name: 'A', role: 'r', civicFlagged: true, lastUpdated: 0 },
        b: { agentId: 'b', name: 'B', role: 'r', civicFlagged: false, lastUpdated: 0 },
        c: { agentId: 'c', name: 'C', role: 'r', civicFlagged: true, lastUpdated: 0 },
      };
      expect(countSybilAlerts(agents)).toBe(2);
    });

    it('returns 0 when no agents are flagged', () => {
      expect(countSybilAlerts({})).toBe(0);
    });
  });
});
