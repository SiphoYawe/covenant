import { NextResponse } from 'next/server';
import { executeLiveLifecycle } from '@/lib/demo/live-lifecycle';
import { acquireLock, releaseLock } from '@/lib/demo/lock';

const TIMEOUT_MS = 55_000;

export async function POST() {
  if (!acquireLock('lifecycle')) {
    return NextResponse.json(
      { error: { code: 'TRIGGER_IN_PROGRESS', message: 'Lifecycle trigger is already executing.' } },
      { status: 409 },
    );
  }

  try {
    const result = await Promise.race([
      executeLiveLifecycle({
        requesterId: 'seed-R1',
        providerId: 'seed-S2',
        taskDescription:
          'Audit the token transfer contract for reentrancy vulnerabilities and access control flaws',
        capability: 'audit_contract',
        maxBudget: 15,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Lifecycle trigger timed out')), TIMEOUT_MS),
      ),
    ]);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'LIFECYCLE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 },
    );
  } finally {
    releaseLock('lifecycle');
  }
}
