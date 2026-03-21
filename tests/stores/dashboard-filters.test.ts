import { describe, it, expect, beforeEach } from 'vitest';
import { useDashboardStore } from '@/stores/dashboard';
import type { AgentState } from '@/stores/dashboard';

function seedAgent(id: string, overrides: Partial<AgentState> = {}) {
  useDashboardStore.getState().updateAgent(id, {
    name: overrides.name ?? `Agent-${id}`,
    role: overrides.role ?? 'provider',
    reputationScore: overrides.reputationScore ?? 5,
    civicFlagged: overrides.civicFlagged ?? false,
    ...overrides,
  });
}

describe('Dashboard Store - Filter/Sort/Pagination', () => {
  beforeEach(() => {
    useDashboardStore.setState(useDashboardStore.getInitialState());
  });

  describe('filterBy state', () => {
    it('defaults to "all"', () => {
      expect(useDashboardStore.getState().filterBy).toBe('all');
    });

    it('can be set to "top-rated"', () => {
      useDashboardStore.getState().setFilterBy('top-rated');
      expect(useDashboardStore.getState().filterBy).toBe('top-rated');
    });

    it('can be set to "flagged"', () => {
      useDashboardStore.getState().setFilterBy('flagged');
      expect(useDashboardStore.getState().filterBy).toBe('flagged');
    });

    it('can be set to "excluded"', () => {
      useDashboardStore.getState().setFilterBy('excluded');
      expect(useDashboardStore.getState().filterBy).toBe('excluded');
    });
  });

  describe('sortBy state', () => {
    it('defaults to "score"', () => {
      expect(useDashboardStore.getState().sortBy).toBe('score');
    });

    it('can be set to "payment-volume"', () => {
      useDashboardStore.getState().setSortBy('payment-volume');
      expect(useDashboardStore.getState().sortBy).toBe('payment-volume');
    });

    it('can be set to "domain"', () => {
      useDashboardStore.getState().setSortBy('domain');
      expect(useDashboardStore.getState().sortBy).toBe('domain');
    });
  });

  describe('pagination state', () => {
    it('defaults to page 1 with pageSize 12', () => {
      const state = useDashboardStore.getState();
      expect(state.currentPage).toBe(1);
      expect(state.pageSize).toBe(12);
    });

    it('can set current page', () => {
      useDashboardStore.getState().setCurrentPage(3);
      expect(useDashboardStore.getState().currentPage).toBe(3);
    });

    it('can set page size', () => {
      useDashboardStore.getState().setPageSize(20);
      expect(useDashboardStore.getState().pageSize).toBe(20);
    });
  });

  describe('protocolFilter state', () => {
    it('defaults to "all"', () => {
      expect(useDashboardStore.getState().protocolFilter).toBe('all');
    });

    it('can filter by specific protocol', () => {
      useDashboardStore.getState().setProtocolFilter('erc8004');
      expect(useDashboardStore.getState().protocolFilter).toBe('erc8004');
    });
  });

  describe('searchQuery state', () => {
    it('defaults to empty string', () => {
      expect(useDashboardStore.getState().searchQuery).toBe('');
    });

    it('can be set', () => {
      useDashboardStore.getState().setSearchQuery('NexusResearch');
      expect(useDashboardStore.getState().searchQuery).toBe('NexusResearch');
    });
  });

  describe('paymentsPage state', () => {
    it('defaults to page 1', () => {
      expect(useDashboardStore.getState().paymentsPage).toBe(1);
    });

    it('can be set', () => {
      useDashboardStore.getState().setPaymentsPage(5);
      expect(useDashboardStore.getState().paymentsPage).toBe(5);
    });
  });

  describe('resetDemo clears filter state', () => {
    it('resets filter/sort/pagination to defaults', () => {
      const store = useDashboardStore.getState();
      store.setFilterBy('flagged');
      store.setSortBy('domain');
      store.setCurrentPage(5);
      store.setProtocolFilter('civic');
      store.setSearchQuery('test');
      store.setPaymentsPage(3);

      store.resetDemo();

      const state = useDashboardStore.getState();
      expect(state.filterBy).toBe('all');
      expect(state.sortBy).toBe('score');
      expect(state.currentPage).toBe(1);
      expect(state.protocolFilter).toBe('all');
      expect(state.searchQuery).toBe('');
      expect(state.paymentsPage).toBe(1);
    });
  });
});
