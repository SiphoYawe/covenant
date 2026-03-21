/** Known agent capabilities for validation */
export const KNOWN_CAPABILITIES = [
  'research',
  'code_review',
  'summarization',
  'analysis',
  'translation',
  'data_processing',
  'content_generation',
  'security_audit',
  'testing',
  'monitoring',
] as const;

export type Capability = (typeof KNOWN_CAPABILITIES)[number];

const CAPABILITY_SET = new Set<string>(KNOWN_CAPABILITIES);

/**
 * Validate that capabilities are valid.
 * Must have 1-10 items, all from the known set.
 */
export function validateCapabilities(caps: string[]): boolean {
  if (caps.length < 1 || caps.length > 10) return false;
  return caps.every((c) => CAPABILITY_SET.has(c));
}
