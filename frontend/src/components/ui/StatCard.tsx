import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * StatCard — dashboard metric card with a restrained icon-only color accent
 * (soft tinted chip, not a gradient). Fraunces value, uppercase label and an
 * optional footnote. Grid placement is the parent's job.
 */

export type StatAccent = 'primary' | 'success' | 'warning' | 'info' | 'danger';

export interface StatCardProps {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  note?: ReactNode;
  accent?: StatAccent;
}

const ACCENT_TINT: Record<StatAccent, string> = {
  primary: 'bg-teal-100 text-teal-700',
  success: 'bg-success-soft text-success-text',
  warning: 'bg-marigold-100 text-marigold-600',
  info: 'bg-teal-100/60 text-teal-500',
  danger: 'bg-danger-soft text-danger-text',
};

export function StatCard({ icon: Icon, label, value, note, accent = 'primary' }: StatCardProps) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-white p-5 shadow-card">
      {Icon && (
        <span
          className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${ACCENT_TINT[accent]}`}
          aria-hidden="true"
        >
          <Icon size={20} strokeWidth={2.2} />
        </span>
      )}
      <div className="font-display text-2xl font-bold leading-tight text-ink">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</div>
      {note && <div className="mt-auto pt-2 text-sm text-ink-soft">{note}</div>}
    </div>
  );
}

export default StatCard;
