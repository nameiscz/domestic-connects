import { Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import Navbar from './Navbar';

/**
 * Shared shell for the three role dashboards: the responsive role-aware
 * <Navbar /> (brand, role links, user chip and logout), an optional page
 * title, and an <Outlet /> so nested routes (e.g. /worker/jobs) render inside
 * the same layout. The `accent` prop is forwarded to the Navbar for the role
 * badge colour and defaults per role there, so passing it is optional.
 */

interface DashboardLayoutProps {
  title?: string;
  accent?: string;
  showTitle?: boolean;
  children?: ReactNode;
}

export default function DashboardLayout({
  title,
  accent,
  showTitle = true,
  children,
}: DashboardLayoutProps) {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Navbar accent={accent} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {showTitle && (
          <h2 className="mb-5 font-display text-2xl font-semibold text-ink">{title}</h2>
        )}
        {/* Re-keyed on route change so nested pages fade in as a page
            transition (prefers-reduced-motion disables it via index.css). */}
        <div key={pathname} className="animate-fade-in">
          {children}
          {/* Nested routes (e.g. /worker/jobs) render here inside the shell. */}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
