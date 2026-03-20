import { parseUnits } from 'viem';
import { getWallet, getAddress } from '@/lib/wallets';
import { kvGet } from '@/lib/storage/kv';
import { verifyPayment } from './facilitator';
import type { PaymentRequest, PaymentResult } from './types';
import type { WalletRole } from '@/lib/wallets/types';

/**
 * USDC contract on Base Sepolia.
 * Standard ERC-20 transfer ABI subset.
 */
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;
const USDC_DECIMALS = 6;
const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

/**
 * Execute a USDC payment between two agents on Base Sepolia.
 *
 * Flow:
 * 1. Resolve payer wallet from wallet manager by agent role
 * 2. Resolve payee wallet address from KV agent profile
 * 3. Construct and submit USDC transfer transaction
 * 4. Wait for on-chain confirmation
 * 5. Verify with facilitator
 * 6. Return PaymentResult with tx hash
 */
export async function executePayment(request: PaymentRequest): Promise<PaymentResult> {
  const { payerAgentId, payeeAgentId, amount, taskId: _taskId } = request;

  // 1. Resolve payer wallet
  const payerWallet = getWallet(payerAgentId as WalletRole);
  const payerAddress = getAddress(payerAgentId as WalletRole);

  // 2. Resolve payee address from KV profile
  const payeeProfile = await kvGet<{ walletAddress: string }>(`agent:${payeeAgentId}:profile`);
  if (!payeeProfile?.walletAddress) {
    throw new Error('PAYMENT_FAILED: Payee agent profile not found');
  }
  const payeeAddr = payeeProfile.walletAddress as `0x${string}`;

  // 3. Convert human-readable amount to wei at the contract call boundary
  const amountInWei = parseUnits(amount, USDC_DECIMALS);

  try {
    // 4. Submit USDC transfer transaction
    const txHash = await payerWallet.writeContract({
      address: USDC_ADDRESS,
      abi: ERC20_TRANSFER_ABI,
      functionName: 'transfer',
      args: [payeeAddr, amountInWei],
    });

    // 5. Wait for on-chain confirmation
    const { getPublicClient } = await import('@/lib/wallets');
    const publicClient = getPublicClient();
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status === 'reverted') {
      throw new Error('PAYMENT_FAILED: Transaction reverted');
    }

    // 6. Verify with facilitator (best-effort, don't fail if facilitator is down)
    await verifyPayment(txHash).catch(() => {
      // Facilitator verification is non-blocking
    });

    return {
      txHash,
      payer: payerAddress,
      payee: payeeAddr,
      amount,
      status: 'settled',
      timestamp: Date.now(),
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('PAYMENT_FAILED')) {
      throw error;
    }
    throw new Error(`PAYMENT_FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
