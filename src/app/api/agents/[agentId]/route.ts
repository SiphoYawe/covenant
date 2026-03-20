import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/protocols/erc8004/identity';
import type { ApiError } from '@/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params;

    if (!agentId) {
      const error: ApiError = {
        error: { code: 'INVALID_REQUEST', message: 'Agent ID is required' },
      };
      return NextResponse.json(error, { status: 400 });
    }

    const profile = await getAgent(agentId);

    if (!profile) {
      const error: ApiError = {
        error: { code: 'NOT_FOUND', message: `Agent ${agentId} not found` },
      };
      return NextResponse.json(error, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (err) {
    const error: ApiError = {
      error: {
        code: 'QUERY_FAILED',
        message: err instanceof Error ? err.message : 'Failed to query agent',
      },
    };
    return NextResponse.json(error, { status: 500 });
  }
}
