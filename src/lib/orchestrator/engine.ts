import { executeLifecycle } from './lifecycle';
import type { LifecycleRequest, LifecycleResult } from './types';

/**
 * Orchestration engine that manages lifecycle execution.
 * Provides a class-based interface for the demo orchestrator (Epic 8).
 */
export class OrchestratorEngine {
  /**
   * Execute a full interaction lifecycle.
   * Delegates to the lifecycle manager which coordinates all protocol modules.
   */
  async executeLifecycle(request: LifecycleRequest): Promise<LifecycleResult> {
    return executeLifecycle(request);
  }
}
