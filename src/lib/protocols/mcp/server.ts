import type { MCPToolResult, AgentTask } from './types';
import { getToolsForRole } from './tools';
import type { DemoAgentRole } from '@/lib/agents/types';
import { executeResearcherTask } from '@/lib/agents/researcher';
import { executeReviewerTask } from '@/lib/agents/reviewer';
import { executeSummarizerTask } from '@/lib/agents/summarizer';
import { executeMaliciousTask } from '@/lib/agents/malicious';

/** Execute an MCP tool for a given agent */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  agentRole: DemoAgentRole
): Promise<MCPToolResult> {
  // Verify the tool exists for this role
  const tools = getToolsForRole(agentRole);
  const tool = tools.find((t) => t.name === toolName);

  if (!tool) {
    return {
      content: [{ type: 'text', text: `Tool not found: ${toolName}` }],
      isError: true,
    };
  }

  const task: AgentTask = {
    taskId: crypto.randomUUID(),
    description: (args.code as string) || (args.text as string) || (args.topic as string) || (args.deliverable as string) || (args.diff as string) || '',
    capability: toolName,
    context: args.context as string | undefined,
  };

  try {
    return await executeAgentTask(agentRole, task, toolName);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown execution error';
    return {
      content: [{ type: 'text', text: `Tool execution failed: ${message}` }],
      isError: true,
    };
  }
}

/** Route to the correct agent behavior module */
async function executeAgentTask(
  role: DemoAgentRole,
  task: AgentTask,
  toolName: string
): Promise<MCPToolResult> {
  switch (role) {
    case 'researcher':
      return executeResearcherTask(task, toolName);
    case 'reviewer':
      return executeReviewerTask(task, toolName);
    case 'summarizer':
      return executeSummarizerTask(task, toolName);
    case 'malicious':
      return executeMaliciousTask(task, toolName);
  }
}
