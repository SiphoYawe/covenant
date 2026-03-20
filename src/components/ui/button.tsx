import type { ReactNode, ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-500 text-white',
  secondary: 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200',
  ghost: 'bg-transparent hover:bg-zinc-800 text-zinc-400',
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors
        ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
