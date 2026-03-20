/** Standard API error response shape for all routes */
export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** Agent role in the Covenant system */
export type AgentRole = 'researcher' | 'reviewer' | 'summarizer' | 'malicious' | 'system';

/** Hex string with 0x prefix (addresses, tx hashes, token IDs) */
export type HexString = `0x${string}`;

/** Agent identifier — ERC-721 token ID as hex string */
export type AgentId = HexString;

/** USDC amount as human-readable string (e.g., "6.00") */
export type UsdcAmount = string;
