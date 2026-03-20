import { describe, it, expect, vi, beforeEach } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';

const TEST_KEYS = {
  AGENT_A_PRIVATE_KEY: '0x' + '01'.repeat(32),
  AGENT_B_PRIVATE_KEY: '0x' + '02'.repeat(32),
  AGENT_C_PRIVATE_KEY: '0x' + '03'.repeat(32),
  AGENT_D_PRIVATE_KEY: '0x' + '04'.repeat(32),
  SYSTEM_PRIVATE_KEY: '0x' + '05'.repeat(32),
  BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
} as const;

const payerAddress = privateKeyToAccount(TEST_KEYS.AGENT_A_PRIVATE_KEY).address;
const payeeAddress = privateKeyToAccount(TEST_KEYS.AGENT_B_PRIVATE_KEY).address;

// Mock env
vi.mock('@/lib/config/env', () => ({
  env: {
    ...TEST_KEYS,
    ANTHROPIC_API_KEY: 'test',
    PINATA_JWT: 'test',
    KV_REST_API_URL: 'https://kv.test',
    KV_REST_API_TOKEN: 'test',
    CIVIC_MCP_ENDPOINT: 'https://civic.test',
    X402_FACILITATOR_URL: 'https://x402.test/facilitator',
    SENTRY_DSN: 'https://sentry.test',
  },
}));

// Mock KV for agent profile lookups
const mockKvGet = vi.fn();
vi.mock('@/lib/storage/kv', () => ({
  kvGet: (...args: unknown[]) => mockKvGet(...args),
  kvSet: vi.fn(),
  kvDel: vi.fn(),
  kvLpush: vi.fn(),
  kvLrange: vi.fn(),
}));

// Mock facilitator
const mockCreatePaymentHeader = vi.fn();
const mockVerifyPayment = vi.fn();
vi.mock('@/lib/protocols/x402/facilitator', () => ({
  createPaymentHeader: (...args: unknown[]) => mockCreatePaymentHeader(...args),
  verifyPayment: (...args: unknown[]) => mockVerifyPayment(...args),
}));

// Mock viem writeContract and waitForTransactionReceipt
const mockWriteContract = vi.fn();
const mockWaitForTransactionReceipt = vi.fn();
const mockReadContract = vi.fn();
vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  return {
    ...actual,
    createPublicClient: () => ({
      chain: { id: 84532 },
      readContract: mockReadContract,
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
    }),
    createWalletClient: (opts: Record<string, unknown>) => ({
      account: opts.account,
      chain: { id: 84532 },
      writeContract: mockWriteContract,
    }),
  };
});

describe('x402 Payment Client', () => {
  beforeEach(() => {
    vi.resetModules();
    mockKvGet.mockReset();
    mockCreatePaymentHeader.mockReset();
    mockVerifyPayment.mockReset();
    mockWriteContract.mockReset();
    mockWaitForTransactionReceipt.mockReset();
    mockReadContract.mockReset();
  });

  it('executePayment returns a valid PaymentResult with tx hash on success', async () => {
    // Setup: payee agent profile has a wallet address
    mockKvGet.mockResolvedValueOnce({
      walletAddress: payeeAddress,
    });

    // USDC transfer tx hash
    mockWriteContract.mockResolvedValueOnce('0xtxhash123');

    // Wait for receipt
    mockWaitForTransactionReceipt.mockResolvedValueOnce({
      transactionHash: '0xtxhash123',
      status: 'success',
    });

    // Facilitator verification
    mockVerifyPayment.mockResolvedValueOnce({
      verified: true,
      status: 'settled',
    });

    const { executePayment } = await import('@/lib/protocols/x402/client');
    const result = await executePayment({
      payerAgentId: 'researcher',
      payeeAgentId: 'reviewer',
      amount: '6.00',
      taskId: 'task-1',
    });

    expect(result.txHash).toBe('0xtxhash123');
    expect(result.payer).toBe(payerAddress);
    expect(result.payee).toBe(payeeAddress);
    expect(result.amount).toBe('6.00');
    expect(result.status).toBe('settled');
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('executePayment throws PAYMENT_FAILED on transaction revert', async () => {
    mockKvGet.mockResolvedValueOnce({
      walletAddress: payeeAddress,
    });

    mockWriteContract.mockResolvedValueOnce('0xfailedtx');
    mockWaitForTransactionReceipt.mockResolvedValueOnce({
      transactionHash: '0xfailedtx',
      status: 'reverted',
    });

    const { executePayment } = await import('@/lib/protocols/x402/client');
    await expect(
      executePayment({
        payerAgentId: 'researcher',
        payeeAgentId: 'reviewer',
        amount: '6.00',
      }),
    ).rejects.toThrow('PAYMENT_FAILED');
  });

  it('executePayment throws PAYMENT_FAILED when payee profile not found', async () => {
    mockKvGet.mockResolvedValueOnce(null);

    const { executePayment } = await import('@/lib/protocols/x402/client');
    await expect(
      executePayment({
        payerAgentId: 'researcher',
        payeeAgentId: 'unknown-agent',
        amount: '6.00',
      }),
    ).rejects.toThrow('PAYMENT_FAILED');
  });

  it('executePayment uses human-readable amounts and resolves wallets by role', async () => {
    mockKvGet.mockResolvedValueOnce({
      walletAddress: payeeAddress,
    });

    mockWriteContract.mockResolvedValueOnce('0xtxhash456');
    mockWaitForTransactionReceipt.mockResolvedValueOnce({
      transactionHash: '0xtxhash456',
      status: 'success',
    });
    mockVerifyPayment.mockResolvedValueOnce({
      verified: true,
      status: 'settled',
    });

    const { executePayment } = await import('@/lib/protocols/x402/client');
    const result = await executePayment({
      payerAgentId: 'researcher',
      payeeAgentId: 'reviewer',
      amount: '10.50',
    });

    // Amount is preserved as human-readable
    expect(result.amount).toBe('10.50');
    // Verify writeContract was called (the USDC transfer)
    expect(mockWriteContract).toHaveBeenCalledOnce();
  });

  it('executePayment throws on writeContract failure', async () => {
    mockKvGet.mockResolvedValueOnce({
      walletAddress: payeeAddress,
    });

    mockWriteContract.mockRejectedValueOnce(new Error('insufficient funds'));

    const { executePayment } = await import('@/lib/protocols/x402/client');
    await expect(
      executePayment({
        payerAgentId: 'researcher',
        payeeAgentId: 'reviewer',
        amount: '6.00',
      }),
    ).rejects.toThrow('PAYMENT_FAILED');
  });
});
