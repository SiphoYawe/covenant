import { NextResponse } from 'next/server';
import { executeSybilCascade } from '@/lib/demo/live-sybil-cascade';
import { acquireLock, releaseLock } from '@/lib/demo/lock';

const TIMEOUT_MS = 55_000;

/** Default Sybil ring agents from seed data (X2, X3, X4) */
const SYBIL_RING_AGENTS = ['seed-X2', 'seed-X3', 'seed-X4'];

export async function POST() {
  if (!acquireLock('sybil-cascade')) {
    return NextResponse.json(
      { error: { code: 'TRIGGER_IN_PROGRESS', message: 'Sybil cascade is already executing.' } },
      { status: 409 },
    );
  }

  try {
    const result = await Promise.race([
      executeSybilCascade({ ringAgentIds: SYBIL_RING_AGENTS }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Sybil cascade timed out')), TIMEOUT_MS),
      ),
    ]);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'SYBIL_CASCADE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 },
    );
  } finally {
    releaseLock('sybil-cascade');
  }
}
