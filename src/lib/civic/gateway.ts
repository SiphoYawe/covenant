import { inspectIdentityMetadata } from './identity-inspector';
import { inspectInput, inspectOutput } from './behavioral-inspector';
import { CivicLayer, CivicSeverity } from './types';
import type { CivicConfig, CivicFlag, InspectionResponse, InspectionResult } from './types';
import type { AgentMetadata } from '@/lib/protocols/erc8004/types';
import { createEventBus, Protocol, EVENT_TYPES } from '@/lib/events';
import type { EventBus } from '@/lib/events';
import { env } from '@/lib/config/env';
import { kvLpush, kvLrange } from '@/lib/storage/kv';

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
   * Inspects incoming task requests (input) and outgoing deliverables (output).
   */
  async inspectBehavior(
    agentId: string,
    data: Record<string, unknown>,
    direction: 'input' | 'output',
    targetAgentId?: string,
  ): Promise<InspectionResponse> {
    let result: InspectionResult;

    try {
      if (direction === 'input') {
        result = await inspectInput(agentId, {
          description: (data.description as string) || '',
          capability: (data.capability as string) || '',
          context: data.context as string | undefined,
        });
      } else {
        result = await inspectOutput(agentId, {
          deliverable: (data.deliverable as string) || '',
          taskId: data.taskId as string | undefined,
        });
      }
    } catch {
      result = {
        passed: true,
        layer: CivicLayer.Behavioral,
        agentId,
        warnings: ['Civic MCP unavailable — proceeding unverified'],
        flags: [],
        verificationStatus: 'unverified',
        timestamp: Date.now(),
      };
    }

    // Emit event based on result
    if (result.passed) {
      await getEventBus().emit({
        type: EVENT_TYPES.CIVIC_BEHAVIORAL_CHECKED,
        protocol: Protocol.Civic,
        agentId,
        targetAgentId,
        data: {
          layer: result.layer,
          direction,
          verificationStatus: result.verificationStatus,
          passed: true,
        },
      });
    } else {
      await getEventBus().emit({
        type: EVENT_TYPES.CIVIC_FLAGGED,
        protocol: Protocol.Civic,
        agentId,
        targetAgentId,
        data: {
          layer: 'behavioral',
          direction,
          severity: result.flags[0]?.severity,
          attackType: result.flags[0]?.attackType,
          evidence: result.flags[0]?.evidence,
        },
      });
    }

    return { result };
  }

  /**
   * Validate a tool call against declared capabilities.
   * Local comparison — no external Civic API call needed.
   */
  async validateToolCall(
    agentId: string,
    toolName: string,
    declaredCapabilities: string[],
  ): Promise<InspectionResponse> {
    if (declaredCapabilities.includes(toolName)) {
      return {
        result: {
          passed: true,
          layer: CivicLayer.Behavioral,
          agentId,
          warnings: [],
          flags: [],
          verificationStatus: 'verified',
          timestamp: Date.now(),
        },
      };
    }

    const flag: CivicFlag = {
      id: crypto.randomUUID(),
      agentId,
      timestamp: Date.now(),
      severity: CivicSeverity.High,
      layer: CivicLayer.Behavioral,
      attackType: 'capability_mismatch',
      evidence: `Agent "${agentId}" attempted to call tool "${toolName}" which is not in declared capabilities: [${declaredCapabilities.join(', ')}]`,
    };

    // Store flag in KV
    await kvLpush(`agent:${agentId}:civic-flags`, JSON.stringify(flag));

    // Emit event
    await getEventBus().emit({
      type: EVENT_TYPES.CIVIC_TOOL_BLOCKED,
      protocol: Protocol.Civic,
      agentId,
      data: {
        attemptedTool: toolName,
        declaredCapabilities,
        severity: flag.severity,
        attackType: flag.attackType,
      },
    });

    return {
      result: {
        passed: false,
        layer: CivicLayer.Behavioral,
        agentId,
        warnings: [flag.evidence],
        flags: [flag],
        verificationStatus: 'flagged',
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
