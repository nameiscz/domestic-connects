import type { HTMLAttributes } from 'react';

/**
 * Badge — compact status pill. Variants map to the design tokens:
 * success (soft green), warning (marigold), neutral (line), danger (soft red).
 */

export type BadgeVariant = 'success' | 'warning' | 'neutral' | 'danger';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-success-soft text-success-text border-success/20',
  warning: 'bg-marigold-100 text-marigold-600 border-marigold-500/30',
  neutral: 'bg-line/50 text-ink-soft border-line',
  danger: 'bg-danger-soft text-danger-text border-danger/20',
};

export function Badge({ variant = 'neutral', className = '', children, ...rest }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
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
