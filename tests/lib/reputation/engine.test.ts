import { describe, test, expect, vi, beforeEach } from 'vitest';
import { zaddCalls, clearKvStore, createKvMock } from '../../helpers/kv-mock';

// Mock KV at the abstraction boundary
vi.mock('@/lib/storage/kv', () => createKvMock());

import {
  triggerReputationPipeline,
  parseFeedbackEvent,
} from '@/lib/reputation/engine';
import type { ReputationFeedbackEvent } from '@/lib/reputation/types';

describe('Reputation Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearKvStore();
  });

  describe('parseFeedbackEvent', () => {
    test('parses an on-chain feedback event into a ReputationFeedbackEvent', () => {
      const onChainEvent = {
        targetAgentId: 'agent-b',
        feedbackerAddress: '0x1234',
        isPositive: true,
        feedbackURI: 'ipfs://bafybeig...',
        blockNumber: 12345,
        txHash: '0xabcdef',
      };

      const parsed = parseFeedbackEvent(onChainEvent);

      expect(parsed.targetAgentId).toBe('agent-b');
      expect(parsed.feedbackValue).toBe(1);
      expect(parsed.feedbackUri).toBe('ipfs://bafybeig...');
      expect(parsed.proofOfPayment).toBe('0xabcdef');
      expect(parsed.sourceAgentId).toBe('0x1234');
      expect(parsed.timestamp).toBeGreaterThan(0);
    });

    test('parses negative feedback with feedbackValue -1', () => {
      const onChainEvent = {
        targetAgentId: 'agent-d',
        feedbackerAddress: '0x5678',
        isPositive: false,
        feedbackURI: 'ipfs://bafyneg...',
        blockNumber: 12346,
        txHash: '0xfedcba',
      };

      const parsed = parseFeedbackEvent(onChainEvent);

      expect(parsed.feedbackValue).toBe(-1);
      expect(parsed.targetAgentId).toBe('agent-d');
    });
  });

  describe('triggerReputationPipeline', () => {
    test('runs the pipeline and returns a result with status', async () => {
      const feedbackEvent: ReputationFeedbackEvent = {
        targetAgentId: 'agent-b',
        feedbackValue: 1,
        feedbackUri: 'ipfs://bafybeig...',
        proofOfPayment: '0xabcdef',
        sourceAgentId: 'agent-a',
        timestamp: Date.now(),
      };

      const result = await triggerReputationPipeline(feedbackEvent);

      expect(result.agentId).toBe('agent-b');
      expect(result.status).toBe('computing');
      expect(result.pipelineStages).toContain('stake-weighting');
      expect(result.pipelineStages).toContain('graph');
      expect(result.pipelineStages).toContain('trust-propagation');
      expect(result.startedAt).toBeGreaterThan(0);
    });

    test('handles errors gracefully without crashing', async () => {
      const feedbackEvent: ReputationFeedbackEvent = {
        targetAgentId: '',
        feedbackValue: 1,
        feedbackUri: '',
        proofOfPayment: '',
        sourceAgentId: '',
        timestamp: Date.now(),
      };

      // Should not throw, should return error status
      const result = await triggerReputationPipeline(feedbackEvent);
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });

    test('emits reputation:computing event to event bus', async () => {
      const feedbackEvent: ReputationFeedbackEvent = {
        targetAgentId: 'agent-c',
        feedbackValue: 1,
        feedbackUri: 'ipfs://test',
        proofOfPayment: '0x123',
        sourceAgentId: 'agent-a',
        timestamp: Date.now(),
      };

      await triggerReputationPipeline(feedbackEvent);

      // Event bus uses kv.zadd to store events
      expect(zaddCalls.length).toBeGreaterThan(0);
    });
  });
});
