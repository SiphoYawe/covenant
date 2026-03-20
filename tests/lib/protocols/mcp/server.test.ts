import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTool } from '@/lib/protocols/mcp/server';

vi.mock('@/lib/ai/client', () => ({
  getClaudeClient: vi.fn(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock review: Code looks good. No issues found.' }],
      }),
    },
  })),
}));

vi.mock('@/lib/wallets', () => ({
  getAddress: vi.fn().mockReturnValue('0x1234567890abcdef1234567890abcdef12345678'),
}));

describe('executeTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes to correct agent behavior for reviewer', async () => {
    const result = await executeTool('review_code', { code: 'function foo() {}' }, 'reviewer');
    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('review');
  });

  it('routes to correct agent behavior for summarizer', async () => {
    const result = await executeTool('summarize_text', { text: 'Long text here' }, 'summarizer');
    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
  });

  it('routes to malicious agent', async () => {
    const result = await executeTool('review_code', { code: 'function bar() {}' }, 'malicious');
    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
  });

  it('returns MCP-compliant result format', async () => {
    const result = await executeTool('review_code', { code: 'test' }, 'reviewer');
    expect(result).toHaveProperty('content');
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0]).toHaveProperty('type');
    expect(result.content[0]).toHaveProperty('text');
  });

  it('returns error for unknown tool', async () => {
    const result = await executeTool('nonexistent_tool', {}, 'reviewer');
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Tool not found');
  });

  it('handles execution errors gracefully', async () => {
    const { getClaudeClient } = await import('@/lib/ai/client');
    vi.mocked(getClaudeClient).mockReturnValueOnce({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('API rate limited')),
      },
    } as unknown as ReturnType<typeof getClaudeClient>);

    const result = await executeTool('review_code', { code: 'test' }, 'reviewer');
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('execution failed');
  });
});
