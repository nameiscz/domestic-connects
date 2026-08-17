import type { ReactNode } from 'react';

/**
 * EmptyState — friendly placeholder for lists with nothing to show. Icon sits
 * in a soft teal circle; an optional action button goes below the copy.
 */

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, message, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white/70 px-6 py-12 text-center',
        className,
      ].join(' ')}
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-700">
          {icon}
        </div>
      )}
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-sm text-ink-soft">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default EmptyState;
