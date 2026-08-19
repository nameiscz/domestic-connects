import type { HTMLAttributes } from 'react';

/**
 * Badge — compact status pill. No border — uses background tint only.
 * Matches Linear / Vercel badge style.
 */

export type BadgeVariant = 'success' | 'warning' | 'neutral' | 'danger';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  neutral: 'bg-black/[0.05] text-ink-soft',
  danger: 'bg-red-50 text-red-600',
};

export function Badge({ variant = 'neutral', className = '', children, ...rest }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        VARIANT_CLASSES[variant],
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </span>
  );
}

export default Badge;
