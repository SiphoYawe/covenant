import { NextRequest } from 'next/server';
import { z } from 'zod';
import { giveFeedback } from '@/lib/protocols/erc8004/reputation';
import type { ApiError } from '@/types';

const FeedbackRequestSchema = z.object({
  targetAgentId: z.string().min(1),
  isPositive: z.boolean(),
  feedbackURI: z.string(),
  proofOfPayment: z.string().min(1),
  feedbackerAgentId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = FeedbackRequestSchema.safeParse(body);

    if (!parsed.success) {
      const error: ApiError = {
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid feedback submission data',
          details: parsed.error.flatten(),
        },
      };
      return Response.json(error, { status: 400 });
    }

    const result = await giveFeedback(parsed.data);
    return Response.json(result);
  } catch (err) {
    const error: ApiError = {
      error: {
        code: 'FEEDBACK_FAILED',
        message: err instanceof Error ? err.message : 'Feedback submission failed',
      },
    };
    return Response.json(error, { status: 500 });
  }
}
