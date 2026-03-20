import { inspectIdentityMetadata } from './identity-inspector';
import { CivicLayer } from './types';
import type { CivicConfig, InspectionResponse, InspectionResult } from './types';
import type { AgentMetadata } from '@/lib/protocols/erc8004/types';
import { createEventBus, Protocol, EVENT_TYPES } from '@/lib/events';
import type { EventBus } from '@/lib/events';
import { env } from '@/lib/config/env';

let _eventBus: EventBus | null = null;
function getEventBus(): EventBus {
  if (!_eventBus) _eventBus = createEventBus();
  return _eventBus;
}

/**
 * Civic Gateway — orchestrates all Civic inspection flows.
 * Entry point for Layer 1 (identity) and Layer 2 (behavioral) inspections.
 */
export class CivicGateway {
  private config: CivicConfig;

  constructor(config: CivicConfig) {
    this.config = config;
  }

  /**
   * Layer 1: Inspect agent metadata at registration time.
   * Delegates to identity-inspector, wraps with event emission.
   */
  async inspectIdentity(
    agentId: string,
    metadata: Pick<AgentMetadata, 'name' | 'description' | 'capabilities'>,
  ): Promise<InspectionResponse> {
    let result: InspectionResult;

    try {
      result = await inspectIdentityMetadata(agentId, metadata as AgentMetadata);
    } catch {
      // Graceful degradation — Civic unavailable
      result = {
        passed: true,
        layer: CivicLayer.Identity,
        agentId,
        warnings: ['Civic MCP unavailable — proceeding unverified'],
        flags: [],
        verificationStatus: 'unverified',
        timestamp: Date.now(),
      };
    }

    // Emit event after inspection
    await getEventBus().emit({
      type: EVENT_TYPES.CIVIC_IDENTITY_CHECKED,
      protocol: Protocol.Civic,
      agentId,
      data: {
        layer: result.layer,
        verificationStatus: result.verificationStatus,
        warningCount: result.warnings.length,
        passed: result.passed,
      },
    });

    return { result };
  }

  /**
   * Layer 2: Inspect agent behavior at runtime.
   * Stub — implemented in Story 4.2.
   */
  async inspectBehavior(
    agentId: string,
    _data: Record<string, unknown>,
    _direction: 'inbound' | 'outbound',
  ): Promise<InspectionResponse> {
    return {
      result: {
        passed: true,
        layer: CivicLayer.Behavioral,
        agentId,
        warnings: ['Behavioral inspection not yet implemented'],
        flags: [],
        verificationStatus: 'unverified',
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Validate a tool call against declared capabilities.
   * Stub — implemented in Story 4.3.
   */
  async validateToolCall(
    agentId: string,
    _toolName: string,
    _declaredCapabilities: string[],
  ): Promise<InspectionResponse> {
    return {
      result: {
        passed: true,
        layer: CivicLayer.Identity,
        agentId,
        warnings: ['Tool call validation not yet implemented'],
        flags: [],
        verificationStatus: 'unverified',
        timestamp: Date.now(),
      },
    };
  }
}

/** Lazily-initialized singleton gateway using env config */
let _gateway: CivicGateway | null = null;
export function getCivicGateway(): CivicGateway {
  if (!_gateway) {
    _gateway = new CivicGateway({
      endpoint: env.CIVIC_MCP_ENDPOINT,
      token: env.CIVIC_TOKEN,
      timeout: 10000,
    });
  }
  return _gateway;
}
