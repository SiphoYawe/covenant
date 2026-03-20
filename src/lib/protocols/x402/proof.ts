import { kvLpush, kvLrange } from '@/lib/storage/kv';
import type { PaymentProof } from './types';

/**
 * Append a payment proof to an agent's transaction history in KV.
 * Uses lpush for append-only list semantics.
 */
export async function addPaymentProof(agentId: string, proof: PaymentProof): Promise<void> {
  await kvLpush(`agent:${agentId}:transactions`, JSON.stringify(proof));
}

/**
 * Get all payment proofs for an agent, ordered chronologically (oldest first).
 */
export async function getTransactionHistory(agentId: string): Promise<PaymentProof[]> {
  const raw = await kvLrange(`agent:${agentId}:transactions`, 0, -1);
  if (!raw.length) return [];

  const proofs = raw.map((item) => {
    // Handle both string and already-parsed objects (KV may auto-parse)
    if (typeof item === 'string') {
      return JSON.parse(item) as PaymentProof;
    }
    return item as unknown as PaymentProof;
  });

  // Sort chronologically (oldest first) — lpush puts newest at head
  return proofs.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Record dual-entry proofs for a payment: outgoing for payer, incoming for payee.
 * This is critical for the payment graph (Story 5.3) which needs edges from both perspectives.
 */
export async function recordPaymentProofs(params: {
  txHash: string;
  payerAgentId: string;
  payeeAgentId: string;
  amount: string;
  timestamp: number;
  taskId?: string;
}): Promise<void> {
  const { txHash, payerAgentId, payeeAgentId, amount, timestamp, taskId } = params;

  // Payer side — outgoing
  await addPaymentProof(payerAgentId, {
    txHash,
    counterpartyAgentId: payeeAgentId,
    amount,
    timestamp,
    direction: 'outgoing',
    taskId,
  });

  // Payee side — incoming
  await addPaymentProof(payeeAgentId, {
    txHash,
    counterpartyAgentId: payerAgentId,
    amount,
    timestamp,
    direction: 'incoming',
    taskId,
  });
}
