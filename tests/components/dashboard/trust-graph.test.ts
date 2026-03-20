import { describe, it, expect, beforeEach } from 'vitest';
import { useDashboardStore } from '@/stores/dashboard';

describe('Trust Graph store integration', () => {
  beforeEach(() => {
    useDashboardStore.setState(useDashboardStore.getInitialState());
  });

  describe('selectedAgentId', () => {
    it('defaults to null', () => {
      expect(useDashboardStore.getState().selectedAgentId).toBeNull();
    });

    it('setSelectedAgent sets the selected agent ID', () => {
      useDashboardStore.getState().setSelectedAgent('0xabc');
      expect(useDashboardStore.getState().selectedAgentId).toBe('0xabc');
    });

    it('setSelectedAgent(null) clears the selection', () => {
      useDashboardStore.getState().setSelectedAgent('0xabc');
      useDashboardStore.getState().setSelectedAgent(null);
      expect(useDashboardStore.getState().selectedAgentId).toBeNull();
    });

    it('resetDemo clears selectedAgentId', () => {
      useDashboardStore.getState().setSelectedAgent('0xabc');
      useDashboardStore.getState().resetDemo();
      expect(useDashboardStore.getState().selectedAgentId).toBeNull();
    });
  });
});
