import { describe, it, expect, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn();
  const MockAnthropic = vi.fn(function (this: { messages: { create: ReturnType<typeof vi.fn> } }) {
    this.messages = { create: mockCreate };
  });
  return {
    default: MockAnthropic,
  };
});

describe('Claude AI Client', () => {
  it('createClaudeClient returns a client with messages.create', async () => {
    const { createClaudeClient } = await import('@/lib/ai/client');
    const client = createClaudeClient('test-api-key');
    expect(client).toBeDefined();
    expect(client.messages).toBeDefined();
    expect(client.messages.create).toBeDefined();
  });

  it('createClaudeClient creates Anthropic instance with provided key', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const { createClaudeClient } = await import('@/lib/ai/client');
    createClaudeClient('sk-ant-test');
    expect(Anthropic).toHaveBeenCalledWith({ apiKey: 'sk-ant-test' });
  });
});
