import { createEventBus } from '@/lib/events/bus';
import { Protocol } from '@/lib/events/types';
import { kvSet } from '@/lib/storage/kv';
import { getWallet } from '@/lib/wallets';
import { getSDK } from './client';
import type { AppendResponseData, CachedReputation } from './types';

/**
 * Write enriched reputation score back on-chain via ERC-8004 appendResponse.
 * Uses the system wallet (not agent wallets) for all transactions.
 *
 * The agent0-sdk exposes appendResponse on the SDK instance. If the SDK
 * does not support it directly, we encode as feedback with a special tag.
 */
export async function appendReputationResponse(
  data: AppendResponseData
): Promise<{ txHash: string }> {
  // Use system wallet
  const systemWallet = getWallet('system');
  const privateKey = systemWallet.client.account.address;
  const sdk = getSDK(privateKey);

  // Encode signal summary as JSON string for on-chain storage
  const encodedSignals = JSON.stringify(data.signalSummary);

  // Use SDK's giveFeedback with a special 'reputation-response' tag
  // to encode the appendResponse data. The ERC-8004 spec allows
  // appendResponse to be called by any aggregator.
  const tx = await sdk.giveFeedback(
    data.agentId,
    Math.round(data.score), // ERC-8004 value is 1-5 scale
    'covenant-reputation', // tag1: identifies this as a reputation write-back
    'append-response', // tag2: identifies the operation type
    undefined, // endpoint
    {
      text: `ipfs://${data.explanationCid}`,
      proofOfPayment: {
        txHash: encodedSignals,
        timestamp: data.timestamp,
      },
    }
  );

  const mined = await tx.waitMined();
  const txHash = mined.receipt.transactionHash ?? tx.hash;

  // Emit reputation:updated event
  const bus = createEventBus();
  await bus.emit({
    type: 'reputation:updated',
    protocol: Protocol.Erc8004,
    agentId: data.agentId,
    data: {
      score: data.score,
      explanationCid: data.explanationCid,
      txHash,
    },
  });

  // Cache in Vercel KV
  const cached: CachedReputation = {
    score: data.score,
    explanationCid: data.explanationCid,
    txHash,
    updatedAt: data.timestamp,
  };
  await kvSet(`agent:${data.agentId}:reputation`, cached);

  return { txHash };
}
