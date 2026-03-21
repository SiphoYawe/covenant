import type { ReactNode } from 'react';

export type CardProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export function Card({ title, children, className = '' }: CardProps) {
  return (
    <div
      className={`rounded-xl bg-card card-elevated p-5 ${className}`}
    >
      {title && (
        <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      )}
      {children}
    </div>
  );
}
