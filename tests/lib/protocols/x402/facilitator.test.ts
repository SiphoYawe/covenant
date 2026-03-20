import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock env
vi.mock('@/lib/config/env', () => ({
  env: {
    X402_FACILITATOR_URL: 'https://x402.test/facilitator',
    BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
  },
}));

describe('x402 Facilitator', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  it('createPaymentHeader returns a valid x402 authorization header', async () => {
    const { createPaymentHeader } = await import('@/lib/protocols/x402/facilitator');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        paymentHeader: 'x402-token-abc123',
      }),
    });

    const header = await createPaymentHeader('6.00', '0x1234567890abcdef1234567890abcdef12345678');
    expect(header).toBe('x402-token-abc123');
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('https://x402.test/facilitator');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.amount).toBe('6.00');
    expect(body.payeeAddress).toBe('0x1234567890abcdef1234567890abcdef12345678');
  });

  it('verifyPayment confirms a settled transaction', async () => {
    const { verifyPayment } = await import('@/lib/protocols/x402/facilitator');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        verified: true,
        txHash: '0xabc123',
        status: 'settled',
      }),
    });

    const result = await verifyPayment('0xabc123');
    expect(result.verified).toBe(true);
    expect(result.status).toBe('settled');
  });

  it('createPaymentHeader throws on facilitator error', async () => {
    const { createPaymentHeader } = await import('@/lib/protocols/x402/facilitator');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    await expect(
      createPaymentHeader('6.00', '0x1234567890abcdef1234567890abcdef12345678'),
    ).rejects.toThrow('FACILITATOR_UNAVAILABLE');
  });

  it('createPaymentHeader throws on network failure', async () => {
    const { createPaymentHeader } = await import('@/lib/protocols/x402/facilitator');

    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(
      createPaymentHeader('6.00', '0x1234567890abcdef1234567890abcdef12345678'),
    ).rejects.toThrow('FACILITATOR_UNAVAILABLE');
  });

  it('verifyPayment handles unverified transaction', async () => {
    const { verifyPayment } = await import('@/lib/protocols/x402/facilitator');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        verified: false,
        txHash: '0xabc123',
        status: 'pending',
      }),
    });

    const result = await verifyPayment('0xabc123');
    expect(result.verified).toBe(false);
    expect(result.status).toBe('pending');
  });
});
