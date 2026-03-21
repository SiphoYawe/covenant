import type { AgentCard, Skill } from './types';
import type { DemoAgentRole } from '@/lib/agents/types';
import { AGENT_CONFIGS } from '@/lib/agents/config';
import { kvGet } from '@/lib/storage/kv';

/** Base URL for agent A2A endpoints */
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

/** Map of agent capabilities to A2A Skill definitions */
const SKILL_DEFINITIONS: Record<string, Skill> = {
  research: {
    id: 'research_topic',
    name: 'Research Topic',
    description: 'Research a topic and produce a comprehensive analysis',
    inputSchema: { type: 'object', properties: { topic: { type: 'string' } }, required: ['topic'] },
  },
  evaluate: {
    id: 'evaluate_deliverable',
    name: 'Evaluate Deliverable',
    description: 'Evaluate the quality of a deliverable from another agent',
    inputSchema: { type: 'object', properties: { deliverable: { type: 'string' } }, required: ['deliverable'] },
  },
  hire: {
    id: 'hire_agent',
    name: 'Hire Agent',
    description: 'Hire another agent for a task via x402 payment',
    inputSchema: { type: 'object', properties: { agentId: { type: 'string' }, task: { type: 'string' } }, required: ['agentId', 'task'] },
  },
  review_code: {
    id: 'review_code',
    name: 'Review Code',
    description: 'Review code for quality, security vulnerabilities, and best practices',
    inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] },
  },
  analyze_diff: {
    id: 'analyze_diff',
    name: 'Analyze Diff',
    description: 'Analyze a code diff for potential issues and improvements',
    inputSchema: { type: 'object', properties: { diff: { type: 'string' } }, required: ['diff'] },
  },
  check_style: {
    id: 'check_style',
    name: 'Check Style',
    description: 'Check code style and formatting against best practices',
    inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] },
  },
  summarize_text: {
    id: 'summarize_text',
    name: 'Summarize Text',
    description: 'Summarize text content into a concise overview',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  extract_key_points: {
    id: 'extract_key_points',
    name: 'Extract Key Points',
    description: 'Extract the most important points from text content',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  generate_tldr: {
    id: 'generate_tldr',
    name: 'Generate TL;DR',
    description: 'Generate a brief TL;DR summary of the content',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
};

/** Generate an A2A Agent Card for a given agent config */
export function generateAgentCard(
  role: DemoAgentRole,
  options?: { erc8004AgentId?: string; reputationScore?: number }
): AgentCard {
  const config = AGENT_CONFIGS[role];
  const skills: Skill[] = config.capabilities
    .map((cap) => SKILL_DEFINITIONS[cap])
    .filter((s): s is Skill => s !== undefined);

  return {
    name: config.name,
    description: config.description,
    url: `${BASE_URL}/api/agents/${role}/a2a`,
    skills,
    erc8004AgentId: options?.erc8004AgentId,
    pricingHints: getPricingHints(role),
    reputationScore: options?.reputationScore,
  };
}

/** Generate an A2A Agent Card from dynamic config (not role-based) */
export function generateDynamicAgentCard(config: {
  name: string;
  description: string;
  capabilities: string[];
  agentId?: string;
  address?: string;
}): AgentCard {
  const skills: Skill[] = config.capabilities
    .map((cap) => SKILL_DEFINITIONS[cap])
    .filter((s): s is Skill => s !== undefined);

  return {
    name: config.name,
    description: config.description,
    url: `${BASE_URL}/api/agents/${config.agentId ?? 'unknown'}/a2a`,
    skills,
    erc8004AgentId: config.agentId,
  };
}

/** Get an enriched Agent Card with reputation data from KV */
export async function getAgentCard(role: DemoAgentRole): Promise<AgentCard> {
  const card = generateAgentCard(role);

  const reputation = await kvGet<{ score: number; explanation: string }>(`agent:${role}:reputation`);
  if (reputation) {
    card.reputationScore = reputation.score;
  }

  return card;
}

/** Get pricing hints per role */
function getPricingHints(role: DemoAgentRole): Record<string, string> {
  switch (role) {
    case 'researcher':
      return { baseRate: '5 USDC', evaluationRate: '2 USDC' };
    case 'reviewer':
      return { codeReview: '5-10 USDC', styleCheck: '2-5 USDC' };
    case 'summarizer':
      return { summary: '3-5 USDC', tldr: '1-2 USDC' };
    case 'malicious':
      return { codeReview: '5-10 USDC', styleCheck: '2-5 USDC' };
  }
}
