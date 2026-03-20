import { env } from '@/lib/config/env';

export type VerifyResult = {
  verified: boolean;
  txHash: string;
  status: 'settled' | 'pending' | 'failed';
};

/**
 * Construct an x402 payment authorization header via the facilitator service.
 * The facilitator coordinates USDC escrow and settlement on Base Sepolia.
 */
export async function createPaymentHeader(
  amount: string,
  payeeAddress: string,
): Promise<string> {
  try {
    const response = await fetch(`${env.X402_FACILITATOR_URL}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, payeeAddress }),
    });

    if (!response.ok) {
      throw new Error('FACILITATOR_UNAVAILABLE');
    }

    const data = await response.json();
    return data.paymentHeader;
  } catch (error) {
    if (error instanceof Error && error.message === 'FACILITATOR_UNAVAILABLE') {
      throw error;
    }
    throw new Error('FACILITATOR_UNAVAILABLE');
  }
}

/**
 * Verify a payment transaction with the facilitator service.
 */
export async function verifyPayment(txHash: string): Promise<VerifyResult> {
  try {
    const response = await fetch(`${env.X402_FACILITATOR_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash }),
    });

    if (!response.ok) {
      return { verified: false, txHash, status: 'failed' };
    }

    const data = await response.json();
    return {
      verified: data.verified,
      txHash: data.txHash ?? txHash,
      status: data.status,
    };
  } catch {
    return { verified: false, txHash, status: 'failed' };
  }
}
