import type { ReactNode } from 'react';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger';

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  default: 'bg-zinc-700 text-zinc-200',
  success: 'bg-green-600/20 text-green-400 border border-green-600/30',
  warning: 'bg-amber-600/20 text-amber-400 border border-amber-600/30',
  danger: 'bg-red-600/20 text-red-400 border border-red-600/30',
};

export type BadgeProps = {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${VARIANT_STYLES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
