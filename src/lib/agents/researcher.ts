import { getClaudeClient } from '@/lib/ai/client';
import { CLAUDE_MODEL, CLAUDE_MAX_TOKENS } from '@/lib/config/constants';
import { AGENT_CONFIGS } from './config';
import type { AgentTask, MCPToolResult } from '@/lib/protocols/mcp/types';

export async function executeResearcherTask(task: AgentTask, toolName: string): Promise<MCPToolResult> {
  const config = AGENT_CONFIGS.researcher;
  const claude = getClaudeClient();

  const userMessage = toolName === 'evaluate_deliverable'
    ? `Evaluate the quality of this deliverable:\n\n${task.description}\n\n${task.context || ''}`
    : `Research the following topic thoroughly:\n\n${task.description}\n\n${task.context || ''}`;

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
