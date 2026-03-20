import { NextResponse } from 'next/server';
import { kvGet } from '@/lib/storage/kv';
import type { CachedReputation, ReputationScoreResponse } from '@/lib/protocols/erc8004/types';

/**
 * GET /api/reputation/scores
 * Returns current reputation scores for all agents from KV cache.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const agentIds = await kvGet<string[]>('demo:agents');
    if (!agentIds || agentIds.length === 0) {
      return NextResponse.json([]);
    }

    const scores: ReputationScoreResponse[] = [];
    for (const agentId of agentIds) {
      const cached = await kvGet<CachedReputation>(`agent:${agentId}:reputation`);
      if (cached) {
        scores.push({
          agentId,
          score: cached.score,
          explanationCid: cached.explanationCid,
          txHash: cached.txHash,
          updatedAt: cached.updatedAt,
        });
      }
    }

    return NextResponse.json(scores);
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'REPUTATION_READ_FAILED',
          message: error instanceof Error ? error.message : 'Failed to read reputation scores',
        },
      },
      { status: 500 }
    );
  }
}
