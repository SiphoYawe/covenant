// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useDeployStore } from '@/stores/deploy-store';
import { DeployForm } from '@/components/deploy/deploy-form';

describe('DeployForm component', () => {
  beforeEach(() => {
    useDeployStore.setState(useDeployStore.getInitialState());
  });

  afterEach(() => {
    cleanup();
  });

  it('renders mode tabs', () => {
    render(<DeployForm />);
    expect(screen.getByText('Provisioned')).toBeDefined();
    expect(screen.getByText('Bring Your Own Wallet')).toBeDefined();
  });

  it('renders common form fields', () => {
    render(<DeployForm />);
    expect(screen.getByLabelText('Agent Name')).toBeDefined();
    expect(screen.getByLabelText('Description')).toBeDefined();
  });

  it('renders deploy button', () => {
    render(<DeployForm />);
    expect(screen.getByRole('button', { name: /deploy agent/i })).toBeDefined();
  });

  it('renders system prompt in provisioned mode', () => {
    render(<DeployForm />);
    expect(screen.getByLabelText('System Prompt')).toBeDefined();
  });

  it('hides system prompt in BYOW mode', () => {
    useDeployStore.getState().setMode('byow');
    render(<DeployForm />);
    expect(screen.queryByLabelText('System Prompt')).toBeNull();
  });

  it('shows wallet address in BYOW mode', () => {
    useDeployStore.getState().setMode('byow');
    render(<DeployForm />);
    expect(screen.getByLabelText('Wallet Address')).toBeDefined();
  });

  it('hides wallet address in provisioned mode', () => {
    render(<DeployForm />);
    expect(screen.queryByLabelText('Wallet Address')).toBeNull();
  });

  it('switches mode when tab is clicked', () => {
    render(<DeployForm />);
    fireEvent.click(screen.getByText('Bring Your Own Wallet'));
    expect(useDeployStore.getState().mode).toBe('byow');
  });

  it('updates name in store on input', () => {
    render(<DeployForm />);
    const input = screen.getByLabelText('Agent Name');
    fireEvent.change(input, { target: { value: 'My Agent' } });
    expect(useDeployStore.getState().formData.name).toBe('My Agent');
  });

  it('updates description in store on input', () => {
    render(<DeployForm />);
    const textarea = screen.getByLabelText('Description');
    fireEvent.change(textarea, { target: { value: 'A useful agent for testing purposes' } });
    expect(useDeployStore.getState().formData.description).toBe('A useful agent for testing purposes');
  });

  it('disables deploy button when deploying', () => {
    useDeployStore.setState({ status: 'deploying' });
    render(<DeployForm />);
    const button = screen.getByRole('button', { name: /deploy/i });
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('renders capability picker', () => {
    render(<DeployForm />);
    expect(screen.getByText('Capabilities')).toBeDefined();
  });

  it('renders reputation link toggle', () => {
    render(<DeployForm />);
    expect(screen.getByText(/link my reputation/i)).toBeDefined();
  });
});
