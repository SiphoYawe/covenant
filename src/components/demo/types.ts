/** Status of a single act in the UI */
export type ActStatus = 'pending' | 'running' | 'complete' | 'error';

/** An act definition for display */
export type DemoAct = {
  number: number;
  name: string;
  label: string;
  estimatedDuration: number;
  status: ActStatus;
  error?: string;
};

/** Overall demo execution status */
export type DemoExecutionStatus = 'idle' | 'running' | 'complete' | 'error';

/** Auto-play configuration */
export type AutoPlayConfig = {
  enabled: boolean;
  delayMs: number;
};

/** All 5 demo acts with display info */
export const DEMO_ACTS: Omit<DemoAct, 'status' | 'error'>[] = [
  { number: 1, name: 'registration', label: 'Act 1: Registration', estimatedDuration: 30 },
  { number: 2, name: 'economy-works', label: 'Act 2: Economy Works', estimatedDuration: 45 },
  { number: 3, name: 'villain', label: 'Act 3: Villain', estimatedDuration: 45 },
  { number: 4, name: 'consequences', label: 'Act 4: Consequences', estimatedDuration: 30 },
  { number: 5, name: 'payoff', label: 'Act 5: Payoff', estimatedDuration: 30 },
];

export const DEFAULT_AUTO_PLAY_DELAY = 5000;
export const MIN_AUTO_PLAY_DELAY = 2000;
export const MAX_AUTO_PLAY_DELAY = 15000;
