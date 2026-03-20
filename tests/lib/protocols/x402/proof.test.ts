import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock KV storage
const mockKvLpush = vi.fn();
const mockKvLrange = vi.fn();
vi.mock('@/lib/storage/kv', () => ({
  kvGet: vi.fn(),
  kvSet: vi.fn(),
  kvDel: vi.fn(),
  kvLpush: (...args: unknown[]) => mockKvLpush(...args),
  kvLrange: (...args: unknown[]) => mockKvLrange(...args),
}));

describe('Payment Proof Storage', () => {
  beforeEach(() => {
    vi.resetModules();
    mockKvLpush.mockReset();
    mockKvLrange.mockReset();
  });

  it('addPaymentProof stores proof in KV at agent:{agentId}:transactions', async () => {
    mockKvLpush.mockResolvedValue(undefined);

    const { addPaymentProof } = await import('@/lib/protocols/x402/proof');
    await addPaymentProof('agent-a', {
      txHash: '0xabc123',
      counterpartyAgentId: 'agent-b',
      amount: '6.00',
      timestamp: 1710950400000,
      direction: 'outgoing',
      taskId: 'task-1',
    });

    expect(mockKvLpush).toHaveBeenCalledOnce();
    const [key, value] = mockKvLpush.mock.calls[0];
    expect(key).toBe('agent:agent-a:transactions');
    const parsed = JSON.parse(value);
    expect(parsed.txHash).toBe('0xabc123');
    expect(parsed.counterpartyAgentId).toBe('agent-b');
    expect(parsed.amount).toBe('6.00');
    expect(parsed.direction).toBe('outgoing');
  });

  it('getTransactionHistory returns chronologically ordered proofs', async () => {
    const proofs = [
      JSON.stringify({
        txHash: '0x222',
        counterpartyAgentId: 'b',
        amount: '3.00',
        timestamp: 1710950500000,
        direction: 'outgoing',
      }),
      JSON.stringify({
        txHash: '0x111',
        counterpartyAgentId: 'b',
        amount: '6.00',
        timestamp: 1710950400000,
        direction: 'outgoing',
      }),
    ];
    // KV lpush puts newest first, so lrange returns newest-first
    mockKvLrange.mockResolvedValueOnce(proofs);

    const { getTransactionHistory } = await import('@/lib/protocols/x402/proof');
    const history = await getTransactionHistory('agent-a');

    // Should be chronological (oldest first)
    expect(history).toHaveLength(2);
    expect(history[0].txHash).toBe('0x111');
    expect(history[1].txHash).toBe('0x222');
  });

  it('stores both payer (outgoing) and payee (incoming) proofs per payment', async () => {
    mockKvLpush.mockResolvedValue(undefined);

    const { recordPaymentProofs } = await import('@/lib/protocols/x402/proof');
    await recordPaymentProofs({
      txHash: '0xabc',
      payerAgentId: 'researcher',
      payeeAgentId: 'reviewer',
      amount: '6.00',
      timestamp: 1710950400000,
      taskId: 'task-1',
    });

    // Two calls: one for payer (outgoing), one for payee (incoming)
    expect(mockKvLpush).toHaveBeenCalledTimes(2);

    const [payerKey, payerValue] = mockKvLpush.mock.calls[0];
    expect(payerKey).toBe('agent:researcher:transactions');
    const payerProof = JSON.parse(payerValue);
    expect(payerProof.direction).toBe('outgoing');
    expect(payerProof.counterpartyAgentId).toBe('reviewer');

    const [payeeKey, payeeValue] = mockKvLpush.mock.calls[1];
    expect(payeeKey).toBe('agent:reviewer:transactions');
    const payeeProof = JSON.parse(payeeValue);
    expect(payeeProof.direction).toBe('incoming');
    expect(payeeProof.counterpartyAgentId).toBe('researcher');
  });

  it('proof includes extractable payment amount for stake weighting', async () => {
    const proofJson = JSON.stringify({
      txHash: '0xdef',
      counterpartyAgentId: 'reviewer',
      amount: '10.50',
      timestamp: 1710950400000,
      direction: 'outgoing',
    });
    mockKvLrange.mockResolvedValueOnce([proofJson]);

    const { getTransactionHistory } = await import('@/lib/protocols/x402/proof');
    const history = await getTransactionHistory('agent-a');

    expect(history[0].amount).toBe('10.50');
    // Parseable as a number for stake weighting
    expect(parseFloat(history[0].amount)).toBe(10.5);
  });

  it('multiple payments accumulate in append-only list', async () => {
    mockKvLpush.mockResolvedValue(undefined);

    const { addPaymentProof } = await import('@/lib/protocols/x402/proof');

    await addPaymentProof('agent-a', {
      txHash: '0x111',
      counterpartyAgentId: 'b',
      amount: '6.00',
      timestamp: 1710950400000,
      direction: 'outgoing',
    });

    await addPaymentProof('agent-a', {
      txHash: '0x222',
      counterpartyAgentId: 'c',
      amount: '3.00',
      timestamp: 1710950500000,
      direction: 'outgoing',
    });

    // Both calls went to the same key — append-only
    expect(mockKvLpush).toHaveBeenCalledTimes(2);
    expect(mockKvLpush.mock.calls[0][0]).toBe('agent:agent-a:transactions');
    expect(mockKvLpush.mock.calls[1][0]).toBe('agent:agent-a:transactions');
  });

  it('getTransactionHistory returns empty array when no transactions', async () => {
    mockKvLrange.mockResolvedValueOnce([]);

    const { getTransactionHistory } = await import('@/lib/protocols/x402/proof');
    const history = await getTransactionHistory('agent-x');

    expect(history).toEqual([]);
  });
});
