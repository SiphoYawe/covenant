import { createPublicClient, http, parseAbiItem } from 'viem';
import { baseSepolia } from 'viem/chains';
import { kv } from '@vercel/kv';
import { env } from '@/lib/config/env';
import { createEventBus } from '@/lib/events/bus';
import { Protocol } from '@/lib/events/types';
import { REPUTATION_REGISTRY_ADDRESS } from '@/lib/config/contracts';
import type { FeedbackEvent } from './types';

const LAST_BLOCK_KEY = 'erc8004:feedback:lastBlock';

const FEEDBACK_GIVEN_EVENT = parseAbiItem(
  'event FeedbackGiven(string indexed targetAgentId, address feedbackerAddress, bool isPositive, string feedbackURI)'
);

function getPublicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(env.BASE_SEPOLIA_RPC_URL),
  });
}

/**
 * Poll for FeedbackGiven events on the ReputationRegistry.
 * Uses getLogs with fromBlock tracking for crash recovery (Architecture Decision D9).
 * Returns detected events and emits feedback:detected for each.
 */
export async function pollFeedbackEvents(): Promise<FeedbackEvent[]> {
  const client = getPublicClient();
  const bus = createEventBus();

  // Resume from last processed block (crash recovery)
  const lastBlock = await kv.get<number>(LAST_BLOCK_KEY);
  const fromBlock = lastBlock ? BigInt(lastBlock + 1) : undefined;
  const toBlock = await client.getBlockNumber();

  const logs = await client.getLogs({
    address: REPUTATION_REGISTRY_ADDRESS as `0x${string}`,
    event: FEEDBACK_GIVEN_EVENT,
    fromBlock,
    toBlock,
  });

  const events: FeedbackEvent[] = [];

  for (const log of logs) {
    const event: FeedbackEvent = {
      targetAgentId: (log.args as Record<string, unknown>).targetAgentId as string,
      feedbackerAddress: (log.args as Record<string, unknown>).feedbackerAddress as string,
      isPositive: (log.args as Record<string, unknown>).isPositive as boolean,
      feedbackURI: (log.args as Record<string, unknown>).feedbackURI as string,
      blockNumber: Number(log.blockNumber),
      txHash: log.transactionHash as string,
    };

    events.push(event);

    await bus.emit({
      type: 'feedback:detected',
      protocol: Protocol.Erc8004,
      data: {
        targetAgentId: event.targetAgentId,
        feedbackerAddress: event.feedbackerAddress,
        isPositive: event.isPositive,
        feedbackURI: event.feedbackURI,
        blockNumber: event.blockNumber,
        txHash: event.txHash,
      },
    });
  }

  // Persist highest block for crash recovery
  if (logs.length > 0) {
    const maxBlock = Math.max(...logs.map((l) => Number(l.blockNumber)));
    await kv.set(LAST_BLOCK_KEY, maxBlock);
  }

  return events;
}
