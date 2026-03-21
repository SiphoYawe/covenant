// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiveTriggerCard } from '@/components/demo/live-trigger-card';

describe('LiveTriggerCard', () => {
  const defaultProps = {
    title: 'Execute Transaction',
    description: 'Full lifecycle interaction with payment and reputation update',
    estimatedDuration: 25,
    steps: [
      { name: 'Discovery', protocol: 'a2a', duration: '2s' },
      { name: 'Negotiation', protocol: 'covenant-ai', duration: '5-8s' },
      { name: 'Payment', protocol: 'x402', duration: '3-5s' },
    ],
    isExecuting: false,
    onTrigger: vi.fn(),
  };

  it('renders title and description', () => {
    render(<LiveTriggerCard {...defaultProps} />);
    expect(screen.getByText('Execute Transaction')).toBeDefined();
    expect(screen.getByText(/Full lifecycle interaction/)).toBeDefined();
  });

  it('renders estimated duration', () => {
    render(<LiveTriggerCard {...defaultProps} />);
    expect(screen.getByText(/~25s/)).toBeDefined();
  });

  it('renders step names', () => {
    render(<LiveTriggerCard {...defaultProps} />);
    expect(screen.getByText('Discovery')).toBeDefined();
    expect(screen.getByText('Negotiation')).toBeDefined();
    expect(screen.getByText('Payment')).toBeDefined();
  });

  it('calls onTrigger when button clicked', () => {
    render(<LiveTriggerCard {...defaultProps} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(defaultProps.onTrigger).toHaveBeenCalledTimes(1);
  });

  it('disables button when isExecuting is true', () => {
    render(<LiveTriggerCard {...defaultProps} isExecuting={true} />);
    const button = screen.getByRole('button');
    expect(button).toHaveProperty('disabled', true);
  });

  it('shows executing label when running', () => {
    render(<LiveTriggerCard {...defaultProps} isExecuting={true} />);
    expect(screen.getByText(/Executing/)).toBeDefined();
  });

  it('shows result summary when provided', () => {
    render(
      <LiveTriggerCard
        {...defaultProps}
        result={{ success: true, negotiatedPrice: 12 }}
      />,
    );
    expect(screen.getByText(/Complete/)).toBeDefined();
  });
});
