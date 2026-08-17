import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type StatAccent = 'primary' | 'success' | 'warning' | 'info' | 'danger';

export interface StatCardProps {
  /** Lucide icon rendered in the tinted chip. */
  icon?: LucideIcon;
  /** Plain-string emoji fallback when no Lucide icon is passed. */
  emoji?: string;
  label: string;
  value: ReactNode;
  note?: ReactNode;
  accent?: StatAccent;
  /** Renders a small "sample" badge for placeholder values. */
  sample?: boolean;
}

/**
 * Shared Bootstrap stat card for dashboard overviews: an icon, a headline
 * value, an uppercase label and an optional footnote. Icons are Lucide
 * components (passed via `icon`); a plain-string emoji still works as a
 * fallback. The optional `sample` flag renders a small "sample" badge for
 * placeholder values. The hover-lift effect lives in src/index.css.
 */
export default function StatCard({
  icon,
  emoji,
  label,
  value,
  note,
  accent = 'primary',
  sample = false,
}: StatCardProps) {
  const Icon = typeof icon === 'string' ? null : icon;

  return (
    <div className="col-6 col-lg-3">
      <div className="card stat-card shadow-sm h-100">
        <div className="card-body d-flex flex-column">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <span className={`stat-icon stat-icon-${accent}`} aria-hidden="true">
              {Icon ? (
                <Icon size={20} strokeWidth={2.2} />
              ) : (
                <span className="fs-5" role="img" aria-hidden="true">
                  {emoji}
                </span>
              )}
            </span>
            {sample && (
              <span className="badge bg-light text-muted border small">
                sample
              </span>
            )}
          </div>
          <div className={`fs-4 fw-bold text-${accent} mb-0`}>{value}</div>
          <div className="text-muted small text-uppercase">{label}</div>
          {note && <div className="text-muted small mt-auto pt-1">{note}</div>}
        </div>
      </div>
    </div>
  );
}
