// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useDeployStore } from '@/stores/deploy-store';
import { DeploymentStatus } from '@/components/deploy/deployment-status';

describe('DeploymentStatus component', () => {
  beforeEach(() => {
    useDeployStore.setState(useDeployStore.getInitialState());
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when status is idle', () => {
    const { container } = render(<DeploymentStatus />);
    expect(container.textContent).toBe('');
  });

  it('renders steps when deploying', () => {
    useDeployStore.setState({
      status: 'deploying',
      steps: [
        { id: 'wallet', label: 'Wallet Generated', status: 'complete' },
        { id: 'funded', label: 'Funded', status: 'in-progress' },
        { id: 'registered', label: 'Registered on ERC-8004', status: 'pending' },
      ],
    });

    render(<DeploymentStatus />);
    expect(screen.getByText('Wallet Generated')).toBeDefined();
    expect(screen.getByText('Funded')).toBeDefined();
    expect(screen.getByText('Registered on ERC-8004')).toBeDefined();
  });

  it('shows success result with agent info', () => {
    useDeployStore.setState({
      status: 'success',
      result: {
        agentId: '0xabc123',
        address: '0xdef456',
        linkedReputation: false,
      },
      steps: [
        { id: 'wallet', label: 'Wallet Generated', status: 'complete' },
        { id: 'funded', label: 'Funded', status: 'complete' },
        { id: 'registered', label: 'Registered on ERC-8004', status: 'complete' },
      ],
    });

    render(<DeploymentStatus />);
    expect(screen.getByText(/0xabc123/)).toBeDefined();
    expect(screen.getByText(/0xdef456/)).toBeDefined();
    expect(screen.getByText(/view in dashboard/i)).toBeDefined();
  });

  it('shows error state with message', () => {
    useDeployStore.setState({
      status: 'error',
      error: 'Registration failed',
      steps: [
        { id: 'wallet', label: 'Wallet Generated', status: 'complete' },
        { id: 'funded', label: 'Funded', status: 'complete' },
        { id: 'registered', label: 'Registered on ERC-8004', status: 'error', error: 'Registration failed' },
      ],
    });

    render(<DeploymentStatus />);
    expect(screen.getByText('Registration failed')).toBeDefined();
  });

  it('shows retry button on error', () => {
    useDeployStore.setState({
      status: 'error',
      error: 'Failed',
      steps: [
        { id: 'wallet', label: 'Wallet Generated', status: 'error', error: 'Failed' },
      ],
    });

    render(<DeploymentStatus />);
    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
  });

  it('shows dashboard link with agent ID query param on success', () => {
    useDeployStore.setState({
      status: 'success',
      result: {
        agentId: '0xabc123',
        address: '0xdef456',
        linkedReputation: false,
      },
      steps: [],
    });

    render(<DeploymentStatus />);
    const link = screen.getByText(/view in dashboard/i);
    expect(link.closest('a')?.getAttribute('href')).toBe('/?agent=0xabc123');
  });
});
