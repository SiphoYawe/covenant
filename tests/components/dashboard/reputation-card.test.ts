import { describe, it, expect } from 'vitest';
import {
  getScoreColor,
  getTrendIndicator,
  formatUSDC,
} from '@/components/dashboard/reputation-card';

describe('ReputationCard utilities', () => {
  describe('getScoreColor', () => {
    it('returns green for score >= 8', () => {
      expect(getScoreColor(8)).toBe('text-green-400');
      expect(getScoreColor(10)).toBe('text-green-400');
    });

    it('returns yellow for score >= 4 and < 8', () => {
      expect(getScoreColor(4)).toBe('text-yellow-400');
      expect(getScoreColor(7.9)).toBe('text-yellow-400');
    });

    it('returns red for score < 4', () => {
      expect(getScoreColor(3.9)).toBe('text-red-400');
      expect(getScoreColor(0)).toBe('text-red-400');
    });
  });

  describe('getTrendIndicator', () => {
    it('shows up arrow when score increased', () => {
      const result = getTrendIndicator(9, 7);
      expect(result.symbol).toBe('\u2191');
      expect(result.color).toBe('text-green-400');
    });

    it('shows down arrow when score decreased', () => {
      const result = getTrendIndicator(3, 7);
      expect(result.symbol).toBe('\u2193');
      expect(result.color).toBe('text-red-400');
    });

    it('shows dash when score unchanged', () => {
      const result = getTrendIndicator(5, 5);
      expect(result.symbol).toBe('—');
      expect(result.color).toBe('text-zinc-500');
    });

    it('shows dash when previousScore is null', () => {
      const result = getTrendIndicator(5, null);
      expect(result.symbol).toBe('—');
      expect(result.color).toBe('text-zinc-500');
    });
  });

  describe('formatUSDC', () => {
    it('formats with dollar sign and 2 decimal places', () => {
      expect(formatUSDC(11)).toBe('$11.00');
      expect(formatUSDC(0)).toBe('$0.00');
      expect(formatUSDC(1234.5)).toBe('$1234.50');
      expect(formatUSDC(6.789)).toBe('$6.79');
    });
  });
});
