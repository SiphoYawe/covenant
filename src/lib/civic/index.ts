export { CivicGateway, getCivicGateway } from './gateway';
export { inspectIdentityMetadata } from './identity-inspector';
export { inspectInput, inspectOutput } from './behavioral-inspector';
export {
  handleThreat,
  storeFlag,
  getFlags,
  getFlagsSince,
  type ThreatContext,
  type ThreatAction,
  type ThreatHandlingResult,
} from './threat-handler';
export { getCivicPenalty, computePenalty } from './reputation-bridge';
export {
  CivicSeverity,
  CivicLayer,
  type AttackType,
  type CivicFlag,
  type VerificationStatus,
  type InspectionResult,
  type InspectionRequest,
  type InspectionResponse,
  type CivicConfig,
} from './types';
