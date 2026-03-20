/** All event type constants — defined upfront to prevent conflicts in parallel worktrees */
export const EVENT_TYPES = {
  AGENT_REGISTERED: 'agent:registered',
  AGENT_METADATA_STORED: 'agent:metadata-stored',
  TASK_REQUESTED: 'task:requested',
  TASK_NEGOTIATED: 'task:negotiated',
  TASK_DELIVERED: 'task:delivered',
  TASK_ACCEPTED: 'task:accepted',
  TASK_REJECTED: 'task:rejected',
  PAYMENT_INITIATED: 'payment:initiated',
  PAYMENT_SETTLED: 'payment:settled',
  PAYMENT_FAILED: 'payment:failed',
  CIVIC_IDENTITY_CHECKED: 'civic:identity-checked',
  CIVIC_BEHAVIORAL_CHECKED: 'civic:behavioral-checked',
  CIVIC_FLAGGED: 'civic:flagged',
  CIVIC_CLEARED: 'civic:cleared',
  REPUTATION_COMPUTING: 'reputation:computing',
  REPUTATION_UPDATED: 'reputation:updated',
  REPUTATION_EXPLANATION_STORED: 'reputation:explanation-stored',
  FEEDBACK_SUBMITTED: 'feedback:submitted',
  FEEDBACK_RECORDED_ONCHAIN: 'feedback:recorded-onchain',
  DEMO_ACT_CHANGED: 'demo:act-changed',
  DEMO_RESET: 'demo:reset',
  DEMO_COMPLETE: 'demo:complete',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
