import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleA2ARequest, isValidAgentId } from '@/lib/protocols/a2a/server';
import type { JsonRpcRequest } from '@/lib/protocols/a2a/types';

vi.mock('@/lib/storage/kv', () => ({
  kvGet: vi.fn().mockResolvedValue(null),
  kvSet: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/events/bus', () => ({
  createEventBus: vi.fn(() => ({
    emit: vi.fn().mockResolvedValue({ id: 'test', timestamp: Date.now() }),
    since: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/lib/wallets', () => ({
  getAddress: vi.fn().mockReturnValue('0x1234567890abcdef1234567890abcdef12345678'),
}));

vi.mock('@/lib/ai/client', () => ({
  getClaudeClient: vi.fn(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock review result' }],
      }),
    },
  })),
}));

import { kvGet, kvSet } from '@/lib/storage/kv';

const mockedKvGet = vi.mocked(kvGet);
const mockedKvSet = vi.mocked(kvSet);

describe('isValidAgentId', () => {
  it('returns true for known agents', () => {
    expect(isValidAgentId('researcher')).toBe(true);
    expect(isValidAgentId('reviewer')).toBe(true);
    expect(isValidAgentId('summarizer')).toBe(true);
    expect(isValidAgentId('malicious')).toBe(true);
  });

  it('returns false for unknown agents', () => {
    expect(isValidAgentId('unknown')).toBe(false);
    expect(isValidAgentId('')).toBe(false);
  });
});

describe('handleA2ARequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches tasks/send and creates task record', async () => {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 'req-1',
      method: 'tasks/send',
      params: {
        description: 'Review this code',
        capability: 'review_code',
        offeredPayment: 5,
        requesterId: 'researcher',
      },
    };

    const response = await handleA2ARequest(request, 'reviewer');
    expect(response.id).toBe('req-1');
    expect(response.error).toBeUndefined();

    const task = response.result as { id: string; status: string; messages: unknown[] };
    expect(task.id).toBeTruthy();
    // After MCP execution wiring, tasks/send executes the tool and completes
    expect(task.status).toBe('completed');
    // 2 messages: user request + agent response
    expect(task.messages).toHaveLength(2);

    // Verify task was stored in KV (final state after execution)
    expect(mockedKvSet).toHaveBeenCalledWith(
      expect.stringContaining('tasks:'),
      expect.objectContaining({ agentId: 'reviewer' })
    );
  });

  it('dispatches tasks/get correctly', async () => {
    mockedKvGet.mockResolvedValueOnce({
      id: 'task-123',
      status: 'submitted',
      messages: [],
      artifacts: [],
    });

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 'req-2',
      method: 'tasks/get',
      params: { taskId: 'task-123' },
    };

    const response = await handleA2ARequest(request, 'reviewer');
    expect(response.error).toBeUndefined();

    const task = response.result as { id: string; status: string };
    expect(task.id).toBe('task-123');
  });

  it('returns error for tasks/get with missing task', async () => {
    mockedKvGet.mockResolvedValueOnce(null);

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 'req-3',
      method: 'tasks/get',
      params: { taskId: 'nonexistent' },
    };

    const response = await handleA2ARequest(request, 'reviewer');
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe(-32001);
    expect(response.error?.message).toBe('Task not found');
  });

  it('returns error for unknown method', async () => {
    const request = {
      jsonrpc: '2.0' as const,
      id: 'req-4',
      method: 'tasks/unknown' as 'tasks/send',
      params: {},
    };

    const response = await handleA2ARequest(request, 'reviewer');
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe(-32601);
    expect(response.error?.message).toBe('Method not found');
  });

  it('returns error for malformed request', async () => {
    const request = {
      jsonrpc: '1.0' as '2.0',
      id: 'req-5',
      method: 'tasks/send' as const,
      params: {},
    };

    const response = await handleA2ARequest(request, 'reviewer');
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe(-32600);
  });

  it('tasks/send validates required params', async () => {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 'req-6',
      method: 'tasks/send',
      params: { description: 'test' },  // missing capability and requesterId
    };

    const response = await handleA2ARequest(request, 'reviewer');
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe(-32602);
  });

  it('dispatches tasks/cancel correctly', async () => {
    mockedKvGet.mockResolvedValueOnce({
      id: 'task-cancel',
      status: 'submitted',
      messages: [],
      artifacts: [],
      agentId: 'reviewer',
    });

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 'req-7',
      method: 'tasks/cancel',
      params: { taskId: 'task-cancel' },
    };

    const response = await handleA2ARequest(request, 'reviewer');
    expect(response.error).toBeUndefined();

    const task = response.result as { status: string };
    expect(task.status).toBe('canceled');
  });
});
