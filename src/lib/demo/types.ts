/** Types for the seed-based demo platform and live triggers */

/** Available live trigger types */
export type LiveTriggerType = 'lifecycle' | 'sybil-cascade';

/** Seed platform status summary */
export type SeedStatus = {
  agentCount: number;
  transactionCount: number;
  usdcVolume: number;
  lastSeeded: number | null;
};

/** Result of executing a live trigger */
export type LiveTriggerResult = {
  type: LiveTriggerType;
  success: boolean;
  summary: string;
  agents: string[];
  amounts: number[];
  txHashes: string[];
  scoreChanges: Record<string, { before: number; after: number }>;
};

/** A single step event emitted during live trigger execution */
export type LiveTriggerEvent = {
  timestamp: number;
  step: string;
  protocol: string;
  status: 'started' | 'completed' | 'failed';
  data?: Record<string, unknown>;
};
