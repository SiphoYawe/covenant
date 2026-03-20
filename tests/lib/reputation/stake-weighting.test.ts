import { describe, test, expect } from 'vitest';
import { computeStakeWeights, ZERO_STAKE_WEIGHT } from '@/lib/reputation/stake-weighting';
import type { FeedbackRecord } from '@/lib/reputation/types';

function makeFeedback(
  agentId: string,
  feedbackValue: number,
  paymentAmount: number,
  timestamp = Date.now()
): FeedbackRecord {
  return {
    agentId,
    feedbackValue,
    paymentAmount,
    transactionHash: `0x${Math.random().toString(16).slice(2)}`,
    timestamp,
  };
}

describe('computeStakeWeights', () => {
  test('single positive feedback (6 USDC) returns correct weighted score', () => {
    const feedbacks = [makeFeedback('agent-b', 1, 6)];
    const results = computeStakeWeights(feedbacks);

    expect(results).toHaveLength(1);
    expect(results[0].agentId).toBe('agent-b');
    expect(results[0].weightedAverage).toBe(1); // 1 * 6 / 6 = 1
    expect(results[0].totalStake).toBe(6);
    expect(results[0].feedbackCount).toBe(1);
    expect(results[0].weightedFeedbacks).toHaveLength(1);
    expect(results[0].weightedFeedbacks[0].stakeWeight).toBe(6);
    expect(results[0].weightedFeedbacks[0].weightedScore).toBe(6); // 1 * 6
  });

  test('single negative feedback (3 USDC) returns correct weighted score', () => {
    const feedbacks = [makeFeedback('agent-d', -1, 3)];
    const results = computeStakeWeights(feedbacks);

    expect(results).toHaveLength(1);
    expect(results[0].agentId).toBe('agent-d');
    expect(results[0].weightedAverage).toBe(-1); // -1 * 3 / 3 = -1
    expect(results[0].totalStake).toBe(3);
    expect(results[0].weightedFeedbacks[0].weightedScore).toBe(-3); // -1 * 3
  });

  test('6 USDC positive + 1 USDC negative verifies 6x weight ratio', () => {
    const feedbacks = [
      makeFeedback('agent-b', 1, 6),
      makeFeedback('agent-b', -1, 1),
    ];
    const results = computeStakeWeights(feedbacks);

    expect(results).toHaveLength(1);
    const r = results[0];
    // weightedAverage = (1*6 + -1*1) / (6+1) = 5/7 ≈ 0.714
    expect(r.weightedAverage).toBeCloseTo(5 / 7, 10);
    expect(r.totalStake).toBe(7);
    expect(r.feedbackCount).toBe(2);
  });

  test('zero-stake feedback is assigned ZERO_STAKE_WEIGHT (0.01)', () => {
    const feedbacks = [makeFeedback('agent-b', 1, 0)];
    const results = computeStakeWeights(feedbacks);

    expect(results).toHaveLength(1);
    expect(results[0].weightedFeedbacks[0].stakeWeight).toBe(ZERO_STAKE_WEIGHT);
    expect(results[0].totalStake).toBe(ZERO_STAKE_WEIGHT);
  });

  test('multiple agents returns per-agent StakeWeightedResult', () => {
    const feedbacks = [
      makeFeedback('agent-a', 1, 5),
      makeFeedback('agent-b', 1, 3),
      makeFeedback('agent-a', -1, 2),
    ];
    const results = computeStakeWeights(feedbacks);

    expect(results).toHaveLength(2);
    const agentA = results.find((r) => r.agentId === 'agent-a');
    const agentB = results.find((r) => r.agentId === 'agent-b');
    expect(agentA).toBeDefined();
    expect(agentB).toBeDefined();
    expect(agentA!.feedbackCount).toBe(2);
    expect(agentB!.feedbackCount).toBe(1);
    // Agent A: (1*5 + -1*2) / (5+2) = 3/7
    expect(agentA!.weightedAverage).toBeCloseTo(3 / 7, 10);
  });

  test('empty feedback array returns empty results', () => {
    const results = computeStakeWeights([]);
    expect(results).toEqual([]);
  });

  test('all-negative feedback returns negative weighted average', () => {
    const feedbacks = [
      makeFeedback('agent-d', -1, 5),
      makeFeedback('agent-d', -1, 3),
    ];
    const results = computeStakeWeights(feedbacks);

    expect(results[0].weightedAverage).toBe(-1);
  });

  test('determinism: same inputs produce identical outputs across runs', () => {
    const feedbacks = [
      makeFeedback('agent-b', 1, 6, 1000),
      makeFeedback('agent-a', -1, 3, 2000),
      makeFeedback('agent-b', 1, 2, 3000),
    ];

    // Use same tx hashes for determinism
    feedbacks[0].transactionHash = '0xaaa';
    feedbacks[1].transactionHash = '0xbbb';
    feedbacks[2].transactionHash = '0xccc';

    const result1 = computeStakeWeights(feedbacks);
    const result2 = computeStakeWeights(feedbacks);

    expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
  });

  test('large stake amounts do not cause overflow or precision issues', () => {
    const feedbacks = [
      makeFeedback('agent-a', 1, 1000),
      makeFeedback('agent-a', -1, 500),
    ];
    const results = computeStakeWeights(feedbacks);

    // (1*1000 + -1*500) / (1000+500) = 500/1500 = 1/3
    expect(results[0].weightedAverage).toBeCloseTo(1 / 3, 10);
    expect(results[0].totalStake).toBe(1500);
  });

  test('ZERO_STAKE_WEIGHT constant equals 0.01', () => {
    expect(ZERO_STAKE_WEIGHT).toBe(0.01);
  });
});
