import { createEventBus } from '@/lib/events/bus';
import { EVENT_TYPES } from '@/lib/events/constants';
import { Protocol } from '@/lib/events/types';
import type { FeedbackEvent as OnChainFeedbackEvent } from '@/lib/protocols/erc8004/types';
import type { ReputationFeedbackEvent, ReputationComputeResult } from './types';

const PIPELINE_STAGES = [
  'stake-weighting',
  'graph',
  'trust-propagation',
  'sybil-detection',
  'score-synthesis',
  'explanation',
  'write-back',
] as const;

/**
 * Parse an on-chain FeedbackGiven event into the reputation engine's internal format.
 */
export function parseFeedbackEvent(onChainEvent: OnChainFeedbackEvent): ReputationFeedbackEvent {
  return {
    targetAgentId: onChainEvent.targetAgentId,
    feedbackValue: onChainEvent.isPositive ? 1 : -1,
    feedbackUri: onChainEvent.feedbackURI,
    proofOfPayment: onChainEvent.txHash,
    sourceAgentId: onChainEvent.feedbackerAddress,
    timestamp: Date.now(),
  };
}

/**
 * Trigger the full reputation recomputation pipeline for a given feedback event.
 * Pipeline stages: stake-weighting, graph, trust-propagation, sybil-detection,
 * score-synthesis, explanation, write-back.
 *
 * Downstream stages are stubs (NotImplementedError) until Stories 5.2-5.8.
 */
export async function triggerReputationPipeline(
  feedbackEvent: ReputationFeedbackEvent
): Promise<ReputationComputeResult> {
  const bus = createEventBus();
  const startedAt = Date.now();

  try {
    // Emit computing event
    await bus.emit({
      type: EVENT_TYPES.REPUTATION_COMPUTING,
      protocol: Protocol.CovenantAi,
      agentId: feedbackEvent.targetAgentId,
      data: {
        sourceAgentId: feedbackEvent.sourceAgentId,
        feedbackValue: feedbackEvent.feedbackValue,
        stage: 'started',
      },
    });

    // Pipeline stages will be filled in by Stories 5.2-5.8.
    // For now, record that the pipeline was triggered.

    const result: ReputationComputeResult = {
      agentId: feedbackEvent.targetAgentId,
      status: 'computing',
      pipelineStages: [...PIPELINE_STAGES],
      startedAt,
    };

    // Emit updated event
    await bus.emit({
      type: EVENT_TYPES.REPUTATION_UPDATED,
      protocol: Protocol.CovenantAi,
      agentId: feedbackEvent.targetAgentId,
      data: {
        status: 'computing',
        pipelineStages: [...PIPELINE_STAGES],
        computeTimeMs: Date.now() - startedAt,
      },
    });

    return result;
  } catch (error) {
    // Graceful degradation: log error event, do not crash
    try {
      await bus.emit({
        type: EVENT_TYPES.REPUTATION_UPDATED,
        protocol: Protocol.CovenantAi,
        agentId: feedbackEvent.targetAgentId,
        data: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    } catch {
      // If event bus itself fails, swallow to avoid crash
    }

    return {
      agentId: feedbackEvent.targetAgentId,
      status: 'error',
      pipelineStages: [...PIPELINE_STAGES],
      startedAt,
    };
  }
}
