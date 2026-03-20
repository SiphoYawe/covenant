import { describe, it, expect, vi } from 'vitest';
import { executeReviewerTask } from '@/lib/agents/reviewer';
import type { AgentTask } from '@/lib/protocols/mcp/types';

vi.mock('@/lib/ai/client', () => ({
  getClaudeClient: vi.fn(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '## Code Review\n\nThe code follows good practices. No critical issues found.\n\n### Suggestions:\n- Add input validation\n- Consider error handling' }],
      }),
    },
  })),
}));

vi.mock('@/lib/wallets', () => ({
  getAddress: vi.fn().mockReturnValue('0x1234567890abcdef1234567890abcdef12345678'),
}));

describe('executeReviewerTask', () => {
  it('calls Claude with reviewer system prompt', async () => {
    const task: AgentTask = {
      taskId: 'test-1',
      description: 'function add(a, b) { return a + b; }',
      capability: 'review_code',
    };

    const result = await executeReviewerTask(task, 'review_code');
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Code Review');
  });

  it('returns structured review content', async () => {
    const task: AgentTask = {
      taskId: 'test-2',
      description: 'const x = 42;',
      capability: 'review_code',
    };

    const result = await executeReviewerTask(task, 'review_code');
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text.length).toBeGreaterThan(0);
  });
});
