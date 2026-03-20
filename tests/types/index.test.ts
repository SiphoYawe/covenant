import { describe, it, expect } from 'vitest';
import type { ApiError, AgentRole, HexString } from '@/types';

describe('Shared Types', () => {
  it('ApiError has correct shape', () => {
    const error: ApiError = {
      error: {
        code: 'TEST_ERROR',
        message: 'Test error message',
      },
    };
    expect(error.error.code).toBe('TEST_ERROR');
    expect(error.error.message).toBe('Test error message');
    expect(error.error.details).toBeUndefined();
  });

  it('ApiError supports optional details', () => {
    const error: ApiError = {
      error: {
        code: 'TX_FAILED',
        message: 'Transaction failed',
        details: { txHash: '0x123' },
      },
    };
    expect(error.error.details).toEqual({ txHash: '0x123' });
  });

  it('AgentRole is a valid union type', () => {
    const roles: AgentRole[] = ['researcher', 'reviewer', 'summarizer', 'malicious', 'system'];
    expect(roles).toHaveLength(5);
  });

  it('HexString type accepts hex strings', () => {
    const addr: HexString = '0x1234abcdef';
    expect(addr.startsWith('0x')).toBe(true);
  });
});
