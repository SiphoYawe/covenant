import { getClaudeClient } from '@/lib/ai/client';
import { CLAUDE_MODEL, CLAUDE_MAX_TOKENS } from '@/lib/config/constants';
import { AGENT_CONFIGS } from './config';
import type { AgentTask, MCPToolResult } from '@/lib/protocols/mcp/types';

export async function executeReviewerTask(task: AgentTask, toolName: string): Promise<MCPToolResult> {
  const config = AGENT_CONFIGS.reviewer;
  const claude = getClaudeClient();

  let userMessage: string;
  switch (toolName) {
    case 'analyze_diff':
      userMessage = `Analyze this code diff for potential issues:\n\n${task.description}\n\n${task.context || ''}`;
      break;
    case 'check_style':
      userMessage = `Check the style and formatting of this code:\n\n${task.description}\n\n${task.context || ''}`;
      break;
    default:
      userMessage = `Review this code for quality, security, and best practices:\n\n${task.description}\n\n${task.context || ''}`;
  }

  const response = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: CLAUDE_MAX_TOKENS,
    system: config.systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => ('text' in block ? block.text : ''))
    .join('\n');

  return {
    content: [{ type: 'text', text }],
  };
}
