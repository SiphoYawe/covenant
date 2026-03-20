export type LoadingSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<LoadingSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export type LoadingProps = {
  size?: LoadingSize;
};

export function Loading({ size = 'md' }: LoadingProps) {
  return (
    <div
      className={`${SIZE_CLASSES[size]} animate-spin rounded-full border-2 border-zinc-600 border-t-blue-400`}
      role="status"
      aria-label="Loading"
    />
  );
}
