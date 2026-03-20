/** Severity levels for Civic flags */
export enum CivicSeverity {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical',
}

/** Civic inspection layers */
export enum CivicLayer {
  Identity = 'identity',
  Behavioral = 'behavioral',
}

/** Known attack types detectable by Civic */
export type AttackType =
  | 'prompt_injection'
  | 'data_exfiltration'
  | 'unauthorized_tool'
  | 'malicious_content'
  | 'capability_mismatch';

/** A flag raised by Civic inspection */
export type CivicFlag = {
  id: string;
  agentId: string;
  timestamp: number;
  severity: CivicSeverity;
  layer: CivicLayer;
  attackType: AttackType;
  evidence: string;
  transactionId?: string;
};

/** Verification status outcome */
export type VerificationStatus = 'verified' | 'flagged' | 'unverified';

/** Result of a Civic inspection */
export type InspectionResult = {
  passed: boolean;
  layer: CivicLayer;
  agentId: string;
  warnings: string[];
  flags: CivicFlag[];
  verificationStatus: VerificationStatus;
  timestamp: number;
};

/** Request payload for a Civic inspection */
export type InspectionRequest = {
  agentId: string;
  layer: CivicLayer;
  data: Record<string, unknown>;
  context?: Record<string, unknown>;
};

/** Response from a Civic inspection */
export type InspectionResponse = {
  result: InspectionResult;
  rawResponse?: unknown;
};

/** Configuration for the Civic MCP connection */
export type CivicConfig = {
  endpoint: string;
  token: string;
  profile?: string;
  timeout: number;
};
