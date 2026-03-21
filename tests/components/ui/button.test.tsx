// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeDefined();
  });

  it('applies primary variant styling by default', () => {
    const { container } = render(<Button>Primary</Button>);
    expect(container.firstElementChild!.className).toContain('bg-primary');
  });

  it('applies secondary variant styling', () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>);
    expect(container.firstElementChild!.className).toContain('bg-secondary');
  });

  it('applies ghost variant styling', () => {
    const { container } = render(<Button variant="ghost">Ghost</Button>);
    expect(container.firstElementChild!.className).toContain('bg-transparent');
  });

  it('applies size classes', () => {
    const { container } = render(<Button size="sm">Small</Button>);
    expect(container.firstElementChild!.className).toContain('px-3');

    const { container: lg } = render(<Button size="lg">Large</Button>);
    expect(lg.firstElementChild!.className).toContain('px-6');
  });

  it('handles onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByText('Click'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('respects disabled state', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Disabled</Button>);
    const btn = screen.getByText('Disabled');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(btn.className).toContain('opacity-50');
  });
});
