import { describe, it, expect, beforeEach } from 'vitest';
import { acquireLock, releaseLock, isLocked } from '@/lib/demo/lock';

describe('Demo Lock Mechanism', () => {
  beforeEach(() => {
    // Release any held locks between tests
    releaseLock('lifecycle');
    releaseLock('sybil-cascade');
  });

  it('acquires lock successfully when not held', () => {
    expect(acquireLock('lifecycle')).toBe(true);
  });

  it('rejects lock acquisition when already held', () => {
    acquireLock('lifecycle');
    expect(acquireLock('lifecycle')).toBe(false);
  });

  it('releases lock and allows re-acquisition', () => {
    acquireLock('lifecycle');
    releaseLock('lifecycle');
    expect(acquireLock('lifecycle')).toBe(true);
  });

  it('maintains independent locks per trigger type', () => {
    acquireLock('lifecycle');
    expect(acquireLock('sybil-cascade')).toBe(true);
  });

  it('reports locked status correctly', () => {
    expect(isLocked('lifecycle')).toBe(false);
    acquireLock('lifecycle');
    expect(isLocked('lifecycle')).toBe(true);
    releaseLock('lifecycle');
    expect(isLocked('lifecycle')).toBe(false);
  });

  it('release is idempotent on unlocked trigger', () => {
    releaseLock('lifecycle');
    releaseLock('lifecycle');
    expect(isLocked('lifecycle')).toBe(false);
  });
});
