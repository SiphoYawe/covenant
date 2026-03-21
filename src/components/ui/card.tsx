import type { ReactNode } from 'react';

export type CardProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export function Card({ title, children, className = '' }: CardProps) {
  return (
    <div
      className={`rounded-3xl border border-border bg-card shadow-md shadow-black/4 p-4 ${className}`}
    >
      {title && (
        <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      )}
      {children}
    </div>
  );
}
