import { NextResponse } from 'next/server';
import { z } from 'zod';
import { executePayment } from '@/lib/protocols/x402/client';
import { recordPaymentProofs } from '@/lib/protocols/x402/proof';
import { createEventBus, Protocol, EVENT_TYPES } from '@/lib/events';

const paymentSchema = z.object({
  payerAgentId: z.string().min(1),
  payeeAgentId: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a valid USDC string like "6.00"'),
  taskId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = paymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: parsed.error.message } },
        { status: 400 },
      );
    }

    const { payerAgentId, payeeAgentId, amount, taskId } = parsed.data;
    const eventBus = createEventBus();

    try {
      const result = await executePayment({ payerAgentId, payeeAgentId, amount, taskId });

      // Record dual-entry payment proofs (payer outgoing + payee incoming)
      await recordPaymentProofs({
        txHash: result.txHash,
        payerAgentId,
        payeeAgentId,
        amount: result.amount,
        timestamp: result.timestamp,
        taskId,
      });

      // Emit payment:settled event
      await eventBus.emit({
        type: EVENT_TYPES.PAYMENT_SETTLED,
        protocol: Protocol.X402,
        agentId: payerAgentId,
        targetAgentId: payeeAgentId,
        data: {
          txHash: result.txHash,
          payer: result.payer,
          payee: result.payee,
          amount: result.amount,
        },
      });

      return NextResponse.json({ ...result, proofOfPayment: result.txHash });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment failed';

      // Emit payment:failed event
      await eventBus.emit({
        type: EVENT_TYPES.PAYMENT_FAILED,
        protocol: Protocol.X402,
        agentId: payerAgentId,
        targetAgentId: payeeAgentId,
        data: { error: message, amount },
      });

      if (message.includes('FACILITATOR_UNAVAILABLE')) {
        return NextResponse.json(
          { error: { code: 'FACILITATOR_UNAVAILABLE', message } },
          { status: 503 },
        );
      }

      return NextResponse.json(
        { error: { code: 'PAYMENT_FAILED', message } },
        { status: 402 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_REQUEST', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }
}
