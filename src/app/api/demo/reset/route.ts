import { NextResponse } from 'next/server';
import { resetAllDemoState } from '@/lib/orchestrator';
import { createEventBus } from '@/lib/events/bus';
import { EVENT_TYPES } from '@/lib/events/constants';
import { Protocol } from '@/lib/events/types';

export async function POST() {
  try {
    const result = await resetAllDemoState();

    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'RESET_FAILED', message: result.error ?? 'Reset failed' } },
        { status: 500 },
      );
    }

    const eventBus = createEventBus();
    await eventBus.emit({
      type: EVENT_TYPES.DEMO_RESET,
      protocol: Protocol.CovenantAi,
      agentId: 'system',
      data: { keysCleared: result.keysCleared, resetAt: result.resetAt },
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: 'RESET_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      },
      { status: 500 },
    );
  }
}
