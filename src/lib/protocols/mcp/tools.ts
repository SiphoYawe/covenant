import type { MCPTool } from './types';
import type { DemoAgentRole } from '@/lib/agents/types';

/** Agent A: Researcher tools */
export const RESEARCHER_TOOLS: MCPTool[] = [
  {
    name: 'research_topic',
    description: 'Research a topic and produce a comprehensive analysis',
    inputSchema: {
      type: 'object',
      properties: { topic: { type: 'string', description: 'The topic to research' } },
      required: ['topic'],
    },
  },
  {
    name: 'evaluate_deliverable',
    description: 'Evaluate the quality of a deliverable from another agent',
    inputSchema: {
      type: 'object',
      properties: { deliverable: { type: 'string', description: 'The deliverable content to evaluate' } },
      required: ['deliverable'],
    },
  },
];

/** Agent B: Reviewer tools */
export const REVIEWER_TOOLS: MCPTool[] = [
  {
    name: 'review_code',
    description: 'Review code for quality, security vulnerabilities, and best practices',
    inputSchema: {
      type: 'object',
      properties: { code: { type: 'string', description: 'The code to review' } },
      required: ['code'],
    },
  },
  {
    name: 'analyze_diff',
    description: 'Analyze a code diff for potential issues and improvements',
    inputSchema: {
      type: 'object',
      properties: { diff: { type: 'string', description: 'The diff to analyze' } },
      required: ['diff'],
    },
  },
  {
    name: 'check_style',
    description: 'Check code style and formatting against best practices',
    inputSchema: {
      type: 'object',
      properties: { code: { type: 'string', description: 'The code to check' } },
      required: ['code'],
    },
  },
];

/** Agent C: Summarizer tools */
export const SUMMARIZER_TOOLS: MCPTool[] = [
  {
    name: 'summarize_text',
    description: 'Summarize text content into a concise overview',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: 'The text to summarize' } },
      required: ['text'],
    },
  },
  {
    name: 'extract_key_points',
    description: 'Extract the most important points from text content',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: 'The text to extract key points from' } },
      required: ['text'],
    },
  },
  {
    name: 'generate_tldr',
    description: 'Generate a brief TL;DR summary of the content',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: 'The text to generate TL;DR for' } },
      required: ['text'],
    },
  },
];

/** Agent D: Malicious — identical declarations to reviewer (malice is in execution) */
export const MALICIOUS_TOOLS: MCPTool[] = REVIEWER_TOOLS.map((tool) => ({ ...tool }));

/** Get tool declarations for a given agent role */
export function getToolsForRole(role: DemoAgentRole): MCPTool[] {
  switch (role) {
    case 'researcher':
      return RESEARCHER_TOOLS;
    case 'reviewer':
      return REVIEWER_TOOLS;
    case 'summarizer':
      return SUMMARIZER_TOOLS;
    case 'malicious':
      return MALICIOUS_TOOLS;
  }
}
