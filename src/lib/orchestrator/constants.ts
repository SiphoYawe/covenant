/** Demo-specific KV key names */
export const DEMO_KV_KEYS = {
  STATE: 'demo:state',
  AGENTS: 'demo:agents',
} as const;

/** KV key prefixes to clear on demo reset */
export const KV_PREFIXES_TO_CLEAR = [
  'agent:',
  'reputation:',
  'events:',
  'graph:',
] as const;
