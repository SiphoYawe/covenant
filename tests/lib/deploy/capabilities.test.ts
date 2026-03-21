import { describe, it, expect } from 'vitest';
import {
  KNOWN_CAPABILITIES,
  validateCapabilities,
} from '@/lib/deploy/capabilities';

describe('Capability Constants and Validation', () => {
  it('KNOWN_CAPABILITIES has exactly 10 items', () => {
    expect(KNOWN_CAPABILITIES).toHaveLength(10);
  });

  it('KNOWN_CAPABILITIES includes expected values', () => {
    expect(KNOWN_CAPABILITIES).toContain('research');
    expect(KNOWN_CAPABILITIES).toContain('code_review');
    expect(KNOWN_CAPABILITIES).toContain('summarization');
    expect(KNOWN_CAPABILITIES).toContain('analysis');
    expect(KNOWN_CAPABILITIES).toContain('translation');
    expect(KNOWN_CAPABILITIES).toContain('data_processing');
    expect(KNOWN_CAPABILITIES).toContain('content_generation');
    expect(KNOWN_CAPABILITIES).toContain('security_audit');
    expect(KNOWN_CAPABILITIES).toContain('testing');
    expect(KNOWN_CAPABILITIES).toContain('monitoring');
  });

  describe('validateCapabilities', () => {
    it('returns true for valid capabilities', () => {
      expect(validateCapabilities(['research', 'analysis'])).toBe(true);
    });

    it('returns true for single capability', () => {
      expect(validateCapabilities(['code_review'])).toBe(true);
    });

    it('returns true for all 10 capabilities', () => {
      expect(validateCapabilities([...KNOWN_CAPABILITIES])).toBe(true);
    });

    it('returns false for empty array', () => {
      expect(validateCapabilities([])).toBe(false);
    });

    it('returns false for more than 10 items', () => {
      const tooMany = [...KNOWN_CAPABILITIES, 'research'];
      expect(validateCapabilities(tooMany)).toBe(false);
    });

    it('returns false for unknown capability', () => {
      expect(validateCapabilities(['research', 'teleportation'])).toBe(false);
    });
  });
});
