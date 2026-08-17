import type { HTMLAttributes } from 'react';

/**
 * Skeleton — pulsing placeholder for loading states. `rect` (rounded) or
 * `circle`; the pulse animation is disabled under prefers-reduced-motion via
 * the global CSS.
 */

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'rect' | 'circle';
}

export function Skeleton({ variant = 'rect', className = '', ...rest }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        'animate-pulse bg-line',
        variant === 'circle' ? 'rounded-full' : 'rounded-lg',
        className,
      ].join(' ')}
      {...rest}
    />
  );
}

/** Convenience: a stacked list of rect skeletons (e.g. card grids). */
export function SkeletonList({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="mb-3 h-20 w-full" />
      ))}
    </div>
  );
}

export default Skeleton;
