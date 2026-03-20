import { getClaudeClient } from '@/lib/ai/client';
import { CLAUDE_MODEL, CLAUDE_MAX_TOKENS } from '@/lib/config/constants';
import { AGENT_CONFIGS } from './config';
import type { AgentTask, MCPToolResult } from '@/lib/protocols/mcp/types';

export async function executeSummarizerTask(task: AgentTask, toolName: string): Promise<MCPToolResult> {
  const config = AGENT_CONFIGS.summarizer;
  const claude = getClaudeClient();

  let userMessage: string;
  switch (toolName) {
    case 'extract_key_points':
      userMessage = `Extract the key points from this text:\n\n${task.description}\n\n${task.context || ''}`;
      break;
    case 'generate_tldr':
      userMessage = `Generate a brief TL;DR for this content:\n\n${task.description}\n\n${task.context || ''}`;
      break;
    default:
      userMessage = `Summarize the following text concisely:\n\n${task.description}\n\n${task.context || ''}`;
  }

  const response = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: CLAUDE_MAX_TOKENS,
    system: config.systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return {
    content: [{ type: 'text', text }],
  };
}
