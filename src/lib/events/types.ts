/** Protocols in the Covenant system */
export enum Protocol {
  A2a = 'a2a',
  Mcp = 'mcp',
  X402 = 'x402',
  Erc8004 = 'erc8004',
  CovenantAi = 'covenant-ai',
  Civic = 'civic',
}

/** Core event type emitted to the event bus and consumed by dashboard SSE */
export type DemoEvent = {
  id: string;
  timestamp: number;
  type: string;
  protocol: Protocol;
  agentId?: string;
  targetAgentId?: string;
  data: Record<string, unknown>;
};
