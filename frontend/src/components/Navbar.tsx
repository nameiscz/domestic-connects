import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Menu, Moon, Sun, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../constants/roles';
import { NAV_LINKS } from '../constants/navLinks';
import useUnreadNotifications from '../hooks/useUnreadNotifications';
import { notificationApi } from '../api';
import { formatDate } from '../utils/jobFormat';
import { useTheme } from '../hooks/useTheme';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import type { NotificationLog, NotificationType } from '../types';

/**
 * Shared navbar for the signed-in area: brand, role-aware icon links with
 * active pill highlighting, a worker-only notification bell (unread badge +
 * hover dropdown), and a compact profile chip whose dropdown holds the theme
 * toggle and Log out. Sticky, blurred teal surface; mobile gets a hamburger-
 * driven slide-in panel.
 *
 * Mounted by DashboardLayout, so it is visible across every role dashboard
 * (including nested routes like /worker/jobs).
 */

// Role → Bootstrap accent dot in the profile dropdown (mirrors each dashboard).
const ROLE_ACCENT: Record<string, string> = {
  WORKER: 'primary',
  EMPLOYER: 'success',
  ADMIN: 'danger',
};

const NOTIFICATION_LABEL: Record<NotificationType, string> = {
  JOB_ASSIGNED: 'Job assigned',
  SALARY_SLIP_GENERATED: 'Salary slip',
  PERFORMANCE_REVIEWED: 'Performance review',
};

function initials(name?: string): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

interface NavbarProps {
  /** Bootstrap accent name for the profile role dot (defaults per role). */
  accent?: string;
}

export default function Navbar({ accent }: NavbarProps) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();

  const role = currentUser?.role;
  const links = role ? NAV_LINKS[role] : [];
  const homePath = role ? ROLE_HOME[role] : '/login';
  const roleDotAccent = accent || (role ? ROLE_ACCENT[role] : undefined) || 'primary';

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState<NotificationLog[]>([]);

  // The notification inbox is worker-only (the backend enforces it), so the
  // bell + unread badge only render for WORKER sessions.
  const unreadCount = useUnreadNotifications(role === 'WORKER' ? currentUser?.id : null);

  // Best-effort fetch of the 5 most recent notifications for the bell dropdown.
  useEffect(() => {
    if (role !== 'WORKER' || !currentUser?.id) {
      setRecentNotifications([]);
      return undefined;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const data = await notificationApi.getNotifications(currentUser.id, {
          signal: controller.signal,
        });
        setRecentNotifications(Array.isArray(data) ? data : []);
      } catch {
        // Decorative — a hiccup must never break the navbar.
      }
    })();
    return () => controller.abort();
  }, [role, currentUser?.id]);

  const handleLogout = () => {
    logout();
    // Redirect explicitly (replace so the Back button doesn't land back on
    // the dashboard the user just logged out of).
    navigate('/login', { replace: true });
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-white/10 bg-teal-900/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:gap-3 lg:px-8">
        <Link to={homePath} className="flex items-center gap-2 font-display text-lg font-semibold text-white">
          <Logo variant="dot" size={10} />
          Domestic Connects
        </Link>

        {/* Desktop navigation links (with icons) */}
        <div className="ml-2 hidden items-center gap-1 lg:flex">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'active bg-white/15 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5 lg:gap-2">
          {role === 'WORKER' && (
            <div className="group relative">
              <Link
                to="/worker/notifications"
                aria-label={`Notifications, ${unreadCount} unread`}
                title="Notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Bell size={18} aria-hidden="true" />
                {unreadCount > 0 && (
                  <span
                    data-testid="unread-notifications-badge"
                    className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>

              {/* Hover/focus dropdown — 5 most recent notifications. */}
              <div className="invisible absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-white p-2 opacity-0 shadow-card transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
                  Notifications
                </p>
                {recentNotifications.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-ink-soft">Nothing yet — we&apos;ll let you know.</p>
                ) : (
                  <ul className="divide-y divide-line/70">
                    {recentNotifications.slice(0, 5).map((n) => (
                      <li key={n.id}>
                        <Link
                          to="/worker/notifications"
                          className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-teal-100/40"
                        >
                          <span
                            className={`mt-0.5 h-2 w-2 flex-none rounded-full ${
                              n.isRead ? 'bg-line' : 'bg-marigold-500'
                            }`}
                            aria-hidden="true"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-ink">
                              {NOTIFICATION_LABEL[n.type] || n.type}
                            </span>
                            <span className="block truncate text-xs text-ink-soft">{n.message}</span>
                            <span className="block text-[11px] text-ink-soft/70">
                              {formatDate(n.createdAt)}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  to="/worker/notifications"
                  className="mt-1 block rounded-xl bg-teal-100/60 px-3 py-2 text-center text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-100"
                >
                  View all notifications
                </Link>
              </div>
            </div>
          )}

          {/* Compact profile chip + dropdown */}
          {currentUser && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                className="navbar-profile-chip flex items-center gap-2 rounded-full border border-white/15 py-1 pl-1 pr-2.5 transition-colors"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-marigold-500 text-xs font-bold text-teal-900">
                  {initials(currentUser.name)}
                </span>
                <span className="hidden max-w-24 truncate text-sm font-semibold text-white md:block">
                  {currentUser.name}
                </span>
                <ChevronDown size={14} className="text-white/70" aria-hidden="true" />
              </button>

              {profileOpen && (
                <>
                  {/* Invisible backdrop closes the menu on outside click. */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-2 w-60 animate-scale-in rounded-2xl border border-line bg-white p-1.5 shadow-card-hover"
                  >
                    <div className="border-b border-line px-3 pb-2.5 pt-2">
                      <p className="truncate text-sm font-semibold text-ink">{currentUser.name}</p>
                      <p className="truncate text-xs text-ink-soft">{currentUser.email}</p>
                      {role && (
                        <p className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                          <span
                            className={`h-1.5 w-1.5 rounded-full bg-${roleDotAccent}`}
                            aria-hidden="true"
                          />
                          {role}
                        </p>
                      )}
                    </div>
                    <Link
                      to={homePath}
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className="mt-1 flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-teal-100/60"
                    >
                      <User size={15} className="text-ink-soft" aria-hidden="true" />
                      My Profile
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={toggle}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-teal-100/60"
                    >
                      {isDark ? (
                        <Sun size={15} className="text-ink-soft" aria-hidden="true" />
                      ) : (
                        <Moon size={15} className="text-ink-soft" aria-hidden="true" />
                      )}
                      {isDark ? 'Light mode' : 'Dark mode'}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-danger-text transition-colors hover:bg-danger-soft/60"
                    >
                      <LogOut size={15} aria-hidden="true" />
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-panel"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10 lg:hidden"
          >
            {mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile slide-in panel */}
      {mobileOpen && (
        <div
          id="mobile-nav-panel"
          className="animate-fade-in border-t border-white/10 bg-teal-900 px-4 pb-4 pt-2 lg:hidden"
        >
          <ul className="space-y-1">
            {links.map(({ to, label, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'active bg-white/15 text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
            {currentUser && (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 px-3 py-1.5 text-sm font-semibold text-white"
              >
                <LogOut size={15} aria-hidden="true" />
                Log out
              </button>
            )}
            <span className="lg:hidden">
              <ThemeToggle />
            </span>
          </div>
        </div>
      )}
    </nav>
  );
}
