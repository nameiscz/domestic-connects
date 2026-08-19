import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Card — premium surface. No visible border; layered ultra-soft shadow for
 * depth. Matches Linear / Vercel card style.
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
        'rounded-2xl bg-card',
        'shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]',
        flush ? '' : 'p-6',
        hover
          ? 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.06)]'
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
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export default Card;
