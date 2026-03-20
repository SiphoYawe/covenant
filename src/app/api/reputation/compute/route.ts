import { NextResponse } from 'next/server';
import { ReputationComputeRequestSchema } from '@/lib/reputation/types';
import { triggerReputationPipeline } from '@/lib/reputation/engine';

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const parsed = ReputationComputeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid request body',
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const { agentId } = parsed.data;

    // Trigger pipeline with a synthetic feedback event for manual recomputation
    const result = await triggerReputationPipeline({
      targetAgentId: agentId ?? 'all',
      feedbackValue: 0,
      feedbackUri: '',
      proofOfPayment: '',
      sourceAgentId: 'system',
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      agentId: agentId ?? undefined,
      status: result.status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}
