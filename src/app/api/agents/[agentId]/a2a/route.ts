import { NextRequest } from 'next/server';
import { handleA2ARequest, isValidAgentId } from '@/lib/protocols/a2a/server';
import type { JsonRpcRequest, TaskSendParams } from '@/lib/protocols/a2a/types';
import { getCivicGateway } from '@/lib/civic';

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

  // Civic Layer 2: Inspect input before agent execution (tasks/send only)
  if (body.method === 'tasks/send') {
    const sendParams = body.params as unknown as TaskSendParams;
    const gateway = getCivicGateway();
    const inputInspection = await gateway.inspectBehavior(
      agentId,
      {
        description: sendParams.description,
        capability: sendParams.capability,
        context: sendParams.context,
      },
      'input',
      sendParams.requesterId,
    );

    if (!inputInspection.result.passed) {
      const severity = inputInspection.result.flags[0]?.severity;
      if (severity === 'Critical' || severity === 'High') {
        return Response.json(
          {
            jsonrpc: '2.0',
            id: body.id,
            error: { code: -32003, message: 'CIVIC_BLOCKED: Request blocked by Civic behavioral inspection' },
          },
          { status: 403 }
        );
      }
    }
  }

  const response = await handleA2ARequest(body, agentId);

  // Civic Layer 2: Inspect output after agent execution (tasks/send only)
  if (body.method === 'tasks/send' && response.result) {
    const task = response.result as { artifacts?: { data?: string }[]; messages?: { parts?: { text?: string }[] }[] };
    const deliverable = task.artifacts?.[0]?.data || task.messages?.at(-1)?.parts?.[0]?.text || '';

    if (deliverable) {
      const gateway = getCivicGateway();
      const sendParams = body.params as unknown as TaskSendParams;
      const outputInspection = await gateway.inspectBehavior(
        agentId,
        { deliverable, taskId: (response.result as { id?: string }).id },
        'output',
        sendParams.requesterId,
      );

      if (!outputInspection.result.passed) {
        const severity = outputInspection.result.flags[0]?.severity;
        if (severity === 'Critical' || severity === 'High') {
          return Response.json(
            {
              jsonrpc: '2.0',
              id: body.id,
              error: { code: -32003, message: 'CIVIC_FLAGGED: Deliverable blocked by Civic behavioral inspection' },
            },
            { status: 403 }
          );
        }
        // Medium/Low: add warning header but still deliver
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Civic-Warning': `Flagged: ${outputInspection.result.flags[0]?.attackType}`,
          },
        });
      }
    }
  }

  return Response.json(response);
}
