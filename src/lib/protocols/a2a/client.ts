import type { AgentCard, JsonRpcRequest, JsonRpcResponse, Task, TaskSendParams } from './types';
import type { DemoAgentRole } from '@/lib/agents/types';
import { DEMO_AGENT_ROLES } from '@/lib/agents/config';
import { getAgentCard } from './agent-card';

/** Default neutral reputation score for agents with no KV data */
const DEFAULT_REPUTATION_SCORE = 5.0;

/**
 * Discover available agents by querying their Agent Cards.
 * Optionally filter by capability (skill ID).
 * Enriches cards with reputation from KV (default 5.0 if missing).
 */
export async function discoverAgents(capability?: string): Promise<AgentCard[]> {
  const cards = await Promise.all(
    DEMO_AGENT_ROLES.map(async (role: DemoAgentRole) => {
      const card = await getAgentCard(role);
      // Default reputation to 5.0 if not enriched
      if (card.reputationScore === undefined) {
        card.reputationScore = DEFAULT_REPUTATION_SCORE;
      }
      return card;
    })
  );

  if (!capability) return cards;

  // Case-insensitive capability matching against skill IDs
  const cap = capability.toLowerCase();
  return cards.filter((card) => card.skills.some((skill) => skill.id.toLowerCase() === cap));
}

/** Base URL for internal A2A HTTP calls */
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

/** Send a task request to an agent's A2A endpoint via JSON-RPC */
export async function sendTask(agentEndpoint: string, params: TaskSendParams): Promise<Task> {
  const jsonRpcRequest: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'tasks/send',
    params: params as unknown as Record<string, unknown>,
  };

  const response = await fetch(agentEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jsonRpcRequest),
  });

  const jsonRpcResponse: JsonRpcResponse = await response.json();

  if (jsonRpcResponse.error) {
    throw new Error(`A2A error (${jsonRpcResponse.error.code}): ${jsonRpcResponse.error.message}`);
  }

  return jsonRpcResponse.result as Task;
}

/** Get a task by ID from an agent's A2A endpoint */
export async function getTask(agentEndpoint: string, taskId: string): Promise<Task> {
  const jsonRpcRequest: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'tasks/get',
    params: { taskId },
  };

  const response = await fetch(agentEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jsonRpcRequest),
  });

  const jsonRpcResponse: JsonRpcResponse = await response.json();

  if (jsonRpcResponse.error) {
    throw new Error(`A2A error (${jsonRpcResponse.error.code}): ${jsonRpcResponse.error.message}`);
  }

  return jsonRpcResponse.result as Task;
}

/** Cancel a task via an agent's A2A endpoint */
export async function cancelTask(agentEndpoint: string, taskId: string): Promise<Task> {
  const jsonRpcRequest: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'tasks/cancel',
    params: { taskId },
  };

  const response = await fetch(agentEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jsonRpcRequest),
  });

  const jsonRpcResponse: JsonRpcResponse = await response.json();

  if (jsonRpcResponse.error) {
    throw new Error(`A2A error (${jsonRpcResponse.error.code}): ${jsonRpcResponse.error.message}`);
  }

  return jsonRpcResponse.result as Task;
}
