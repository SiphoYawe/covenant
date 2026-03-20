import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/lib/config/env';

/**
 * Create a Claude API client instance.
 * Use this factory for testing; the singleton below is for production.
 */
export function createClaudeClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

/**
 * Singleton Claude client for production use.
 * Lazily initialized — env import is safe because env.ts short-circuits in test mode.
 */
let _client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!_client) {
    _client = createClaudeClient(env.ANTHROPIC_API_KEY);
  }
  return _client;
}
