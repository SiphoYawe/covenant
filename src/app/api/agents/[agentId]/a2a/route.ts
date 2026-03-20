import { NextRequest } from 'next/server';
import { handleA2ARequest, isValidAgentId } from '@/lib/protocols/a2a/server';
import type { JsonRpcRequest } from '@/lib/protocols/a2a/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;

  if (!isValidAgentId(agentId)) {
    return Response.json(
      { error: { code: 'UNKNOWN_AGENT', message: `Unknown agent: ${agentId}` } },
      { status: 404 }
    );
  }

  let body: JsonRpcRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
      { status: 400 }
    );
  }

  if (!body.jsonrpc || !body.id || !body.method) {
    return Response.json(
      {
        jsonrpc: '2.0',
        id: body.id || null,
        error: { code: -32600, message: 'Invalid Request: missing jsonrpc, id, or method' },
      },
      { status: 400 }
    );
  }

  const response = await handleA2ARequest(body, agentId);
  return Response.json(response);
}
