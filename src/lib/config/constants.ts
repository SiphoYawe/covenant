/** Base Sepolia testnet chain ID */
export const BASE_SEPOLIA_CHAIN_ID = 84532;

/** Default timeout for external calls (ms) */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** Max retries for transient failures */
export const MAX_RETRY_COUNT = 3;

/** Retry delay base (ms) — used with exponential backoff */
export const RETRY_DELAY_BASE_MS = 2_000;

/** SSE reconnect interval (ms) */
export const SSE_RECONNECT_MS = 3_000;

/** Max events in activity feed */
export const MAX_FEED_EVENTS = 50;

/** Claude model for agent reasoning */
export const CLAUDE_MODEL = 'claude-sonnet-4-5-20250514';

/** Max tokens for agent reasoning responses */
export const CLAUDE_MAX_TOKENS = 1024;

/** Reputation recomputation timeout (ms) */
export const REPUTATION_TIMEOUT_MS = 60_000;
