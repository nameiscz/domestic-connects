import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Card — the shared surface. Rounded, soft-bordered, subtle shadow; pass
 * `hover` for a gentle lift used on clickable cards.
 */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  /** Removes padding for full-bleed content (tables, images). */
  flush?: boolean;
}

export function Card({ hover = false, flush = false, className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={[
        'rounded-2xl border border-line bg-white shadow-card',
        flush ? '' : 'p-5',
        hover
          ? 'transition-all duration-150 hover:-translate-y-0.5 hover:border-teal-500/40 hover:shadow-card-hover'
          : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Card header row — title left, optional action right. */
export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export default Card;
