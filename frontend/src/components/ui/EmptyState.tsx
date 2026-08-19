import type { ReactNode } from 'react';

/**
 * EmptyState — friendly placeholder for lists with nothing to show.
 * Soft rounded surface, no hard borders.
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
        'flex flex-col items-center justify-center rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] px-6 py-14 text-center',
        className,
      ].join(' ')}
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-200/20 text-[#155E63] dark:text-teal-400">
          {icon}
        </div>
      )}
      <h3 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-sm text-ink-soft">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default EmptyState;
