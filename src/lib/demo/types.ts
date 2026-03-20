import type { ApiError } from '@/types';

/** Valid act numbers */
export type ActNumber = 1 | 2 | 3 | 4 | 5;

/** Status of a single act */
export type ActStatus = 'pending' | 'running' | 'completed' | 'failed';

/** Result of executing a single act */
export type ActResult = {
  act: ActNumber;
  status: ActStatus;
  duration: number;
  events: string[];
  data: Record<string, unknown>;
  error?: ApiError;
};

/** Interface for act executors */
export interface ActExecutor {
  execute(actResults: Record<number, ActResult>): Promise<ActResult>;
  canExecute(currentAct: number, actResults: Record<number, ActResult>): boolean;
  actNumber: ActNumber;
  name: string;
  description: string;
  expectedDuration: number;
}

/** Pricing and threshold configuration for the demo */
export type ActConfig = {
  agents: {
    researcher: string;
    reviewer: string;
    summarizer: string;
    malicious: string;
  };
  pricing: {
    reviewJob: number;
    summaryJob: number;
    villainUndercut: number;
    premiumJob: number;
  };
  thresholds: {
    exclusion: number;
    neutral: number;
  };
};

/** Default demo configuration */
export const ACT_CONFIGS: ActConfig = {
  agents: {
    researcher: 'researcher',
    reviewer: 'reviewer',
    summarizer: 'summarizer',
    malicious: 'malicious',
  },
  pricing: {
    reviewJob: 10,
    summaryJob: 5,
    villainUndercut: 3,
    premiumJob: 15,
  },
  thresholds: {
    exclusion: 3.0,
    neutral: 5.0,
  },
};

/** Valid act numbers array for validation */
export const VALID_ACT_NUMBERS: ActNumber[] = [1, 2, 3, 4, 5];

/** Check if a number is a valid act number */
export function isValidActNumber(n: number): n is ActNumber {
  return VALID_ACT_NUMBERS.includes(n as ActNumber);
}
