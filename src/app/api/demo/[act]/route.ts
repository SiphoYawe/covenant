import { NextResponse } from 'next/server';
import { getActExecutor, isValidActNumber } from '@/lib/demo';
import type { ActNumber, ActResult } from '@/lib/demo';
import { getDemoState, setDemoState, DemoAct, DemoStatus } from '@/lib/orchestrator';
import { kvGet, kvSet } from '@/lib/storage';

const ACT_TIMEOUT_MS = 55_000; // 55s to stay under Vercel's 60s limit

/** Key for storing act results in KV */
const ACT_RESULTS_KEY = 'demo:act-results';

/** Map act numbers to DemoAct enum values */
const ACT_NUMBER_TO_DEMO_ACT: Record<ActNumber, DemoAct> = {
  1: DemoAct.Registration,
  2: DemoAct.EconomyWorks,
  3: DemoAct.VillainAttacks,
  4: DemoAct.Consequences,
  5: DemoAct.Payoff,
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ act: string }> },
) {
  const { act: actParam } = await params;
  const actNumber = parseInt(actParam, 10);

  // Validate act number
  if (!isValidActNumber(actNumber)) {
    return NextResponse.json(
      { error: { code: 'INVALID_ACT', message: `Invalid act number: ${actParam}. Must be 1-5.` } },
      { status: 400 },
    );
  }

  try {
    const demoState = await getDemoState();
    const actResults = (await kvGet<Record<number, ActResult>>(ACT_RESULTS_KEY)) ?? {};

    // Get the executor
    const executor = getActExecutor(actNumber);

    // Derive current act number from demo state
    const demoActToNumber: Record<string, number> = {
      [DemoAct.Idle]: 0,
      [DemoAct.Registration]: 1,
      [DemoAct.EconomyWorks]: 2,
      [DemoAct.VillainAttacks]: 3,
      [DemoAct.Consequences]: 4,
      [DemoAct.Payoff]: 5,
    };
    const currentActNum = demoActToNumber[demoState.act] ?? 0;

    // Check prerequisites
    if (!executor.canExecute(currentActNum, actResults)) {
      return NextResponse.json(
        { error: { code: 'PREREQUISITE_MISSING', message: `Prerequisite act ${actNumber - 1} must complete first.` } },
        { status: 400 },
      );
    }

    // Check if act is already running
    if (actResults[actNumber]?.status === 'running') {
      return NextResponse.json(
        { error: { code: 'ACT_IN_PROGRESS', message: `Act ${actNumber} is already running.` } },
        { status: 409 },
      );
    }

    // Execute with timeout
    const result = await Promise.race<ActResult>([
      executor.execute(actResults),
      new Promise<ActResult>((_, reject) =>
        setTimeout(() => reject(new Error(`Act ${actNumber} timed out after ${ACT_TIMEOUT_MS}ms`)), ACT_TIMEOUT_MS)
      ),
    ]);

    // Store act result
    actResults[actNumber] = result;
    await kvSet(ACT_RESULTS_KEY, actResults);

    // Update demo state
    if (result.status === 'completed') {
      const nextAct = ACT_NUMBER_TO_DEMO_ACT[actNumber];
      await setDemoState({
        act: nextAct,
        status: actNumber === 5 ? DemoStatus.Completed : DemoStatus.Idle,
        startedAt: demoState.startedAt,
        completedAt: actNumber === 5 ? Date.now() : null,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'ACT_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 },
    );
  }
}
