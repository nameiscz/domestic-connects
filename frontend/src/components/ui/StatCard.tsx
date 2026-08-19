import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * StatCard — dashboard metric card. No visible border, ultra-soft shadow,
 * tinted icon chip. Matches Linear / Vercel stat card style.
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
  primary: 'bg-teal-50 text-[#155E63]',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  info: 'bg-teal-50/60 text-teal-600',
  danger: 'bg-red-50 text-red-600',
};

export function StatCard({ icon: Icon, label, value, note, accent = 'primary' }: StatCardProps) {
  return (
    <div className="flex h-full flex-col rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
      {Icon && (
        <span
          className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${ACCENT_TINT[accent]}`}
          aria-hidden="true"
        >
          <Icon size={20} strokeWidth={2.2} />
        </span>
      )}
      <div className="text-2xl font-bold leading-tight tracking-tight text-ink">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</div>
      {note && <div className="mt-auto pt-2.5 text-sm text-ink-soft">{note}</div>}
    </div>
  );
}

export default StatCard;
