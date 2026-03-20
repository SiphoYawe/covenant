// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useDashboardStore } from '@/stores/dashboard';
import { AgentDetail } from '@/components/dashboard/agent-detail';

describe('AgentDetail component', () => {
  beforeEach(() => {
    useDashboardStore.setState(useDashboardStore.getInitialState());
  });

  afterEach(() => {
    cleanup();
  });

  it('renders empty state when no agent is selected', () => {
    render(<AgentDetail />);
    expect(screen.getByText('Click an agent node to see details')).toBeDefined();
  });

  it('renders agent not found when selectedAgentId has no match', () => {
    useDashboardStore.getState().setSelectedAgent('0xnonexistent');
    render(<AgentDetail />);
    expect(screen.getByText('Agent not found')).toBeDefined();
  });

  it('renders agent details when selected', () => {
    useDashboardStore.getState().updateAgent('0xabc', {
      name: 'Researcher',
      role: 'researcher',
      reputationScore: 9.1,
    });
    useDashboardStore.getState().setSelectedAgent('0xabc');

    render(<AgentDetail />);
    expect(screen.getByText('Researcher')).toBeDefined();
    expect(screen.getByText('researcher')).toBeDefined();
    expect(screen.getByText('9.1/10')).toBeDefined();
  });

  it('shows FLAGGED badge for civic-flagged agent', () => {
    useDashboardStore.getState().updateAgent('0xbad', {
      name: 'Malicious',
      role: 'malicious',
      reputationScore: 1.2,
      civicFlagged: true,
    });
    useDashboardStore.getState().setSelectedAgent('0xbad');

    render(<AgentDetail />);
    expect(screen.getByText('FLAGGED')).toBeDefined();
  });

  it('renders no activity message for fresh agent', () => {
    useDashboardStore.getState().updateAgent('0xnew', {
      name: 'NewAgent',
      role: 'researcher',
    });
    useDashboardStore.getState().setSelectedAgent('0xnew');

    render(<AgentDetail />);
    expect(screen.getByText('No activity recorded yet.')).toBeDefined();
  });
});
