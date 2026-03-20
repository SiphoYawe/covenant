import { describe, test, expect } from 'vitest';
import {
  synthesizeScore,
  classifyAgent,
} from '@/lib/reputation/score-synthesis';
import type {
  ScoreSynthesisInput,
  ScoreSynthesisResult,
  SynthesisWeights,
} from '@/lib/reputation/types';

function makeInput(overrides: Partial<ScoreSynthesisInput> = {}): ScoreSynthesisInput {
  return {
    agentId: 'agent-b',
    stakeWeightedScore: 8.0,
    trustPropagationScore: 8.0,
    sybilAlerts: [],
    civicPenalty: 0,
    hasNegativeFeedback: false,
    ...overrides,
  };
}

describe('Score Synthesis', () => {
  describe('synthesizeScore', () => {
    test('all positive signals returns score 8+ (honest agent scenario)', () => {
      const input = makeInput({
        stakeWeightedScore: 9.0,
        trustPropagationScore: 8.5,
        civicPenalty: 0,
        sybilAlerts: [],
      });

      const result = synthesizeScore(input);

      expect(result.finalScore).toBeGreaterThanOrEqual(8.0);
      expect(result.agentId).toBe('agent-b');
    });

    test('Civic critical flag + negative feedback returns score 2- (malicious agent)', () => {
      const input = makeInput({
        agentId: 'agent-d',
        stakeWeightedScore: 1.0,
        trustPropagationScore: 0.5,
        civicPenalty: -3.0,
        hasNegativeFeedback: true,
        sybilAlerts: [
          {
            id: 'alert-1',
            patternType: 'adversarial_behavior',
            involvedAgents: ['agent-d'],
            confidence: 0.95,
            evidence: 'adversarial',
            timestamp: Date.now(),
          },
        ],
      });

      const result = synthesizeScore(input);

      expect(result.finalScore).toBeLessThanOrEqual(2.0);
    });

    test('clamps to 0.0 minimum (extreme negative case)', () => {
      const input = makeInput({
        stakeWeightedScore: 0,
        trustPropagationScore: 0,
        civicPenalty: -10.0,
        sybilAlerts: [
          {
            id: 'a',
            patternType: 'circular_payments',
            involvedAgents: ['x'],
            confidence: 1.0,
            evidence: 'test',
            timestamp: 1,
          },
        ],
      });

      const result = synthesizeScore(input);
      expect(result.finalScore).toBeGreaterThanOrEqual(0.0);
    });

    test('clamps to 10.0 maximum (extreme positive case)', () => {
      const input = makeInput({
        stakeWeightedScore: 15.0,
        trustPropagationScore: 15.0,
        civicPenalty: 0,
      });

      const result = synthesizeScore(input);
      expect(result.finalScore).toBeLessThanOrEqual(10.0);
    });

    test('determinism: same inputs produce identical outputs across 100 calls', () => {
      const input = makeInput({
        stakeWeightedScore: 7.5,
        trustPropagationScore: 6.8,
        civicPenalty: -1.0,
        sybilAlerts: [
          {
            id: 'a',
            patternType: 'uniform_feedback',
            involvedAgents: ['agent-b'],
            confidence: 0.6,
            evidence: 'test',
            timestamp: 1000,
          },
        ],
      });

      const results: number[] = [];
      for (let i = 0; i < 100; i++) {
        results.push(synthesizeScore(input).finalScore);
      }

      const first = results[0];
      for (const r of results) {
        expect(r).toBe(first);
      }
    });

    test('custom weights override defaults correctly', () => {
      const input = makeInput({
        stakeWeightedScore: 10.0,
        trustPropagationScore: 0.0,
      });

      const weights: SynthesisWeights = {
        stakeWeight: 1.0,
        trustPropagationWeight: 0.0,
        sybilPenaltyWeight: 0.0,
        civicPenaltyWeight: 0.0,
      };

      const result = synthesizeScore(input, weights);
      expect(result.finalScore).toBe(10.0);
    });

    test('zero Sybil alerts and zero Civic penalty produce clean base score', () => {
      const input = makeInput({
        stakeWeightedScore: 7.0,
        trustPropagationScore: 6.0,
        civicPenalty: 0,
        sybilAlerts: [],
      });

      const result = synthesizeScore(input);

      expect(result.components.sybilPenalty).toBe(0);
      expect(result.components.civicPenalty).toBe(0);
    });

    test('components are included in result', () => {
      const input = makeInput({
        stakeWeightedScore: 8.0,
        trustPropagationScore: 7.0,
        civicPenalty: -1.0,
        sybilAlerts: [
          {
            id: 'a',
            patternType: 'rapid_transactions',
            involvedAgents: ['agent-b'],
            confidence: 0.5,
            evidence: 'test',
            timestamp: 1,
          },
        ],
      });

      const result = synthesizeScore(input);

      expect(result.components.stakeWeightedScore).toBe(8.0);
      expect(result.components.trustPropagationScore).toBe(7.0);
      expect(result.components.civicPenalty).toBeGreaterThan(0);
      expect(result.components.sybilPenalty).toBeGreaterThan(0);
    });
  });

  describe('classifyAgent', () => {
    test('agent with score 8.5 and no flags classified as "trusted"', () => {
      const result: ScoreSynthesisResult = {
        agentId: 'agent-b',
        finalScore: 8.5,
        components: { stakeWeightedScore: 9, trustPropagationScore: 8, sybilPenalty: 0, civicPenalty: 0 },
        classification: 'neutral', // will be overridden
      };
      const input = makeInput({ civicPenalty: 0, hasNegativeFeedback: false });

      const classification = classifyAgent(result, input);
      expect(classification).toBe('trusted');
    });

    test('agent with score 6.0 classified as "neutral"', () => {
      const result: ScoreSynthesisResult = {
        agentId: 'test',
        finalScore: 6.0,
        components: { stakeWeightedScore: 6, trustPropagationScore: 6, sybilPenalty: 0, civicPenalty: 0 },
        classification: 'neutral',
      };
      const input = makeInput({ civicPenalty: 0 });

      expect(classifyAgent(result, input)).toBe('neutral');
    });

    test('agent with score 3.0 classified as "suspicious"', () => {
      const result: ScoreSynthesisResult = {
        agentId: 'test',
        finalScore: 3.0,
        components: { stakeWeightedScore: 3, trustPropagationScore: 3, sybilPenalty: 0, civicPenalty: 0 },
        classification: 'neutral',
      };
      const input = makeInput({ civicPenalty: 0 });

      expect(classifyAgent(result, input)).toBe('suspicious');
    });

    test('agent with score 1.5 classified as "adversarial"', () => {
      const result: ScoreSynthesisResult = {
        agentId: 'test',
        finalScore: 1.5,
        components: { stakeWeightedScore: 1, trustPropagationScore: 1, sybilPenalty: 1, civicPenalty: 2 },
        classification: 'neutral',
      };
      const input = makeInput({ civicPenalty: -2 });

      expect(classifyAgent(result, input)).toBe('adversarial');
    });

    test('Civic flag + negative feedback forces "adversarial" even if score above 2.0', () => {
      const result: ScoreSynthesisResult = {
        agentId: 'agent-d',
        finalScore: 5.0, // Would normally be "neutral"
        components: { stakeWeightedScore: 6, trustPropagationScore: 6, sybilPenalty: 0, civicPenalty: 1 },
        classification: 'neutral',
      };
      const input = makeInput({
        agentId: 'agent-d',
        civicPenalty: -1.0,
        hasNegativeFeedback: true,
      });

      expect(classifyAgent(result, input)).toBe('adversarial');
    });

    test('Civic flag alone without negative feedback does NOT force adversarial', () => {
      const result: ScoreSynthesisResult = {
        agentId: 'test',
        finalScore: 6.0,
        components: { stakeWeightedScore: 7, trustPropagationScore: 6, sybilPenalty: 0, civicPenalty: 1 },
        classification: 'neutral',
      };
      const input = makeInput({ civicPenalty: -1.0, hasNegativeFeedback: false });

      const classification = classifyAgent(result, input);
      expect(classification).not.toBe('adversarial');
    });
  });

  describe('demo scenarios', () => {
    test('Agent B: 2 successful deliveries, positive feedback, no flags -> 8+, trusted', () => {
      const input = makeInput({
        agentId: 'agent-b',
        stakeWeightedScore: 9.0,
        trustPropagationScore: 8.0,
        civicPenalty: 0,
        sybilAlerts: [],
        hasNegativeFeedback: false,
      });

      const result = synthesizeScore(input);
      expect(result.finalScore).toBeGreaterThanOrEqual(8.0);
      expect(result.classification).toBe('trusted');
    });

    test('Agent C: 1 successful delivery, positive feedback -> 8+, trusted', () => {
      const input = makeInput({
        agentId: 'agent-c',
        stakeWeightedScore: 8.5,
        trustPropagationScore: 8.0,
        civicPenalty: 0,
        sybilAlerts: [],
        hasNegativeFeedback: false,
      });

      const result = synthesizeScore(input);
      expect(result.finalScore).toBeGreaterThanOrEqual(8.0);
      expect(result.classification).toBe('trusted');
    });

    test('Agent D: rejected, Civic critical flag, payment failure -> 2-, adversarial', () => {
      const input = makeInput({
        agentId: 'agent-d',
        stakeWeightedScore: 1.0,
        trustPropagationScore: 0.5,
        civicPenalty: -3.0,
        hasNegativeFeedback: true,
        sybilAlerts: [
          {
            id: 'alert-d',
            patternType: 'adversarial_behavior',
            involvedAgents: ['agent-d'],
            confidence: 0.95,
            evidence: 'Civic flagged + payment failure',
            timestamp: Date.now(),
          },
        ],
      });

      const result = synthesizeScore(input);
      expect(result.finalScore).toBeLessThanOrEqual(2.0);
      expect(result.classification).toBe('adversarial');
    });
  });
});
