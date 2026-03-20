/** MCP tool content part */
export type MCPContentPart = {
  type: 'text';
  text: string;
};

/** MCP tool execution result */
export type MCPToolResult = {
  content: MCPContentPart[];
  isError?: boolean;
};

/** MCP tool declaration */
export type MCPTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

/** MCP tool invocation */
export type MCPToolCall = {
  name: string;
  arguments: Record<string, unknown>;
};

/** Agent task context passed to behavior modules */
export type AgentTask = {
  taskId: string;
  description: string;
  capability: string;
  context?: string;
};
