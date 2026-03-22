import { describe, test, expect, vi, beforeEach } from 'vitest';
import { clearKvStore, createKvMock } from '../../helpers/kv-mock';

// Mock KV at the abstraction boundary
vi.mock('@/lib/storage/kv', () => createKvMock());

import { POST } from '@/app/api/reputation/compute/route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/reputation/compute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/reputation/compute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearKvStore();
  });

  test('returns 200 with computing status for valid agentId', async () => {
    const response = await POST(makeRequest({ agentId: 'agent-a' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.agentId).toBe('agent-a');
    expect(data.status).toBe('computing');
  });

  test('returns 200 for request without agentId (recompute all)', async () => {
    const response = await POST(makeRequest({}));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe('computing');
  });

  test('returns 400 for invalid request body', async () => {
    const request = new Request('http://localhost/api/reputation/compute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe('INVALID_REQUEST');
  });
});
