import type { ReactNode } from 'react';

export type CardProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export function Card({ title, children, className = '' }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-zinc-700 bg-zinc-900/50 p-4 ${className}`}
    >
      {title && (
        <h3 className="text-sm font-medium text-zinc-400 mb-3">{title}</h3>
      )}
      {children}
    </div>
  );
}
