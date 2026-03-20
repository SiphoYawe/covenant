import type {
  JsonRpcRequest,
  JsonRpcResponse,
  Task,
  TaskState,
  TaskSendParams,
} from './types';
import { kvGet, kvSet } from '@/lib/storage/kv';
import { createEventBus } from '@/lib/events/bus';
import { EVENT_TYPES } from '@/lib/events/constants';
import { Protocol } from '@/lib/events/types';
import { DEMO_AGENT_ROLES } from '@/lib/agents/config';
import type { DemoAgentRole } from '@/lib/agents/types';
import { executeTool } from '@/lib/protocols/mcp/server';

const eventBus = createEventBus();

/** Validate that an agentId is a known demo agent */
export function isValidAgentId(agentId: string): agentId is DemoAgentRole {
  return (DEMO_AGENT_ROLES as readonly string[]).includes(agentId);
}

/** Handle an incoming A2A JSON-RPC request */
export async function handleA2ARequest(
  request: JsonRpcRequest,
  agentId: string
): Promise<JsonRpcResponse> {
  const baseResponse = { jsonrpc: '2.0' as const, id: request.id };

  // Validate JSON-RPC format
  if (request.jsonrpc !== '2.0' || !request.id || !request.method) {
    return {
      ...baseResponse,
      error: { code: -32600, message: 'Invalid Request' },
    };
  }

  switch (request.method) {
    case 'tasks/send':
      return handleTaskSend(request.params as unknown as TaskSendParams, agentId, request.id);
    case 'tasks/get':
      return handleTaskGet(request.params as { taskId: string }, request.id);
    case 'tasks/cancel':
      return handleTaskCancel(request.params as { taskId: string }, agentId, request.id);
    default:
      return {
        ...baseResponse,
        error: { code: -32601, message: 'Method not found' },
      };
  }
}

async function handleTaskSend(
  params: TaskSendParams,
  agentId: string,
  requestId: string
): Promise<JsonRpcResponse> {
  // Validate required fields
  if (!params.description || !params.capability || !params.requesterId) {
    return {
      jsonrpc: '2.0',
      id: requestId,
      error: { code: -32602, message: 'Invalid params: description, capability, and requesterId are required' },
    };
  }

  const taskId = crypto.randomUUID();
  const task: Task = {
    id: taskId,
    status: 'submitted',
    messages: [
      {
        role: 'user',
        parts: [{ type: 'text', text: params.description }],
        timestamp: Date.now(),
      },
    ],
    artifacts: [],
  };

  // Store task in KV
  await kvSet(`tasks:${taskId}`, {
    ...task,
    agentId,
    requesterId: params.requesterId,
    capability: params.capability,
    offeredPayment: params.offeredPayment,
  });

  // Emit task:requested event
  await eventBus.emit({
    type: EVENT_TYPES.TASK_REQUESTED,
    protocol: Protocol.A2a,
    agentId: params.requesterId,
    targetAgentId: agentId,
    data: {
      taskId,
      requesterId: params.requesterId,
      targetAgentId: agentId,
      capability: params.capability,
      offeredPayment: params.offeredPayment,
    },
  });

  // Execute MCP tool for the agent
  if (isValidAgentId(agentId)) {
    task.status = 'working';
    const result = await executeTool(params.capability, { code: params.description, text: params.description, topic: params.description }, agentId);

    if (result.isError) {
      task.status = 'failed';
      task.messages.push({
        role: 'agent',
        parts: result.content.map((c) => ({ type: 'text' as const, text: c.text })),
        timestamp: Date.now(),
      });
    } else {
      task.status = 'completed';
      task.messages.push({
        role: 'agent',
        parts: result.content.map((c) => ({ type: 'text' as const, text: c.text })),
        timestamp: Date.now(),
      });
      task.artifacts = [{ type: 'text', data: result.content.map((c) => c.text).join('\n') }];
    }

    // Update task in KV
    await kvSet(`tasks:${taskId}`, { ...task, agentId, requesterId: params.requesterId, capability: params.capability });

    // Emit delivery event
    await eventBus.emit({
      type: EVENT_TYPES.TASK_DELIVERED,
      protocol: Protocol.A2a,
      agentId,
      targetAgentId: params.requesterId,
      data: { taskId, agentId, deliverableType: 'text', status: task.status },
    });
  }

  return { jsonrpc: '2.0', id: requestId, result: task };
}

async function handleTaskGet(
  params: { taskId: string },
  requestId: string
): Promise<JsonRpcResponse> {
  if (!params.taskId) {
    return {
      jsonrpc: '2.0',
      id: requestId,
      error: { code: -32602, message: 'Invalid params: taskId is required' },
    };
  }

  const task = await kvGet<Task>(`tasks:${params.taskId}`);
  if (!task) {
    return {
      jsonrpc: '2.0',
      id: requestId,
      error: { code: -32001, message: 'Task not found' },
    };
  }

  return { jsonrpc: '2.0', id: requestId, result: task };
}

async function handleTaskCancel(
  params: { taskId: string },
  agentId: string,
  requestId: string
): Promise<JsonRpcResponse> {
  if (!params.taskId) {
    return {
      jsonrpc: '2.0',
      id: requestId,
      error: { code: -32602, message: 'Invalid params: taskId is required' },
    };
  }

  const task = await kvGet<Task & { agentId: string }>(`tasks:${params.taskId}`);
  if (!task) {
    return {
      jsonrpc: '2.0',
      id: requestId,
      error: { code: -32001, message: 'Task not found' },
    };
  }

  const canceledTask: Task = {
    ...task,
    status: 'canceled',
  };

  await kvSet(`tasks:${params.taskId}`, canceledTask);

  return { jsonrpc: '2.0', id: requestId, result: canceledTask };
}

/** Update a task's status and store in KV */
export async function updateTaskStatus(
  taskId: string,
  status: TaskState,
  agentId: string
): Promise<void> {
  const task = await kvGet<Task>(`tasks:${taskId}`);
  if (task) {
    task.status = status;
    await kvSet(`tasks:${taskId}`, task);
  }
}
