// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from '@/components/ui/card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Content here</Card>);
    expect(screen.getByText('Content here')).toBeDefined();
  });

  it('renders title when provided', () => {
    render(<Card title="My Card">Content</Card>);
    expect(screen.getByText('My Card')).toBeDefined();
  });

  it('does not render title element when title is omitted', () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.querySelector('h3')).toBeNull();
  });

  it('applies custom className', () => {
    const { container } = render(<Card className="mt-4">Content</Card>);
    expect(container.firstElementChild!.className).toContain('mt-4');
  });
});
