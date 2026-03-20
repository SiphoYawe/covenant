// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Loading } from '@/components/ui/loading';

describe('Loading', () => {
  it('renders a spinner element', () => {
    const { container } = render(<Loading />);
    const spinner = container.firstElementChild!;
    expect(spinner.className).toContain('animate-spin');
  });

  it('renders sm size', () => {
    const { container } = render(<Loading size="sm" />);
    expect(container.firstElementChild!.className).toContain('h-4');
  });

  it('renders md size by default', () => {
    const { container } = render(<Loading />);
    expect(container.firstElementChild!.className).toContain('h-6');
  });

  it('renders lg size', () => {
    const { container } = render(<Loading size="lg" />);
    expect(container.firstElementChild!.className).toContain('h-8');
  });

  it('has accessible role', () => {
    const { container } = render(<Loading />);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });
});
