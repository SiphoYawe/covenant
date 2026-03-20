/** A2A Skill — a capability advertised by an agent */
export type Skill = {
  id: string;
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
};

/** A2A Agent Card — discovery mechanism for agents */
export type AgentCard = {
  name: string;
  description: string;
  url: string;
  skills: Skill[];
  erc8004AgentId?: string;
  pricingHints?: Record<string, string>;
  reputationScore?: number;
};

/** A2A JSON-RPC method names */
export type A2AMethod = 'tasks/send' | 'tasks/get' | 'tasks/cancel';

/** A2A JSON-RPC request */
export type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: string;
  method: A2AMethod;
  params: Record<string, unknown>;
};

/** A2A JSON-RPC success response */
export type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: string;
  result?: unknown;
  error?: JsonRpcError;
};

/** A2A JSON-RPC error */
export type JsonRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

/** A2A task states */
export type TaskState = 'submitted' | 'working' | 'input-needed' | 'completed' | 'canceled' | 'failed';

/** A2A message part */
export type MessagePart = {
  type: 'text';
  text: string;
};

/** A2A message */
export type Message = {
  role: 'user' | 'agent';
  parts: MessagePart[];
  timestamp: number;
};

/** A2A artifact */
export type Artifact = {
  type: string;
  data: string;
};

/** A2A task */
export type Task = {
  id: string;
  status: TaskState;
  messages: Message[];
  artifacts: Artifact[];
};

/** Parameters for tasks/send */
export type TaskSendParams = {
  description: string;
  capability: string;
  offeredPayment: number;
  requesterId: string;
  context?: string;
};

/** Task response from provider */
export type TaskResponse = {
  acceptance: boolean;
  deliverable?: string;
  counterOffer?: number;
  reason?: string;
};

/** Parameters for tasks/get */
export type TaskGetParams = {
  taskId: string;
};

/** Parameters for tasks/cancel */
export type TaskCancelParams = {
  taskId: string;
};
