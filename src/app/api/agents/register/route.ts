import { NextResponse } from 'next/server';
import { z } from 'zod';
import { registerAgent } from '@/lib/protocols/erc8004/identity';
import type { ApiError } from '@/types';

const registerSchema = z.object({
  role: z.enum(['researcher', 'reviewer', 'summarizer', 'malicious']),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const error: ApiError = {
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid request body',
          details: parsed.error.issues,
        },
      };
      return NextResponse.json(error, { status: 400 });
    }

    const result = await registerAgent(parsed.data.role);
    return NextResponse.json(result);
  } catch (err) {
    const error: ApiError = {
      error: {
        code: 'REGISTRATION_FAILED',
        message: err instanceof Error ? err.message : 'Agent registration failed',
      },
    };
    return NextResponse.json(error, { status: 500 });
  }
}
