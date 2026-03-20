// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText('Test Badge')).toBeDefined();
  });

  it('applies default variant styling', () => {
    const { container } = render(<Badge>Default</Badge>);
    const el = container.firstElementChild!;
    expect(el.className).toContain('bg-zinc-700');
  });

  it('applies success variant styling', () => {
    const { container } = render(<Badge variant="success">OK</Badge>);
    const el = container.firstElementChild!;
    expect(el.className).toContain('bg-green-600/20');
  });

  it('applies warning variant styling', () => {
    const { container } = render(<Badge variant="warning">Warn</Badge>);
    const el = container.firstElementChild!;
    expect(el.className).toContain('bg-amber-600/20');
  });

  it('applies danger variant styling', () => {
    const { container } = render(<Badge variant="danger">Error</Badge>);
    const el = container.firstElementChild!;
    expect(el.className).toContain('bg-red-600/20');
  });

  it('applies custom className', () => {
    const { container } = render(<Badge className="ml-2">Custom</Badge>);
    const el = container.firstElementChild!;
    expect(el.className).toContain('ml-2');
  });
});
