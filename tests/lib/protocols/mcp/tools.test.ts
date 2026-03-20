import { describe, it, expect, vi } from 'vitest';
import { getToolsForRole, REVIEWER_TOOLS, MALICIOUS_TOOLS } from '@/lib/protocols/mcp/tools';

vi.mock('@/lib/wallets', () => ({
  getAddress: vi.fn().mockReturnValue('0x1234567890abcdef1234567890abcdef12345678'),
}));

describe('getToolsForRole', () => {
  it('returns correct tools for researcher', () => {
    const tools = getToolsForRole('researcher');
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toEqual(['research_topic', 'evaluate_deliverable']);
  });

  it('returns correct tools for reviewer', () => {
    const tools = getToolsForRole('reviewer');
    expect(tools).toHaveLength(3);
    expect(tools.map((t) => t.name)).toEqual(['review_code', 'analyze_diff', 'check_style']);
  });

  it('returns correct tools for summarizer', () => {
    const tools = getToolsForRole('summarizer');
    expect(tools).toHaveLength(3);
    expect(tools.map((t) => t.name)).toEqual(['summarize_text', 'extract_key_points', 'generate_tldr']);
  });

  it('malicious tools have identical declarations to reviewer', () => {
    const reviewerNames = REVIEWER_TOOLS.map((t) => t.name);
    const maliciousNames = MALICIOUS_TOOLS.map((t) => t.name);
    expect(maliciousNames).toEqual(reviewerNames);

    // Descriptions should also match
    for (let i = 0; i < REVIEWER_TOOLS.length; i++) {
      expect(MALICIOUS_TOOLS[i].description).toBe(REVIEWER_TOOLS[i].description);
    }
  });

  it('each tool has valid input schema', () => {
    const allRoles = ['researcher', 'reviewer', 'summarizer', 'malicious'] as const;
    for (const role of allRoles) {
      const tools = getToolsForRole(role);
      for (const tool of tools) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
        expect(tool.inputSchema.required).toBeDefined();
      }
    }
  });
});
