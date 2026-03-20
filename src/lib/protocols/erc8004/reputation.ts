import { getSDK } from './client';
import { createEventBus } from '@/lib/events/bus';
import { EVENT_TYPES } from '@/lib/events/constants';
import { Protocol } from '@/lib/events/types';
import { env } from '@/lib/config/env';
import type { FeedbackSubmission, FeedbackResult } from './types';

/** ERC-8004 feedback value: 5 = positive, 1 = negative (1-5 scale) */
const POSITIVE_VALUE = 5;
const NEGATIVE_VALUE = 1;

/**
 * Get SDK for the evaluating agent.
 * In the demo, Agent A (researcher) is the evaluator.
 */
function getSDKForAgent(_feedbackerAgentId: string) {
  const privateKey = env.AGENT_A_PRIVATE_KEY;
  return getSDK(privateKey);
}

/**
 * Submit feedback to the ERC-8004 ReputationRegistry on-chain.
 * Uses the evaluating agent's wallet for signing.
 *
 * SDK API: sdk.giveFeedback(agentId, value, tag1?, tag2?, endpoint?, feedbackFile?)
 */
export async function giveFeedback(data: FeedbackSubmission): Promise<FeedbackResult> {
  const bus = createEventBus();

  try {
    const sdk = getSDKForAgent(data.feedbackerAgentId);
    const value = data.isPositive ? POSITIVE_VALUE : NEGATIVE_VALUE;

    const tx = await sdk.giveFeedback(
      data.targetAgentId,
      value,
      'covenant', // tag1: protocol tag
      data.isPositive ? 'positive' : 'negative', // tag2: feedback direction
      undefined, // endpoint
      {
        text: data.feedbackURI || undefined,
        proofOfPayment: { txHash: data.proofOfPayment },
      }
    );

    const mined = await tx.waitMined();

    const result: FeedbackResult = {
      txHash: mined.receipt.transactionHash ?? tx.hash,
      feedbackerAgentId: data.feedbackerAgentId,
      targetAgentId: data.targetAgentId,
      isPositive: data.isPositive,
      timestamp: Date.now(),
    };

    await bus.emit({
      type: EVENT_TYPES.FEEDBACK_SUBMITTED,
      protocol: Protocol.Erc8004,
      agentId: data.feedbackerAgentId,
      targetAgentId: data.targetAgentId,
      data: {
        isPositive: data.isPositive,
        txHash: result.txHash,
        proofOfPayment: data.proofOfPayment,
      },
    });

    return result;
  } catch (error) {
    await bus.emit({
      type: 'feedback:failed',
      protocol: Protocol.Erc8004,
      agentId: data.feedbackerAgentId,
      targetAgentId: data.targetAgentId,
      data: {
        error: error instanceof Error ? error.message : 'Unknown error',
        targetAgentId: data.targetAgentId,
      },
    });
    throw error;
  }
}
