import type { ReactNode } from 'react';
import { CalendarCheck2, ShieldCheck, Wallet } from 'lucide-react';
import Logo from '../Logo';
import Card from './Card';
import './AuthShell.css';

/**
 * AuthShell — split-screen auth layout. The left panel is a branded hero
 * (deep-teal gradient, marigold glow and blueprint grid — the same art
 * direction as the landing page and dashboard .dash-hero) that carries the
 * product story; the right panel holds the form. On small screens the hero
 * collapses into a compact gradient band above the form.
 *
 * The brand panel is aria-hidden: the form panel already provides the page's
 * single h1 and brand context, so screen-reader users land straight on the
 * form instead of hearing the decorative copy twice.
 */

export interface AuthShellProps {
  /** Page h1 shown above the form. Defaults to `subtitle`. */
  title?: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Wider form column for forms with more fields (register). */
  wide?: boolean;
}

const TRUST_POINTS = [
  { icon: ShieldCheck, label: 'Identity checked' },
  { icon: CalendarCheck2, label: 'Attendance tracked' },
  { icon: Wallet, label: 'Paid on time' },
];

const METRICS = [
  { value: '128', label: 'Jobs done' },
  { value: '4.9', label: 'Avg rating' },
  { value: '2 yrs', label: 'On platform' },
];

export function AuthShell({ title, subtitle, children, footer, wide = false }: AuthShellProps) {
  return (
    <div className="auth-shell">
      {/* Brand hero panel — mirrors the landing hero / dashboard .dash-hero. */}
      <aside className="auth-brand" aria-hidden="true">
        <div className="auth-brand-inner">
          <div className="auth-brand-top">
            <Logo size={30} />
            <span className="auth-wordmark">Domestic Connects</span>
          </div>

          <div>
            <span className="auth-eyebrow">
              Trusted by households &amp; domestic workers
            </span>
            <div className="auth-headline">
              Reliable help, <em>verified</em> before they knock.
            </div>
            <p className="auth-lede">
              Domestic Connects matches households with background-checked
              domestic workers — and handles attendance, payslips and reviews,
              so neither of you has to chase paperwork.
            </p>
          </div>

          <div className="auth-brand-bottom">
            <div className="auth-trust">
              {TRUST_POINTS.map(({ icon: Icon, label }) => (
                <span key={label}>
                  <Icon size={15} strokeWidth={2.4} aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
            <div className="auth-metrics">
              {METRICS.map((m) => (
                <div key={m.label} className="hero-metric">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
                    {m.label}
                  </div>
                  <div className="truncate font-display text-lg font-bold text-white">
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Form panel */}
      <main className="auth-form-panel">
        <div className={`auth-form-card${wide ? ' auth-form-card--wide' : ''}`}>
          <div className="auth-form-head">
            <span className="auth-form-logo">
              <Logo size={30} />
            </span>
            <h1 className="auth-form-title">{title || subtitle}</h1>
            <p className="auth-form-subtitle">{subtitle}</p>
          </div>

          <Card className="animate-slide-up p-6 sm:p-7">{children}</Card>

          {footer && <p className="auth-form-footer">{footer}</p>}
        </div>
      </main>
    </div>
  );
}

export default AuthShell;
