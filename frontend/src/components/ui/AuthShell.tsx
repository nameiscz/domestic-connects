import type { ReactNode } from 'react';
import Logo from '../Logo';
import Card from './Card';

/**
 * AuthShell — centered auth-page layout: brand wordmark + subtitle above a
 * Card, optional footer line below. Entrance uses a subtle slide-up that the
 * global CSS disables under prefers-reduced-motion.
 */

export interface AuthShellProps {
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Wider card for forms with more fields (register). */
  wide?: boolean;
}

export function AuthShell({ subtitle, children, footer, wide = false }: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full">
        <div className={`mx-auto ${wide ? 'max-w-lg' : 'max-w-md'}`}>
          <div className="animate-slide-up">
            <div className="mb-6 text-center">
              <p className="mb-2 inline-flex items-center gap-2.5">
                <Logo size={34} />
              </p>
              <h1 className="font-display text-[1.75rem] font-semibold leading-tight text-ink">
                Domestic Connects
              </h1>
              <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>
            </div>

            <Card className="animate-slide-up p-6 sm:p-7">{children}</Card>

            {footer && (
              <p className="mt-5 text-center text-sm text-ink-soft">{footer}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthShell;
