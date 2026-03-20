import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCivicGateway } from '@/lib/civic/gateway';
import { CivicLayer } from '@/lib/civic/types';

const inspectRequestSchema = z.object({
  agentId: z.string().min(1),
  layer: z.nativeEnum(CivicLayer),
  data: z.record(z.string(), z.unknown()),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = inspectRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', code: 'VALIDATION_ERROR', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { agentId, layer, data } = parsed.data;

    if (layer === CivicLayer.Identity) {
      const response = await getCivicGateway().inspectIdentity(agentId, {
        name: (data.name as string) ?? '',
        description: (data.description as string) ?? '',
        capabilities: (data.capabilities as string[]) ?? [],
      });
      return NextResponse.json(response);
    }

    // Layer 2 behavioral — stub for Story 4.2
    const response = await getCivicGateway().inspectBehavior(agentId, data, 'inbound');
    return NextResponse.json(response);
  } catch (error) {
    const isTimeout =
      error instanceof Error && (error.message.includes('timeout') || error.message.includes('ECONNREFUSED'));

    if (isTimeout) {
      return NextResponse.json(
        { error: 'Civic MCP service unavailable', code: 'CIVIC_UNAVAILABLE' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: 'Civic inspection failed', code: 'CIVIC_INSPECTION_FAILED' },
      { status: 500 },
    );
  }
}
