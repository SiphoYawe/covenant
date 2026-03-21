import { describe, it, expect } from 'vitest';
import {
  getNodeColor,
  getNodeRadius,
  getEdgeColor,
  normalizeEdgeWidth,
  buildGraphData,
} from '@/components/dashboard/graph-utils';
import type { AgentState, TrustEdge } from '@/stores/dashboard';

describe('graph-utils', () => {
  describe('getNodeColor', () => {
    it('returns green for score >= 8', () => {
      expect(getNodeColor(8)).toBe('#34D399');
      expect(getNodeColor(10)).toBe('#34D399');
      expect(getNodeColor(9.5)).toBe('#34D399');
    });

    it('returns blue for score >= 4 and < 8', () => {
      expect(getNodeColor(4)).toBe('#00BBFF');
      expect(getNodeColor(7.9)).toBe('#00BBFF');
      expect(getNodeColor(5)).toBe('#00BBFF');
    });

    it('returns red for score < 4', () => {
      expect(getNodeColor(3.9)).toBe('#EF4444');
      expect(getNodeColor(0)).toBe('#EF4444');
      expect(getNodeColor(1)).toBe('#EF4444');
    });
  });

  describe('getNodeRadius', () => {
    it('returns 4 + score * 1.6', () => {
      expect(getNodeRadius(0)).toBe(4);
      expect(getNodeRadius(5)).toBe(12);
      expect(getNodeRadius(10)).toBe(20);
    });
  });

  describe('getEdgeColor', () => {
    it('returns green for success outcome', () => {
      expect(getEdgeColor('success')).toBe('#34D399');
    });

    it('returns red for fail outcome and default for other', () => {
      expect(getEdgeColor('fail')).toBe('#EF4444');
      expect(getEdgeColor('rejected')).toBe('#1E2A3A');
    });
  });

  describe('normalizeEdgeWidth', () => {
    it('normalizes volume to 1-5px range', () => {
      expect(normalizeEdgeWidth(0, 100)).toBe(1);
      expect(normalizeEdgeWidth(100, 100)).toBe(5);
      expect(normalizeEdgeWidth(50, 100)).toBe(3);
    });

    it('returns 1 when maxVolume is 0', () => {
      expect(normalizeEdgeWidth(0, 0)).toBe(1);
      expect(normalizeEdgeWidth(10, 0)).toBe(1);
    });
  });

  describe('buildGraphData', () => {
    it('converts agents and edges to graph data', () => {
      const agents: Record<string, AgentState> = {
        '0xaaa': {
          agentId: '0xaaa',
          name: 'Researcher',
          role: 'researcher',
          reputationScore: 9,
          lastUpdated: Date.now(),
        },
        '0xbbb': {
          agentId: '0xbbb',
          name: 'Reviewer',
          role: 'reviewer',
          reputationScore: 7,
          lastUpdated: Date.now(),
        },
      };

      const edges: TrustEdge[] = [
        { source: '0xaaa', target: '0xbbb', weight: 6, protocol: 'a2a' },
      ];

      const result = buildGraphData(agents, edges);

      expect(result.nodes).toHaveLength(2);
      expect(result.nodes[0]).toEqual({
        id: '0xaaa',
        name: 'Researcher',
        score: 9,
        role: 'researcher',
      });

      expect(result.links).toHaveLength(1);
      expect(result.links[0]).toEqual({
        source: '0xaaa',
        target: '0xbbb',
        volume: 6,
        outcome: 'success',
      });
    });

    it('defaults score to 5 when reputationScore is undefined', () => {
      const agents: Record<string, AgentState> = {
        '0xaaa': {
          agentId: '0xaaa',
          name: 'NewAgent',
          role: 'researcher',
          lastUpdated: Date.now(),
        },
      };

      const result = buildGraphData(agents, []);
      expect(result.nodes[0].score).toBe(0);
    });

    it('uses truncated agentId when name is empty', () => {
      const agents: Record<string, AgentState> = {
        '0xabcdef12': {
          agentId: '0xabcdef12',
          name: '',
          role: 'researcher',
          lastUpdated: Date.now(),
        },
      };

      const result = buildGraphData(agents, []);
      expect(result.nodes[0].name).toBe('0xabcdef');
    });
  });
});
