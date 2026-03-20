import { z } from 'zod';

export const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  AGENT_A_PRIVATE_KEY: z.string().min(1),
  AGENT_B_PRIVATE_KEY: z.string().min(1),
  AGENT_C_PRIVATE_KEY: z.string().min(1),
  AGENT_D_PRIVATE_KEY: z.string().min(1),
  SYSTEM_PRIVATE_KEY: z.string().min(1),
  BASE_SEPOLIA_RPC_URL: z.string().url(),
  PINATA_JWT: z.string().min(1),
  KV_REST_API_URL: z.string().url(),
  KV_REST_API_TOKEN: z.string().min(1),
  CIVIC_MCP_ENDPOINT: z.string().url(),
  CIVIC_TOKEN: z.string().min(1),
  X402_FACILITATOR_URL: z.string().url(),
  SENTRY_DSN: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;

function getEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Missing or invalid environment variables: ${missing}`);
  }
  return result.data;
}

// Lazy validation — runs on first property access, not at import time.
// This avoids build failures when env vars aren't set (e.g., during `next build`).
let _env: Env | null = null;

function resolveEnv(): Env {
  if (_env) return _env;
  if (process.env.VITEST) return {} as Env;
  _env = getEnv();
  return _env;
}

export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return resolveEnv()[prop as keyof Env];
  },
});
